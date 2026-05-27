import { Prisma } from "@prisma/client";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { assertPayoutTransition, shouldApplyPayoutWebhookStatusUpdate } from "./paymentStateMachine";
import { logPaymentAudit, PaymentActionType } from "./paymentFlowDiagnostics";
import { getDefaultVerifiedPayoutAccountId } from "./staffPayoutAccountService";
import { getPayoutProviderByRouteId, getPayoutProviderFromEnv } from "./payoutProviders/mockPayoutProvider";
import type { PayoutWebhookNormalized } from "./payoutProviders/payoutProvider.types";

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

/** Idempotent payout row updates from a normalized webhook payload (inside a transaction). */
async function applyNormalizedWebhookStatusToApplicationPayout(
  tx: Prisma.TransactionClient,
  payoutRowId: number,
  normalized: PayoutWebhookNormalized
): Promise<void> {
  const fresh = await tx.application_payouts.findUnique({ where: { id: payoutRowId } });
  if (!fresh) return;
  const st = norm(normalized.status);
  if (st === "paid" || st === "success" || st === "completed") {
    if (norm(fresh.status) !== "paid") {
      if (!shouldApplyPayoutWebhookStatusUpdate(fresh.status, "paid", { payoutId: fresh.id })) return;
      await tx.application_payouts.update({
        where: { id: fresh.id },
        data: {
          status: "paid",
          paid_at: new Date(),
          failed_at: null,
          last_error: null,
          updated_at: new Date(),
        },
      });
    }
  } else if (st === "failed" || st === "error") {
    if (norm(fresh.status) !== "paid") {
      if (!shouldApplyPayoutWebhookStatusUpdate(fresh.status, "failed", { payoutId: fresh.id })) return;
      await tx.application_payouts.update({
        where: { id: fresh.id },
        data: {
          status: "failed",
          failed_at: new Date(),
          last_error: "Payout failed (webhook).",
          updated_at: new Date(),
        },
      });
    }
  } else if (st === "reversed" || st === "refunded") {
    if (norm(fresh.status) === "paid") {
      if (!shouldApplyPayoutWebhookStatusUpdate("paid", "reversed", { payoutId: fresh.id })) return;
      await tx.application_payouts.update({
        where: { id: fresh.id },
        data: {
          status: "reversed",
          last_error: "Payout reversed by provider.",
          updated_at: new Date(),
        },
      });
    }
  }
}

function respectPayoutDueAt(): boolean {
  return String(process.env.PAYOUT_RESPECT_DUE_AT || "").trim() === "true";
}

function automationEnabled(): boolean {
  const v = String(process.env.PAYOUT_AUTOMATION_ENABLED ?? "true").trim().toLowerCase();
  return v !== "false" && v !== "0";
}

function providerRefForAttempt(payoutId: number): string {
  return `W2N-PAYOUT-${payoutId}-${Date.now()}`;
}

export async function runPayoutWorkerTick(): Promise<{ processed: number; skipped: number; errors: number }> {
  if (!automationEnabled()) {
    return { processed: 0, skipped: 0, errors: 0 };
  }

  const now = new Date();
  const dueFilter = respectPayoutDueAt() ? { payout_due_at: { lte: now } as const } : {};
  const where: Prisma.application_payoutsWhereInput = {
    OR: [
      { status: "payout_pending", ...dueFilter },
      {
        status: "retry_pending",
        OR: [{ next_retry_at: null }, { next_retry_at: { lte: now } }],
      },
    ],
  };

  const candidates = await prisma.application_payouts.findMany({
    where,
    take: 15,
    orderBy: { payout_pending_at: "asc" },
    select: {
      id: true,
      application_id: true,
      staff_user_id: true,
      status: true,
      payout_amount: true,
      reserved_amount_snapshot: true,
      payout_due_at: true,
    },
  });

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of candidates) {
    try {
      const ok = await processSinglePayoutAutomation(row.id);
      if (ok) processed += 1;
      else skipped += 1;
    } catch (e) {
      errors += 1;
      console.error("[PayoutWorker] tick error", { payoutId: row.id, e });
    }
  }

  return { processed, skipped, errors };
}

