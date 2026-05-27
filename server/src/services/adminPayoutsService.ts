import { Prisma } from "@prisma/client";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { UserRole } from "../enums";
import { assertPayoutTransition } from "./paymentStateMachine";
import { logPaymentAudit, PaymentActionType } from "./paymentFlowDiagnostics";

export type AdminPayoutListItemDto = Readonly<{
  id: string;
  applicationId: string;
  jobTitle: string;
  staffName: string;
  customerName: string;
  amount: string; // net payout
  currency: string;
  payoutDueAt: string | null;
  status: string;
}>;

export type AdminPayoutDetailDto = Readonly<
  AdminPayoutListItemDto & {
    payoutPendingAt: string | null;
    actualMinutesSnapshot: number;
    plannedMinutesSnapshot: number;
    approvedOvertimeMinutes: number;
    overtimeAmount: string;
    grossAmount: string;
    payoutAmount: string;
    lastError: string | null;
    paidAt: string | null;
    failedAt: string | null;
    disputed: boolean;
    payoutProvider: string | null;
    providerPayoutId: string | null;
    providerReference: string | null;
    retryCount: number;
    nextRetryAt: string | null;
    manualOverride: boolean;
    queuedAt: string | null;
    processingStartedAt: string | null;
  }
>;

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function toIso(value: Date | null | undefined): string | null {
  if (value == null) return null;
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function decimalToString(value: Prisma.Decimal | number | string | null | undefined): string {
  if (value == null) return "0.00";
  return new Prisma.Decimal(String(value)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

function resolveCustomerName(user: any): string {
  const bp = user?.business_profiles?.CompanyName?.trim();
  if (bp) return bp;
  const ep = user?.employee_profiles;
  const epName = ep ? [ep.Name, ep.Surname].filter(Boolean).join(" ").trim() : "";
  if (epName) return epName;
  const email = user?.Email?.trim();
  if (email) return email;
  return "Customer";
}

async function requireAdmin(actorUserId: string): Promise<void> {
  if (!actorUserId) throw new ServiceError("Unauthorized", 401);
  const user = await prisma.users.findUnique({
    where: { Id: actorUserId },
    select: { Role: true },
  });
  if (!user || user.Role !== UserRole.Admin) {
    throw new ServiceError("Doar administratorii pot realiza această acțiune.", 403);
  }
}

const allowedStatuses = new Set([
  "payout_pending",
  "payout_queued",
  "payout_processing",
  "retry_pending",
  "paid",
  "failed",
  "reversed",
  "cancelled",
  "disputed",
  "not_started",
  "awaiting_work",
  "in_progress",
  "awaiting_customer_confirmation",
]);

function validateStatusFilter(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const s = norm(String(raw)).toLowerCase();
  if (!s) return undefined;
  if (!allowedStatuses.has(s)) throw new ServiceError("Status invalid.", 400);
  return s;
}

function mapPayoutRow(row: any): AdminPayoutDetailDto {
  const customerName = resolveCustomerName(row.users_application_payouts_customer_users);
  const jobTitle = row.jobs?.Title?.trim() || "Job";
  const staffName = row.applications?.staff_name?.trim() || "Staff";
  const payoutAmountStr = decimalToString(row.payout_amount);
  const overtimeAmountStr = decimalToString(row.overtime_amount_snapshot);
  const net = new Prisma.Decimal(row.payout_amount?.toString?.() ?? "0");
  const gross = net.add(row.overtime_amount_snapshot ?? 0);

  return Object.freeze({
    id: String(row.id),
    applicationId: String(row.application_id),
    jobTitle,
    staffName,
    customerName,
    amount: payoutAmountStr,
    currency: row.currency,
    payoutDueAt: toIso(row.payout_due_at),
    status: row.status,
    payoutPendingAt: toIso(row.payout_pending_at),
    actualMinutesSnapshot: Number(row.actual_minutes_snapshot) || 0,
    plannedMinutesSnapshot: Number(row.planned_minutes_snapshot) || 0,
    approvedOvertimeMinutes: Number(row.approved_overtime_minutes) || 0,
    overtimeAmount: overtimeAmountStr,
    grossAmount: decimalToString(gross),
    payoutAmount: payoutAmountStr,
    lastError: row.last_error ?? null,
    paidAt: toIso(row.paid_at),
    failedAt: toIso(row.failed_at),
    disputed: norm(row.status) === "disputed",
    payoutProvider: row.payout_provider ?? null,
    providerPayoutId: row.provider_payout_id ?? null,
    providerReference: row.provider_reference ?? null,
    retryCount: Number(row.retry_count) || 0,
    nextRetryAt: toIso(row.next_retry_at),
    manualOverride: Boolean(row.manual_override),
    queuedAt: toIso(row.queued_at),
    processingStartedAt: toIso(row.processing_started_at),
  });
}

function normalizeAdminNote(raw: unknown): string | null {
  if (raw == null) return null;
  const s = norm(String(raw));
  if (!s) return null;
  return s.slice(0, 4000);
}

async function loadPayoutForAdmin(actorUserId: string, payoutId: number) {
  await requireAdmin(actorUserId);
  const row = await prisma.application_payouts.findUnique({
    where: { id: payoutId },
    select: {
      id: true,
      application_id: true,
      currency: true,
      status: true,
      payout_due_at: true,
      payout_pending_at: true,
      planned_minutes_snapshot: true,
      actual_minutes_snapshot: true,
      approved_overtime_minutes: true,
      overtime_amount_snapshot: true,
      payout_amount: true,
      paid_at: true,
      failed_at: true,
      last_error: true,
      payout_provider: true,
      provider_payout_id: true,
      provider_reference: true,
      retry_count: true,
      next_retry_at: true,
      manual_override: true,
      queued_at: true,
      processing_started_at: true,
      jobs: { select: { Title: true } },
      applications: { select: { staff_name: true } },
      users_application_payouts_customer_users: {
        select: {
          Email: true,
          business_profiles: { select: { CompanyName: true } },
          employee_profiles: { select: { Name: true, Surname: true } },
        },
      },
    },
  });
  if (!row) throw new ServiceError("Payout negăsit.", 404);
  return row;
}

export async function listAdminPayouts(actorUserId: string, status?: string): Promise<{ payouts: AdminPayoutListItemDto[] }> {
  await requireAdmin(actorUserId);
  const st = validateStatusFilter(status) ?? "payout_pending";

  const rows = await prisma.application_payouts.findMany({
    where: { status: st as any },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      application_id: true,
      currency: true,
      status: true,
      payout_due_at: true,
      payout_pending_at: true,
      planned_minutes_snapshot: true,
      actual_minutes_snapshot: true,
      approved_overtime_minutes: true,
      overtime_amount_snapshot: true,
      payout_amount: true,
      paid_at: true,
      failed_at: true,
      last_error: true,
      payout_provider: true,
      provider_payout_id: true,
      provider_reference: true,
      retry_count: true,
      next_retry_at: true,
      manual_override: true,
      queued_at: true,
      processing_started_at: true,
      jobs: { select: { Title: true } },
      applications: { select: { staff_name: true } },
      users_application_payouts_customer_users: {
        select: {
          Email: true,
          business_profiles: { select: { CompanyName: true } },
          employee_profiles: { select: { Name: true, Surname: true } },
        },
      },
    },
  });

  return {
    payouts: rows.map((r) => mapPayoutRow(r) as any),
  };
}

export async function getAdminPayoutDetail(actorUserId: string, payoutIdRaw: string): Promise<AdminPayoutDetailDto> {
  const payoutId = Number.parseInt(payoutIdRaw, 10);
  if (!Number.isInteger(payoutId) || payoutId < 1) throw new ServiceError("Payout negăsit.", 404);
  const row = await loadPayoutForAdmin(actorUserId, payoutId);
  return mapPayoutRow(row);
}

async function updatePayoutStatusIdempotent(params: {
  actorUserId: string;
  payoutId: number;
  allowedFrom: string[];
  desiredStatus: string;
  idempotentIfAlreadyDesired: boolean;
  updates: Prisma.application_payoutsUpdateInput;
}) {
  const { actorUserId, payoutId, allowedFrom, desiredStatus, idempotentIfAlreadyDesired, updates } = params;
  await requireAdmin(actorUserId);

  const existing = await prisma.application_payouts.findUnique({
    where: { id: payoutId },
    select: { id: true, status: true },
  });
  if (!existing) throw new ServiceError("Payout negăsit.", 404);

  const current = norm(existing.status).toLowerCase();
  if (idempotentIfAlreadyDesired && current === desiredStatus) {
    const full = await loadPayoutForAdmin(actorUserId, payoutId);
    return full;
  }

  const allowed = allowedFrom.map((s) => norm(s).toLowerCase());
  if (!allowed.includes(current)) {
    throw new ServiceError(`Tranziție invalidă pentru status-ul curent (${existing.status}).`, 400);
  }

  const now = new Date();
  const res = await prisma.application_payouts.updateMany({
    where: { id: payoutId, status: { in: allowedFrom as any } },
    data: {
      ...updates,
      updated_at: now,
    },
  });

  if (res.count === 0) {
    const after = await prisma.application_payouts.findUnique({ where: { id: payoutId }, select: { status: true } });
    const afterStatus = norm(after?.status).toLowerCase();
    if (idempotentIfAlreadyDesired && afterStatus === desiredStatus) {
      const full = await loadPayoutForAdmin(actorUserId, payoutId);
      return full;
    }
    throw new ServiceError("Payout status nu a putut fi actualizat (concurență).", 409);
  }

  return await loadPayoutForAdmin(actorUserId, payoutId);
}

export async function markPayoutPaid(actorUserId: string, payoutIdRaw: string, adminNote?: unknown): Promise<AdminPayoutDetailDto> {
  const payoutId = Number.parseInt(payoutIdRaw, 10);
  if (!Number.isInteger(payoutId) || payoutId < 1) throw new ServiceError("Payout negăsit.", 404);

  const note = normalizeAdminNote(adminNote);
  const row = await updatePayoutStatusIdempotent({
    actorUserId,
    payoutId,
    allowedFrom: ["payout_pending", "payout_queued", "payout_processing", "failed", "retry_pending"],
    desiredStatus: "paid",
    idempotentIfAlreadyDesired: true,
    updates: {
      status: "paid" as any,
      paid_at: new Date(),
      failed_at: null,
      last_error: note,
      marked_paid_by_user_id: actorUserId,
      manual_override: true,
    } as Prisma.application_payoutsUpdateInput,
  });
  const dto = mapPayoutRow(row);
  await logPaymentAudit(PaymentActionType.PAYOUT_MARKED_PAID, {
    actorUserId,
    targetApplicationId: row.application_id,
    summary: note ?? "Admin marked payout paid",
    metadata: { payoutId: String(row.id), amount: dto.amount },
  });
  return dto;
}

export async function markPayoutFailed(actorUserId: string, payoutIdRaw: string, adminNote?: unknown): Promise<AdminPayoutDetailDto> {
  const payoutId = Number.parseInt(payoutIdRaw, 10);
  if (!Number.isInteger(payoutId) || payoutId < 1) throw new ServiceError("Payout negăsit.", 404);

  const note = normalizeAdminNote(adminNote);
  const row = await updatePayoutStatusIdempotent({
    actorUserId,
    payoutId,
    allowedFrom: ["payout_pending", "payout_queued", "payout_processing", "retry_pending"],
    desiredStatus: "failed",
    idempotentIfAlreadyDesired: true,
    updates: {
      status: "failed" as any,
      failed_at: new Date(),
      paid_at: null,
      last_error: note,
      manual_override: true,
    },
  });
  const dtoFailed = mapPayoutRow(row);
  await logPaymentAudit(PaymentActionType.PAYOUT_MARKED_FAILED, {
    actorUserId,
    targetApplicationId: row.application_id,
    summary: note ?? "Admin marked payout failed",
    metadata: { payoutId: String(dtoFailed.id) },
  });
  return dtoFailed;
}

export async function markPayoutDisputed(actorUserId: string, payoutIdRaw: string, adminNote?: unknown): Promise<AdminPayoutDetailDto> {
  const payoutId = Number.parseInt(payoutIdRaw, 10);
  if (!Number.isInteger(payoutId) || payoutId < 1) throw new ServiceError("Payout negăsit.", 404);

  const note = normalizeAdminNote(adminNote);
  const row = await updatePayoutStatusIdempotent({
    actorUserId,
    payoutId,
    allowedFrom: ["payout_pending", "payout_queued", "payout_processing", "failed", "retry_pending", "paid"],
    desiredStatus: "disputed",
    idempotentIfAlreadyDesired: true,
    updates: {
      status: "disputed" as any,
      last_error: note,
      manual_override: true,
    },
  });
  const dtoDisputed = mapPayoutRow(row);
  await logPaymentAudit(PaymentActionType.PAYOUT_MARKED_DISPUTED, {
    actorUserId,
    targetApplicationId: row.application_id,
    summary: note ?? "Admin marked payout disputed",
    metadata: { payoutId: String(dtoDisputed.id) },
  });
  return dtoDisputed;
}

/** Admin: queue payout for automation retry (clears next retry gate). */
export async function markPayoutRetryPending(actorUserId: string, payoutIdRaw: string, adminNote?: unknown): Promise<AdminPayoutDetailDto> {
  const payoutId = Number.parseInt(payoutIdRaw, 10);
  if (!Number.isInteger(payoutId) || payoutId < 1) throw new ServiceError("Payout negăsit.", 404);

  await requireAdmin(actorUserId);
  const existing = await prisma.application_payouts.findUnique({
    where: { id: payoutId },
    select: { id: true, status: true, application_id: true },
  });
  if (!existing) throw new ServiceError("Payout negăsit.", 404);

  const current = norm(existing.status);
  assertPayoutTransition(existing.status, "retry_pending", { payoutId, applicationId: existing.application_id });

  const allowedFrom = ["failed", "payout_processing", "retry_pending"];
  if (!allowedFrom.includes(current)) {
    throw new ServiceError(`Retry nu este permis din status-ul curent (${existing.status}).`, 400);
  }

  const note = normalizeAdminNote(adminNote);
  const res = await prisma.application_payouts.updateMany({
    where: { id: payoutId, status: { in: allowedFrom as any } },
    data: {
      status: "retry_pending" as any,
      next_retry_at: null,
      last_error: note ?? null,
      updated_at: new Date(),
    },
  });

  if (res.count === 0) {
    throw new ServiceError("Payout status nu a putut fi actualizat (concurență).", 409);
  }

  const row = await loadPayoutForAdmin(actorUserId, payoutId);
  const dto = mapPayoutRow(row);
  await logPaymentAudit(PaymentActionType.PAYOUT_RETRY_QUEUED, {
    actorUserId,
    targetApplicationId: row.application_id,
    summary: note ?? "Admin queued payout retry",
    metadata: { payoutId: String(row.id) },
  });
  return dto;
}

