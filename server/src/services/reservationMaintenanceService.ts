import { Prisma } from "@prisma/client";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { UserRole } from "../enums";
import { markJobPublishedWhenReservationReserved, markJobUnpublishedOnReservationFailure } from "./jobPublicationSync";
import { submitJobPaymentReservationToPaynet } from "./paynetService";
import { logPaymentAudit, logPaymentDiagnostic, PaymentActionType } from "./paymentFlowDiagnostics";
import { shouldApplyReservationWebhookUpdate } from "./paymentStateMachine";

const DEFAULT_RESERVATION_TTL_HOURS = 48;

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function reservationTtlMs(): number {
  const raw = process.env.RESERVATION_PENDING_TTL_HOURS?.trim();
  const hours = raw ? Number.parseFloat(raw) : DEFAULT_RESERVATION_TTL_HOURS;
  if (!Number.isFinite(hours) || hours <= 0) return DEFAULT_RESERVATION_TTL_HOURS * 60 * 60 * 1000;
  return hours * 60 * 60 * 1000;
}

export function computeReservationExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + reservationTtlMs());
}

async function requireAdmin(actorUserId: string): Promise<void> {
  const user = await prisma.users.findUnique({
    where: { Id: actorUserId },
    select: { Role: true },
  });
  if (!user || user.Role !== UserRole.Admin) {
    throw new ServiceError("Doar administratorii pot realiza această acțiune.", 403);
  }
}

export type OrphanReservationRow = Readonly<{
  reservationId: string;
  jobId: string;
  jobStatus: string;
  reservationStatus: string;
  paynetOrderId: string | null;
  createdAt: string | null;
  reservationExpiresAt: string | null;
  issue: string;
}>;

/** Find reservations that look stuck or mismatched with their job. */
export async function findOrphanReservations(actorUserId: string): Promise<{ orphans: OrphanReservationRow[] }> {
  await requireAdmin(actorUserId);

  const rows = await prisma.job_payment_reservations.findMany({
    where: {
      OR: [
        { status: "reserve_pending" },
        { status: "reserve_failed" },
        { AND: [{ status: "reserved" }, { jobs: { status: { in: ["Draft", "draft"] } } }] },
      ],
    },
    select: {
      id: true,
      job_id: true,
      status: true,
      paynet_order_id: true,
      created_at: true,
      reservation_expires_at: true,
      jobs: { select: { status: true } },
    },
    orderBy: { updated_at: "desc" },
    take: 100,
  });

  const now = Date.now();
  const orphans: OrphanReservationRow[] = [];

  for (const r of rows) {
    const jobStatus = norm(r.jobs?.status);
    const rSt = norm(r.status);
    let issue = "";

    if (rSt === "reserve_pending" && !r.paynet_order_id) {
      issue = "reserve_pending_without_paynet_order";
    } else if (rSt === "reserve_pending" && r.reservation_expires_at && r.reservation_expires_at.getTime() < now) {
      issue = "reserve_pending_expired";
    } else if (rSt === "reserved" && jobStatus === "draft") {
      issue = "reserved_job_still_draft";
    } else if (rSt === "reserve_failed" && jobStatus === "open") {
      issue = "reserve_failed_job_open";
    } else if (rSt === "reserve_pending") {
      issue = "reserve_pending_stuck";
    } else {
      continue;
    }

    orphans.push(
      Object.freeze({
        reservationId: String(r.id),
        jobId: String(r.job_id),
        jobStatus: r.jobs?.status ?? "",
        reservationStatus: r.status,
        paynetOrderId: r.paynet_order_id,
        createdAt: r.created_at?.toISOString() ?? null,
        reservationExpiresAt: r.reservation_expires_at?.toISOString() ?? null,
        issue,
      })
    );
  }

  return { orphans };
}

/** Mark expired reserve_pending rows as cancelled and block publish on job. */
export async function expireStaleReservations(actorUserId?: string): Promise<{ expiredCount: number }> {
  if (actorUserId) await requireAdmin(actorUserId);

  const now = new Date();
  const stale = await prisma.job_payment_reservations.findMany({
    where: {
      status: "reserve_pending",
      reservation_expires_at: { lt: now },
    },
    select: { id: true, job_id: true, status: true },
    take: 200,
  });

  let expiredCount = 0;
  for (const row of stale) {
    if (!shouldApplyReservationWebhookUpdate(row.status, "cancelled")) continue;
    await prisma.$transaction(async (tx) => {
      await tx.job_payment_reservations.update({
        where: { id: row.id },
        data: {
          status: "cancelled",
          last_error: "Reservation expired before Paynet confirmation.",
          updated_at: now,
        },
      });
      await markJobUnpublishedOnReservationFailure(
        tx,
        row.job_id,
        "Rezervarea a expirat. Publică din nou jobul.",
        now
      );
    });
    expiredCount += 1;
    await logPaymentAudit(PaymentActionType.RESERVATION_EXPIRED, {
      actorUserId,
      targetJobId: row.job_id,
      summary: `Reservation ${row.id} expired`,
      metadata: { reservationId: row.id },
    });
  }

  if (expiredCount > 0) {
    logPaymentDiagnostic("info", "Expired stale reservations", { expiredCount });
  }

  return { expiredCount };
}

/** Customer-safe: re-submit Paynet for reserve_pending or return existing redirect. */
export async function retryJobReservationPaynetSubmit(
  userId: string,
  jobIdRaw: string
): Promise<
  Readonly<{
    ok: true;
    jobId: number;
    paynetOrderId: string | null;
    redirectUrl: string | null;
    alreadySubmitted: boolean;
    reservationStatus: string;
  }>
