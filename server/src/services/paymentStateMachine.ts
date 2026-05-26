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
  payout_pending: new Set(["paid", "failed", "disputed"]),
  failed: new Set(["paid", "disputed", "payout_pending"]),
  paid: new Set([]),
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
