import { ServiceError } from "./ServiceError";
import { logPaymentDiagnostic } from "./paymentFlowDiagnostics";

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

/** Allowed reservation status transitions (from → to). */
const RESERVATION_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  reserve_pending: new Set(["reserved", "reserve_failed", "cancelled"]),
  reserved: new Set(["released", "refunded", "cancelled", "disputed"]),
  reserve_failed: new Set(["reserve_pending", "cancelled"]),
  cancelled: new Set(["reserve_pending"]),
  release_pending: new Set(["released", "cancelled"]),
  refund_pending: new Set(["refunded", "cancelled"]),
  released: new Set([]),
  refunded: new Set([]),
  disputed: new Set([]),
  draft: new Set(["reserve_pending"]),
};

/** Allowed payout status transitions. */
const PAYOUT_TRANSITIONS: Record<string, ReadonlySet<string>> = {
  not_started: new Set(["in_progress", "cancelled"]),
  awaiting_work: new Set(["in_progress", "cancelled"]),
  in_progress: new Set(["awaiting_customer_confirmation", "cancelled"]),
  awaiting_customer_confirmation: new Set(["payout_pending", "cancelled"]),
  /** Customer confirmed; automation or admin may advance. */
  payout_pending: new Set(["payout_queued", "payout_processing", "paid", "failed", "disputed", "cancelled"]),
  /** Worker claimed row before calling provider. */
  payout_queued: new Set(["payout_processing", "paid", "failed", "disputed"]),
  /** Provider call in flight; webhook or sync completion updates. */
  payout_processing: new Set(["paid", "failed", "retry_pending", "disputed", "reversed"]),
  /** Retry scheduled after failure or admin action. */
  retry_pending: new Set(["payout_queued", "payout_processing", "paid", "failed", "disputed"]),
  failed: new Set(["retry_pending", "paid", "disputed"]),
  paid: new Set(["reversed", "disputed"]),
  reversed: new Set([]),
  cancelled: new Set([]),
  disputed: new Set([]),
};

export function canTransitionReservation(fromStatus: string, toStatus: string): boolean {
  const from = norm(fromStatus);
  const to = norm(toStatus);
  if (!from || !to) return false;
  if (from === to) return true;
  const allowed = RESERVATION_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.has(to);
}

export function assertReservationTransition(
  fromStatus: string,
  toStatus: string,
  context?: { reservationId?: number; jobId?: number; source?: string }
): void {
  if (canTransitionReservation(fromStatus, toStatus)) return;
  logPaymentDiagnostic("warn", "Invalid reservation transition rejected", {
    from: fromStatus,
    to: toStatus,
    ...context,
  });
  throw new ServiceError(
    `Tranziție rezervare invalidă (${fromStatus} → ${toStatus}).`,
    409
  );
}

/**
 * Webhook-safe: reject regressions (e.g. reserved → reserve_failed) unless explicitly allowed.
 * Returns false if update should be skipped (stale / invalid).
 */
export function shouldApplyReservationWebhookUpdate(
  currentStatus: string,
  nextStatus: string
): boolean {
  const from = norm(currentStatus);
  const to = norm(nextStatus);
  if (!to || from === to) return true;
  if (!canTransitionReservation(from, to)) {
    logPaymentDiagnostic("warn", "Stale or invalid reservation webhook update skipped", {
      from,
      to,
    });
    return false;
  }
  return true;
}

export function canTransitionPayout(fromStatus: string, toStatus: string): boolean {
  const from = norm(fromStatus);
  const to = norm(toStatus);
  if (!from || !to) return false;
  if (from === to) return true;
  const allowed = PAYOUT_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.has(to);
}

export function assertPayoutTransition(
  fromStatus: string,
  toStatus: string,
  context?: { payoutId?: number; applicationId?: number; source?: string }
): void {
  if (canTransitionPayout(fromStatus, toStatus)) return;
  logPaymentDiagnostic("warn", "Invalid payout transition rejected", {
    from: fromStatus,
    to: toStatus,
    ...context,
  });
  throw new ServiceError(`Tranziție plată invalidă (${fromStatus} → ${toStatus}).`, 409);
}

/**
 * Webhook-safe: do not throw when the payout is already terminal or the transition is disallowed.
 * Caller should still mark the provider event processed so retries stop.
 */
export function shouldApplyPayoutWebhookStatusUpdate(
  currentStatus: string,
  nextStatus: string,
  context?: { payoutId?: number; applicationId?: number }
): boolean {
  if (canTransitionPayout(currentStatus, nextStatus)) return true;
  logPaymentDiagnostic("warn", "Stale or invalid payout webhook update skipped", {
    from: norm(currentStatus),
    to: norm(nextStatus),
    source: "payout_webhook",
    ...context,
  });
  return false;
}
