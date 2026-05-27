import { addActivityLog } from "./activityLogService";

/** Activity log action types for payment / reservation / payout MVP. */
export const PaymentActionType = {
  RESERVATION_CREATED: "RESERVATION_CREATED",
  RESERVATION_PAYNET_SUBMITTED: "RESERVATION_PAYNET_SUBMITTED",
  RESERVATION_RESERVED: "RESERVATION_RESERVED",
  RESERVATION_FAILED: "RESERVATION_FAILED",
  RESERVATION_CANCELLED: "RESERVATION_CANCELLED",
  RESERVATION_EXPIRED: "RESERVATION_EXPIRED",
  RESERVATION_RECONCILED: "RESERVATION_RECONCILED",
  PAYOUT_AWAITING_CUSTOMER: "PAYOUT_AWAITING_CUSTOMER",
  PAYOUT_PENDING: "PAYOUT_PENDING",
  PAYOUT_MARKED_PAID: "PAYOUT_MARKED_PAID",
  PAYOUT_MARKED_FAILED: "PAYOUT_MARKED_FAILED",
  PAYOUT_MARKED_DISPUTED: "PAYOUT_MARKED_DISPUTED",
  PAYOUT_QUEUED: "PAYOUT_QUEUED",
  PAYOUT_PROCESSING: "PAYOUT_PROCESSING",
  PAYOUT_PROVIDER_SUBMITTED: "PAYOUT_PROVIDER_SUBMITTED",
  PAYOUT_AUTOMATION_PAID: "PAYOUT_AUTOMATION_PAID",
  PAYOUT_AUTOMATION_FAILED: "PAYOUT_AUTOMATION_FAILED",
  PAYOUT_RETRY_QUEUED: "PAYOUT_RETRY_QUEUED",
  PAYOUT_WEBHOOK_PROCESSED: "PAYOUT_WEBHOOK_PROCESSED",
  PAYOUT_TRANSITION_REJECTED: "PAYOUT_TRANSITION_REJECTED",
  RESERVATION_TRANSITION_REJECTED: "RESERVATION_TRANSITION_REJECTED",
  WEBHOOK_PROCESSING_FAILED: "WEBHOOK_PROCESSING_FAILED",
} as const;

export type PaymentAuditContext = Readonly<{
  actorUserId?: string;
  targetJobId?: number | null;
  targetApplicationId?: number | null;
  jobTitle?: string | null;
  staffName?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}>;

function metadataJson(meta?: Record<string, unknown>): string | null {
  if (!meta || Object.keys(meta).length === 0) return null;
  try {
    return JSON.stringify(meta).slice(0, 4000);
  } catch {
    return null;
  }
}

/** Fire-and-forget audit row + structured console line for ops. */
export async function logPaymentAudit(
  actionType: string,
  ctx: PaymentAuditContext = {}
): Promise<void> {
  const line = {
    actionType,
    jobId: ctx.targetJobId ?? null,
    applicationId: ctx.targetApplicationId ?? null,
    summary: ctx.summary ?? null,
    metadata: ctx.metadata ?? null,
  };
  console.info("[PaymentFlow]", JSON.stringify(line));

  await addActivityLog({
    actorUserId: ctx.actorUserId,
    actionType,
    targetType: ctx.targetApplicationId != null ? "application" : "job",
    targetJobId: ctx.targetJobId ?? null,
    targetApplicationId: ctx.targetApplicationId ?? null,
    staffName: ctx.staffName ?? null,
    jobTitle: ctx.jobTitle ?? null,
    summary: ctx.summary ?? null,
    metadata: metadataJson(ctx.metadata),
  });
}

export function logPaymentDiagnostic(
  level: "info" | "warn" | "error",
  message: string,
  details?: Record<string, unknown>
): void {
  const payload = details ? { message, ...details } : { message };
  if (level === "error") {
    console.error("[PaymentFlow]", payload);
  } else if (level === "warn") {
    console.warn("[PaymentFlow]", payload);
  } else {
    console.info("[PaymentFlow]", payload);
  }
}