async function processSinglePayoutAutomation(payoutId: number): Promise<boolean> {
  const provider = getPayoutProviderFromEnv();
  if (provider.id === "disabled") {
    return false;
  }

  const payout = await prisma.application_payouts.findUnique({
    where: { id: payoutId },
    select: {
      id: true,
      application_id: true,
      staff_user_id: true,
      status: true,
      payout_amount: true,
      reserved_amount_snapshot: true,
      currency: true,
      queued_at: true,
      applications: { select: { business_confirmed_at: true } },
    },
  });

  if (!payout) return false;
  const st = norm(payout.status);
  if (st !== "payout_pending" && st !== "retry_pending") return false;

  if (!payout.applications?.business_confirmed_at) {
    await prisma.application_payouts.update({
      where: { id: payoutId },
      data: { last_error: "Lipsește confirmarea customerului.", updated_at: new Date() },
    });
    return false;
  }

  const reserved = new Prisma.Decimal(String(payout.reserved_amount_snapshot));
  const amount = new Prisma.Decimal(String(payout.payout_amount));
  if (amount.greaterThan(reserved)) {
    await prisma.application_payouts.update({
      where: { id: payoutId },
      data: {
        status: "failed",
        failed_at: new Date(),
        last_error: "Suma payout depășește rezervarea.",
        updated_at: new Date(),
      },
    });
    await logPaymentAudit(PaymentActionType.PAYOUT_AUTOMATION_FAILED, {
      targetApplicationId: payout.application_id,
      summary: "Payout blocked: amount > reserved",
      metadata: { payoutId: String(payoutId) },
    });
    return true;
  }

  const accountId = await getDefaultVerifiedPayoutAccountId(payout.staff_user_id);
  if (!accountId) {
    await prisma.application_payouts.update({
      where: { id: payoutId },
      data: {
        last_error: "Staff nu are cont de plată verificat. Completează și verifică IBAN-ul în setări.",
        updated_at: new Date(),
      },
    });
    return false;
  }

  const ref = providerRefForAttempt(payoutId);
  assertPayoutTransition(payout.status, "payout_processing", { payoutId, applicationId: payout.application_id });

  const claim = await prisma.application_payouts.updateMany({
    where: {
      id: payoutId,
      status: { in: ["payout_pending", "retry_pending"] },
    },
    data: {
      status: "payout_processing",
      processing_started_at: new Date(),
      queued_at: payout.queued_at ?? new Date(),
      provider_reference: ref,
      payout_provider: provider.id,
      payout_account_id: accountId,
      last_error: null,
      updated_at: new Date(),
    },
  });

  if (claim.count !== 1) {
    return false;
  }

  await logPaymentAudit(PaymentActionType.PAYOUT_PROCESSING, {
    targetApplicationId: payout.application_id,
    summary: "Payout automation — submitted to provider",
    metadata: { payoutId: String(payoutId), provider: provider.id, providerReference: ref },
  });

  try {
    const result = await provider.createPayout({
      applicationPayoutId: payoutId,
      applicationId: payout.application_id,
      staffUserId: payout.staff_user_id,
      amount,
      currency: payout.currency,
      providerReference: ref,
      payoutAccountId: accountId,
    });

    if (result.immediatePaid) {
      const paid = await prisma.application_payouts.updateMany({
        where: { id: payoutId, status: "payout_processing" },
        data: {
          status: "paid",
          paid_at: new Date(),
          provider_payout_id: result.providerPayoutId,
          failed_at: null,
          last_error: null,
          updated_at: new Date(),
        },
      });
      if (paid.count === 1) {
        await logPaymentAudit(PaymentActionType.PAYOUT_AUTOMATION_PAID, {
          targetApplicationId: payout.application_id,
          summary: "Payout marked paid (automation)",
          metadata: { payoutId: String(payoutId), providerPayoutId: result.providerPayoutId },
        });
      }
    } else {
      await prisma.application_payouts.updateMany({
        where: { id: payoutId, status: "payout_processing" },
        data: {
          provider_payout_id: result.providerPayoutId,
          updated_at: new Date(),
        },
      });
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payout provider error.";
    await prisma.application_payouts.updateMany({
      where: { id: payoutId, status: "payout_processing" },
      data: {
        status: "retry_pending",
        failed_at: new Date(),
        last_error: msg,
        retry_count: { increment: 1 },
        next_retry_at: new Date(Date.now() + 15 * 60 * 1000),
        updated_at: new Date(),
      },
    });
    await logPaymentAudit(PaymentActionType.PAYOUT_AUTOMATION_FAILED, {
      targetApplicationId: payout.application_id,
      summary: msg,
      metadata: { payoutId: String(payoutId) },
    });
    return true;
  }
}

export async function applyPayoutWebhook(
  routeProviderId: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: string
): Promise<{ ok: boolean; duplicate?: boolean; processed?: boolean }> {
  const provider = getPayoutProviderByRouteId(routeProviderId);
  if (provider.id === "disabled") {
    throw new ServiceError("Provider necunoscut sau dezactivat.", 400);
  }
  if (!provider.verifyWebhookSignature(rawBody, headers)) {
    throw new ServiceError("Semnătură webhook invalidă.", 401);
  }

  let normalized: PayoutWebhookNormalized;
  try {
    normalized = provider.parseWebhookEvent(rawBody);
  } catch {
    throw new ServiceError("Payload webhook invalid.", 400);
  }

  if (!normalized.providerEventId || !normalized.providerPayoutId) {
    throw new ServiceError("Webhook incomplet (eventId / payoutId).", 400);
  }

  const existingEvt = await prisma.payout_provider_events.findUnique({
    where: { provider_event_id: normalized.providerEventId },
  });
  if (existingEvt) {
    if (existingEvt.processing_status === "received") {
      const repairPayout = await prisma.application_payouts.findFirst({
        where: { provider_payout_id: normalized.providerPayoutId },
      });
      await prisma.$transaction(async (tx) => {
        if (repairPayout) {
          await applyNormalizedWebhookStatusToApplicationPayout(tx, repairPayout.id, normalized);
        }
        await tx.payout_provider_events.updateMany({
          where: {
            provider_event_id: normalized.providerEventId,
            processing_status: "received",
          },
          data: { processing_status: "processed", processed_at: new Date() },
        });
      });
    }
    return { ok: true, duplicate: true, processed: true };
  }

  const payoutRow = await prisma.application_payouts.findFirst({
    where: { provider_payout_id: normalized.providerPayoutId },
  });
  if (!payoutRow) {
    console.warn("[PayoutWebhook] Unknown providerPayoutId", normalized.providerPayoutId);
    return { ok: true, processed: false };
  }

  let duplicateInTx = false;
  await prisma.$transaction(async (tx) => {
    try {
      await tx.payout_provider_events.create({
        data: {
          provider: provider.id,
          provider_event_id: normalized.providerEventId,
          provider_payout_id: normalized.providerPayoutId,
          application_payout_id: payoutRow.id,
          event_type: normalized.eventType,
          status: normalized.status,
          signature_valid: true,
          processing_status: "received",
          raw_payload: rawBody,
        },
      });
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        duplicateInTx = true;
      } else {
        throw e;
      }
    }

    if (duplicateInTx) {
      // Another request owns this provider_event_id; close out any row left at "received" (e.g. race or retry).
      await tx.payout_provider_events.updateMany({
        where: {
          provider_event_id: normalized.providerEventId,
          processing_status: "received",
        },
        data: { processing_status: "processed", processed_at: new Date() },
      });
      return;
    }

    await applyNormalizedWebhookStatusToApplicationPayout(tx, payoutRow.id, normalized);

    // Always mark the event we just inserted — even when payout was missing or already terminal.
    await tx.payout_provider_events.update({
      where: { provider_event_id: normalized.providerEventId },
      data: { processing_status: "processed", processed_at: new Date() },
    });
  });

  if (duplicateInTx) {
    return { ok: true, duplicate: true, processed: true };
  }

  await logPaymentAudit(PaymentActionType.PAYOUT_WEBHOOK_PROCESSED, {
    targetApplicationId: payoutRow.application_id,
    summary: "Payout webhook processed",
    metadata: { providerPayoutId: normalized.providerPayoutId, status: normalized.status },
  });

  return { ok: true, processed: true };
}

export function startPayoutWorkerIfEnabled(): NodeJS.Timeout | null {
  if (!automationEnabled()) return null;
  const intervalMs = Number.parseInt(process.env.PAYOUT_WORKER_INTERVAL_MS || "20000", 10);
  const ms = Number.isFinite(intervalMs) && intervalMs >= 5000 ? intervalMs : 20000;
  console.info(`[PayoutWorker] Started (interval ${ms}ms, provider=${getPayoutProviderFromEnv().id})`);
  return setInterval(() => {
    runPayoutWorkerTick().catch((e) => console.error("[PayoutWorker] interval error", e));
  }, ms);
}