> {
  const jobId = Number.parseInt(jobIdRaw, 10);
  if (!Number.isInteger(jobId) || jobId < 1) throw new ServiceError("Job negăsit.", 404);

  const job = await prisma.jobs.findFirst({
    where: { id: jobId, user_id: userId },
    include: { job_payment_reservation: true },
  });
  if (!job) throw new ServiceError("Job negăsit.", 404);

  const res = job.job_payment_reservation;
  if (!res) throw new ServiceError("Nu există rezervare pentru acest job.", 400);

  const rSt = norm(res.status);
  if (rSt === "reserved") {
    throw new ServiceError("Rezervarea este deja confirmată.", 400);
  }
  if (rSt !== "reserve_pending" && rSt !== "reserve_failed") {
    throw new ServiceError(`Nu se poate reîncerca pentru status: ${res.status}`, 400);
  }

  if (rSt === "reserve_failed") {
    await prisma.job_payment_reservations.update({
      where: { id: res.id },
      data: {
        status: "reserve_pending",
        last_error: null,
        reservation_expires_at: computeReservationExpiresAt(),
        updated_at: new Date(),
      },
    });
  }

  const submit = await submitJobPaymentReservationToPaynet(jobId);
  await logPaymentAudit(PaymentActionType.RESERVATION_PAYNET_SUBMITTED, {
    actorUserId: userId,
    targetJobId: jobId,
    summary: "Paynet reservation retry",
    metadata: { paynetOrderId: submit.paynetOrderId, alreadySubmitted: submit.alreadySubmitted },
  });

  return Object.freeze({
    ok: true,
    jobId,
    paynetOrderId: submit.paynetOrderId,
    redirectUrl: submit.redirectUrl,
    alreadySubmitted: submit.alreadySubmitted,
    reservationStatus: submit.status,
  });
}

/** Repair reserved + draft mismatch (same as poll repair). */
export async function reconcileJobReservation(
  actorUserId: string,
  jobIdRaw: string
): Promise<{ ok: true; repaired: boolean; jobStatus: string; reservationStatus: string }> {
  await requireAdmin(actorUserId);
  const jobId = Number.parseInt(jobIdRaw, 10);
  if (!Number.isInteger(jobId) || jobId < 1) throw new ServiceError("Job negăsit.", 404);

  const job = await prisma.jobs.findUnique({
    where: { id: jobId },
    include: { job_payment_reservation: true },
  });
  if (!job) throw new ServiceError("Job negăsit.", 404);

  const res = job.job_payment_reservation;
  if (!res) throw new ServiceError("Rezervare negăsită.", 404);

  let repaired = false;
  if (norm(res.status) === "reserved" && norm(job.status) === "draft") {
    await prisma.$transaction(async (tx) => {
      await markJobPublishedWhenReservationReserved(tx, jobId, new Date());
    });
    repaired = true;
  }

  await expireStaleReservations(actorUserId);

  const refreshed = await prisma.jobs.findUnique({
    where: { id: jobId },
    include: { job_payment_reservation: { select: { status: true } } },
  });

  await logPaymentAudit(PaymentActionType.RESERVATION_RECONCILED, {
    actorUserId,
    targetJobId: jobId,
    summary: repaired ? "Job published from reserved reconciliation" : "Reconciliation run",
    metadata: { repaired },
  });

  return {
    ok: true,
    repaired,
    jobStatus: refreshed?.status ?? job.status,
    reservationStatus: refreshed?.job_payment_reservation?.status ?? res.status,
  };
}

/** Admin: locate reservation by Paynet order id and reconcile job publish state. */
export async function reconcileReservationByPaynetOrderId(
  actorUserId: string,
  paynetOrderIdRaw: string
): Promise<{ ok: true; jobId: number; reservationStatus: string; jobStatus: string; repaired: boolean }> {
  await requireAdmin(actorUserId);
  const paynetOrderId = String(paynetOrderIdRaw ?? "").trim();
  if (!paynetOrderId) throw new ServiceError("paynetOrderId lipsă.", 400);

  const res = await prisma.job_payment_reservations.findFirst({
    where: {
      OR: [{ paynet_order_id: paynetOrderId }, { paynet_transaction_id: paynetOrderId }],
    },
    include: { jobs: { select: { id: true, status: true } } },
  });
  if (!res) throw new ServiceError("Rezervare negăsită pentru acest order id.", 404);

  const result = await reconcileJobReservation(actorUserId, String(res.job_id));
  return {
    ok: true,
    jobId: res.job_id,
    reservationStatus: result.reservationStatus,
    jobStatus: result.jobStatus,
    repaired: result.repaired,
  };
}

/** Re-process last stored webhook event for a reservation (manual recovery). */
export async function replayLastReservationWebhook(
  actorUserId: string,
  reservationIdRaw: string
): Promise<{ ok: true; replayed: boolean; processingStatus?: string }> {
  await requireAdmin(actorUserId);
  const reservationId = Number.parseInt(reservationIdRaw, 10);
  if (!Number.isInteger(reservationId) || reservationId < 1) {
    throw new ServiceError("Rezervare negăsită.", 404);
  }

  const event = await prisma.payment_webhook_events.findFirst({
    where: { job_payment_reservation_id: reservationId },
    orderBy: { created_at: "desc" },
  });
  if (!event?.raw_payload) {
    return { ok: true, replayed: false };
  }

  const { processPaynetWebhook } = await import("./paynetService");
  const result = await processPaynetWebhook({
    headers: { "x-paynet-event-id": `${event.provider_event_id}-replay-${Date.now()}` },
    rawBody: event.raw_payload,
  });

  logPaymentDiagnostic("info", "Manual webhook replay", {
    reservationId,
    result,
  });

  return {
    ok: true,
    replayed: true,
    processingStatus: result.status,
  };
}
