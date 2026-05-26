/**
 * Paynet PSP environment configuration — validation and diagnostics only.
 * Does not perform payment API calls (see paynetService.ts).
 */

export type PaynetEnvKey =
  | "PAYNET_CREATE_ORDER_URL"
  | "PAYNET_RESERVATION_CREATE_ORDER_URL"
  | "PAYNET_MERCHANT_ID"
  | "PAYNET_API_TOKEN"
  | "PAYNET_API_KEY"
  | "PAYNET_WEBHOOK_URL"
  | "PAYNET_RETURN_URL"
  | "PAYNET_WEBHOOK_SECRET"
  | "PAYNET_PAYMENT_REDIRECT_URL_TEMPLATE"
  | "PAYNET_WEBHOOK_SIGNATURE_HEADER"
  | "PAYNET_WEBHOOK_EVENT_ID_HEADER"
  | "PAYNET_WEBHOOK_ORDER_ID_HEADER"
  | "PAYNET_WEBHOOK_STATUS_HEADER"
  | "PAYNET_WEBHOOK_TRANSACTION_ID_HEADER";

/** Keys required to create orders (application payments + job reservations). */
export const PAYNET_ORDER_CREATION_KEYS = [
  "PAYNET_CREATE_ORDER_URL",
  "PAYNET_MERCHANT_ID",
] as const satisfies readonly PaynetEnvKey[];

/** At least one auth credential is required for Paynet HTTP calls. */
export const PAYNET_AUTH_KEYS = ["PAYNET_API_TOKEN", "PAYNET_API_KEY"] as const satisfies readonly PaynetEnvKey[];

/** Required when processing Paynet webhooks. */
export const PAYNET_WEBHOOK_KEYS = ["PAYNET_WEBHOOK_SECRET"] as const satisfies readonly PaynetEnvKey[];

/**
 * Optional: separate reservation order endpoint.
 * When unset, reservations use PAYNET_CREATE_ORDER_URL (see paynetService.resolveCreateOrderUrlForReservation).
 */
export const PAYNET_RESERVATION_URL_KEY = "PAYNET_RESERVATION_CREATE_ORDER_URL" as const;

export function getPaynetEnv(name: PaynetEnvKey | string): string {
  return process.env[name]?.trim() || "";
}

/** True when PAYNET_MOCK_MODE=true is set in the environment (even if ignored in production). */
export function isPaynetMockModeRequested(): boolean {
  return getPaynetEnv("PAYNET_MOCK_MODE").toLowerCase() === "true";
}

/**
 * Local mock Paynet — never active in production, even if PAYNET_MOCK_MODE=true.
 * Skips external API calls; uses simulated webhooks (see paynetMockService.ts).
 */
