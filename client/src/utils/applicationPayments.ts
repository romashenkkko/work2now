export type ApplicationPaymentUiStatus = "awaiting_payment" | "paynet_pending" | "paid" | "failed" | "unknown";

export type ApplicationPaymentSnapshot = {
  applicationId: string;
  status: string;
  uiStatus: ApplicationPaymentUiStatus;
  paynetOrderId?: string | null;
  paymentId?: string | null;
  amountDue?: string | null;
  currency?: string | null;
  paymentStartedAt?: string | null;
  paidAt?: string | null;
  failedAt?: string | null;
  lastError?: string | null;
  updatedAt: string;
};

export type ApplicationPaymentApiResponse = {
  payment: {
    id: string;
    applicationId: string;
    status: string;
    currency: string;
    workedMinutes: number;
    hourlyRateSnapshot: string;
    amountDue: string;
    paynetOrderId: string | null;
    customerConfirmedAt: string | null;
    paymentStartedAt: string | null;
    paidAt: string | null;
    failedAt?: string | null;
    lastError?: string | null;
  };
  paynet: {
    provider: "paynet";
    mode: "server-server";
    orderId: string | null;
    redirectUrl: string;
  };
};

export function normalizeApplicationPaymentStatus(rawStatus?: string | null): ApplicationPaymentUiStatus {
  const status = String(rawStatus ?? "").trim().toLowerCase();
  if (!status) return "unknown";
  if (["draft", "awaiting_payment", "awaiting-payment", "awaiting payment", "created"].includes(status)) {
    return "awaiting_payment";
  }
  if (["paynet_pending", "paynet-pending", "pending", "processing", "in_progress", "in-progress"].includes(status)) {
    return "paynet_pending";
  }
  if (["paid", "success", "succeeded", "completed", "done", "confirmed"].includes(status)) {
    return "paid";
  }
  if (["failed", "cancelled", "canceled", "error", "rejected", "declined", "void"].includes(status)) {
    return "failed";
  }
  return "unknown";
}

export function snapshotApplicationPayment(apiResponse: ApplicationPaymentApiResponse): ApplicationPaymentSnapshot {
  return {
    applicationId: apiResponse.payment.applicationId,
    status: apiResponse.payment.status,
    uiStatus: normalizeApplicationPaymentStatus(apiResponse.payment.status),
    paymentId: apiResponse.payment.id,
    paynetOrderId: apiResponse.payment.paynetOrderId,
    amountDue: apiResponse.payment.amountDue,
    currency: apiResponse.payment.currency,
    paymentStartedAt: apiResponse.payment.paymentStartedAt,
    paidAt: apiResponse.payment.paidAt,
    failedAt: apiResponse.payment.failedAt ?? null,
    lastError: apiResponse.payment.lastError ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export function paymentStatusLabel(status: ApplicationPaymentUiStatus): string {
  switch (status) {
    case "awaiting_payment":
      return "awaiting payment";
    case "paynet_pending":
      return "paynet pending";
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    default:
      return "payment unknown";
  }
}

export function paymentStatusClassName(status: ApplicationPaymentUiStatus): string {
  switch (status) {
    case "awaiting_payment":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "paynet_pending":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "paid":
      return "bg-green-100 text-green-800 border-green-200";
    case "failed":
      return "bg-rose-100 text-rose-800 border-rose-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export function paymentStorageKey(userId: string): string {
  return `work2now_payment_cache_${String(userId).trim()}`;
}

export function loadPaymentCache(userId: string): Record<string, ApplicationPaymentSnapshot> {
  if (!userId?.trim() || typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(paymentStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { entries?: Record<string, ApplicationPaymentSnapshot> };
    return parsed?.entries && typeof parsed.entries === "object" ? parsed.entries : {};
  } catch {
    return {};
  }
}

export function savePaymentSnapshot(userId: string, snapshot: ApplicationPaymentSnapshot): Record<string, ApplicationPaymentSnapshot> {
  if (!userId?.trim() || typeof window === "undefined") return {};
  const next = { ...loadPaymentCache(userId), [snapshot.applicationId]: snapshot };
  try {
    localStorage.setItem(paymentStorageKey(userId), JSON.stringify({ entries: next }));
  } catch {
    /* ignore */
  }
  return next;
}

export function removePaymentSnapshot(userId: string, applicationId: string): Record<string, ApplicationPaymentSnapshot> {
  if (!userId?.trim() || typeof window === "undefined") return {};
  const next = { ...loadPaymentCache(userId) };
  delete next[String(applicationId).trim()];
  try {
    localStorage.setItem(paymentStorageKey(userId), JSON.stringify({ entries: next }));
  } catch {
    /* ignore */
  }
  return next;
}
