import type { TFunction } from "i18next";

export type ApplicationPayoutSummary = {
  status: string;
  netPayoutAmount: string;
  currency: string;
  payoutDueAt?: string | null;
  payoutPendingAt?: string | null;
};

export type ApplicationPayoutUiPhase =
  | "awaiting_customer_confirmation"
  | "payout_pending"
  | "payout_automation"
  | "paid"
  | "failed"
  | "disputed"
  | "in_progress"
  | "cancelled"
  | "other";

export function normalizePayoutStatus(raw?: string | null): string {
  return String(raw ?? "").trim().toLowerCase();
}

export function payoutUiPhase(status?: string | null): ApplicationPayoutUiPhase {
  const s = normalizePayoutStatus(status);
  if (s === "awaiting_customer_confirmation") return "awaiting_customer_confirmation";
  if (s === "payout_pending") return "payout_pending";
  if (s === "payout_queued" || s === "payout_processing" || s === "retry_pending" || s === "reversed") {
    return "payout_automation";
  }
  if (s === "paid") return "paid";
  if (s === "failed") return "failed";
  if (s === "disputed") return "disputed";
  if (s === "in_progress" || s === "awaiting_work") return "in_progress";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  return "other";
}

export function payoutStatusLabel(status: string | null | undefined, t: TFunction): string {
  switch (payoutUiPhase(status)) {
    case "awaiting_customer_confirmation":
      return t("dashboard.payoutAwaitingCustomer", "Awaiting customer confirmation");
    case "payout_pending":
      return t("dashboard.payoutPendingBadge", "Payout pending");
    case "payout_automation":
      return t("dashboard.payoutAutomationBadge", "Payout processing");
    case "paid":
      return t("dashboard.payoutPaid", "Paid");
    case "failed":
      return t("dashboard.payoutFailed", "Failed");
    case "disputed":
      return t("dashboard.payoutDisputed", "Disputed");
    case "in_progress":
      return t("dashboard.payoutInProgress", "Work in progress");
    case "cancelled":
      return t("dashboard.payoutCancelled", "Cancelled");
    default:
      return status ? String(status) : t("dashboard.payoutUnknown", "Payout status unknown");
  }
}

export function payoutStatusClassName(status: string | null | undefined): string {
  switch (payoutUiPhase(status)) {
    case "awaiting_customer_confirmation":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "payout_pending":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "payout_automation":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "paid":
      return "bg-green-100 text-green-800 border-green-200";
    case "failed":
      return "bg-rose-100 text-rose-800 border-rose-200";
    case "disputed":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "in_progress":
      return "bg-sky-100 text-sky-800 border-sky-200";
    case "cancelled":
      return "bg-gray-100 text-gray-700 border-gray-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

/** Staff-facing short label for the work/payout pipeline. */
export function staffPayoutPipelineLabel(
  params: {
    checkedOutAt?: string | null;
    payoutStatus?: string | null;
    jobOpen?: boolean;
  },
  t: TFunction
): string | null {
  const phase = payoutUiPhase(params.payoutStatus);
  if (phase === "paid") return t("dashboard.staffPayoutPaid", "Paid");
  if (phase === "payout_pending") {
    return t("dashboard.staffPayoutPending72h", "Payout pending — up to 72h");
  }
  if (phase === "payout_automation") {
    return t("dashboard.staffPayoutAutomation", "Payout in progress (automation)");
  }
  if (phase === "awaiting_customer_confirmation" || (params.checkedOutAt && phase === "in_progress")) {
    return t("dashboard.staffWaitingCustomerConfirm", "Waiting for customer confirmation");
  }
  if (!params.checkedOutAt && params.jobOpen !== false) {
    return t("dashboard.staffFundsReserved", "Funds reserved");
  }
  if (phase === "failed") return t("dashboard.payoutFailed", "Failed");
  if (phase === "disputed") return t("dashboard.payoutDisputed", "Disputed");
  return null;
}

export type JobPublishUiState = "draft" | "reservation_pending" | "open" | "reservation_failed";

export function jobPublishUiState(jobStatus: string, reservationStatus?: string | null): JobPublishUiState {
  const js = String(jobStatus ?? "").trim().toLowerCase();
  const rs = normalizePayoutStatus(reservationStatus);
  if (js === "open") return "open";
  if (rs === "reserve_failed") return "reservation_failed";
  if (rs === "reserve_pending" || rs === "reserved") return "reservation_pending";
  return "draft";
}

/** Whether customer can retry Paynet redirect for this publish state. */
export function canRetryJobReservationPublish(state: JobPublishUiState): boolean {
  return state === "reservation_pending" || state === "reservation_failed";
}

export function jobPublishStatusLabel(state: JobPublishUiState, t: TFunction): string {
  switch (state) {
    case "open":
      return t("dashboard.jobStatusOpen", "Open");
    case "reservation_pending":
      return t("dashboard.jobReservationPending", "Reservation pending");
    case "reservation_failed":
      return t("dashboard.jobReservationFailed", "Reservation failed");
    default:
      return t("dashboard.jobStatusDraft", "Draft");
  }
}

export function jobPublishStatusClassName(state: JobPublishUiState): string {
  switch (state) {
    case "open":
      return "bg-green-100 text-green-800 border-green-200";
    case "reservation_pending":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "reservation_failed":
      return "bg-rose-100 text-rose-800 border-rose-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}