export function isPaynetMockMode(): boolean {
  if (!isPaynetMockModeRequested()) return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

/** Delay before auto-confirming a mock reservation (ms). 0 = disabled. Default 1500. */
export function getPaynetMockAutoConfirmMs(): number {
  const raw = getPaynetEnv("PAYNET_MOCK_AUTO_CONFIRM_MS");
  if (!raw) return 1500;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 1500;
  return n;
}

export function isPaynetEnvSet(name: PaynetEnvKey | string): boolean {
  return getPaynetEnv(name).length > 0;
}

export function getMissingPaynetOrderCreationKeys(): string[] {
  const missing: string[] = [];
  for (const key of PAYNET_ORDER_CREATION_KEYS) {
    if (!isPaynetEnvSet(key)) missing.push(key);
  }
  const hasAuth = PAYNET_AUTH_KEYS.some((key) => isPaynetEnvSet(key));
  if (!hasAuth) {
    missing.push(`${PAYNET_AUTH_KEYS.join(" or ")} (set at least one)`);
  }
  return missing;
}

export function getMissingPaynetWebhookKeys(): string[] {
  return PAYNET_WEBHOOK_KEYS.filter((key) => !isPaynetEnvSet(key));
}

export function formatPaynetConfigDiagnostic(missing: string[], context?: string): string {
  const scope = context ? ` (${context})` : "";
  const list = missing.join(", ");
  return (
    `Configurare Paynet incompletă${scope}. Lipsesc: ${list}. ` +
    `Copiază server/.env.example în server/.env și completează valorile sandbox/producție Paynet. ` +
    `PAYNET_RESERVATION_CREATE_ORDER_URL este opțional (implicit folosește PAYNET_CREATE_ORDER_URL).`
  );
}

export type PaynetConfigReport = {
  ok: boolean;
  mockMode: boolean;
  mockModeRequested: boolean;
  orderCreationReady: boolean;
  webhookReady: boolean;
  missingOrderCreation: string[];
  missingWebhook: string[];
  /** Non-secret flags only (never expose token/secret values). */
  configured: Record<string, boolean>;
  reservationUsesDedicatedUrl: boolean;
  reservationOrderUrlSource: "PAYNET_RESERVATION_CREATE_ORDER_URL" | "PAYNET_CREATE_ORDER_URL" | "missing";
  doc: string;
};

export function getPaynetConfigReport(): PaynetConfigReport {
  const missingOrderCreation = getMissingPaynetOrderCreationKeys();
  const missingWebhook = getMissingPaynetWebhookKeys();

  const hasReservationUrl = isPaynetEnvSet(PAYNET_RESERVATION_URL_KEY);
  const hasCreateUrl = isPaynetEnvSet("PAYNET_CREATE_ORDER_URL");
  let reservationOrderUrlSource: PaynetConfigReport["reservationOrderUrlSource"] = "missing";
  if (hasReservationUrl) reservationOrderUrlSource = "PAYNET_RESERVATION_CREATE_ORDER_URL";
  else if (hasCreateUrl) reservationOrderUrlSource = "PAYNET_CREATE_ORDER_URL";

  const allKeys: PaynetEnvKey[] = [
    "PAYNET_CREATE_ORDER_URL",
    "PAYNET_RESERVATION_CREATE_ORDER_URL",
    "PAYNET_MERCHANT_ID",
    "PAYNET_API_TOKEN",
    "PAYNET_API_KEY",
    "PAYNET_WEBHOOK_URL",
    "PAYNET_RETURN_URL",
    "PAYNET_WEBHOOK_SECRET",
    "PAYNET_PAYMENT_REDIRECT_URL_TEMPLATE",
    "PAYNET_WEBHOOK_SIGNATURE_HEADER",
    "PAYNET_WEBHOOK_EVENT_ID_HEADER",
    "PAYNET_WEBHOOK_ORDER_ID_HEADER",
    "PAYNET_WEBHOOK_STATUS_HEADER",
    "PAYNET_WEBHOOK_TRANSACTION_ID_HEADER",
  ];

  const configured: Record<string, boolean> = {};
  for (const key of allKeys) {
    configured[key] = isPaynetEnvSet(key);
  }

  const mockMode = isPaynetMockMode();
  const orderCreationReady = mockMode || missingOrderCreation.length === 0;
  const webhookReady = mockMode || missingWebhook.length === 0;

  return {
    ok: orderCreationReady && webhookReady,
    mockMode,
    mockModeRequested: isPaynetMockModeRequested(),
    orderCreationReady,
    webhookReady,
    missingOrderCreation,
    missingWebhook,
    configured,
    reservationUsesDedicatedUrl: hasReservationUrl,
    reservationOrderUrlSource,
    doc: "See server/.env.example — PAYNET_* block",
  };
}

export function assertPaynetOrderCreationConfig(context?: string): void {
  const missing = getMissingPaynetOrderCreationKeys();
  if (missing.length > 0) {
    const err = new Error(formatPaynetConfigDiagnostic(missing, context));
    (err as Error & { code?: string; missing?: string[] }).code = "PAYNET_CONFIG_INCOMPLETE";
    (err as Error & { missing?: string[] }).missing = missing;
    throw err;
  }
}

export function assertPaynetWebhookConfig(context?: string): void {
  const missing = getMissingPaynetWebhookKeys();
  if (missing.length > 0) {
    const err = new Error(formatPaynetConfigDiagnostic(missing, context));
    (err as Error & { code?: string; missing?: string[] }).code = "PAYNET_CONFIG_INCOMPLETE";
    (err as Error & { missing?: string[] }).missing = missing;
    throw err;
  }
}

/** Logs a startup banner when Paynet is not fully configured (does not stop the server). */
export function logPaynetConfigAtStartup(): void {
  if (isPaynetMockModeRequested() && process.env.NODE_ENV === "production") {
    console.error("[Paynet MOCK] PAYNET_MOCK_MODE is set but ignored in production.");
  }
  if (isPaynetMockMode()) {
    const delay = getPaynetMockAutoConfirmMs();
    console.warn("[Paynet MOCK] Enabled — external Paynet API calls are skipped.");
    console.warn(
      `[Paynet MOCK] Reservations auto-confirm after ${delay}ms (set PAYNET_MOCK_AUTO_CONFIRM_MS=0 to disable).`
    );
    console.warn("[Paynet MOCK] Manual confirm: POST /api/dev/paynet/mock-reservation-success/:jobId");
    return;
  }

  const report = getPaynetConfigReport();
  if (report.ok) {
    console.log("[Paynet] Configuration OK (order creation + webhooks).");
    if (report.reservationUsesDedicatedUrl) {
      console.log("[Paynet] Reservations use PAYNET_RESERVATION_CREATE_ORDER_URL.");
    } else {
      console.log("[Paynet] Reservations use PAYNET_CREATE_ORDER_URL (no dedicated reservation URL).");
    }
    return;
  }

  console.warn("[Paynet] Configuration incomplete — payment features will fail until .env is updated.");
  if (!report.orderCreationReady) {
    console.warn("[Paynet]   Order creation missing:", report.missingOrderCreation.join(", "));
  }
  if (!report.webhookReady) {
    console.warn("[Paynet]   Webhooks missing:", report.missingWebhook.join(", "));
  }
  console.warn("[Paynet]   Template: server/.env.example (PAYNET_* section)");
}
