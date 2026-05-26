import crypto from "crypto";
import { prisma } from "../prismaClient";
import { getPaynetMockAutoConfirmMs, isPaynetMockMode } from "../config/paynetConfig";
import { ServiceError } from "./ServiceError";

export type MockPaynetOrderResult = Readonly<{
  paynetOrderId: string;
  redirectUrl: string;
  rawResponse: unknown;
}>;

export type MockPaynetReservationOrderRequest = {
  reservationId: number;
  jobId: number;
  merchantOrderId: string;
};

export type MockPaynetOrderRequest = {
  paymentId: number;
  applicationId: number;
  merchantOrderId: string;
};

/** HMAC secret for mock webhook payloads only (local dev). */
export const PAYNET_MOCK_WEBHOOK_SECRET = "work2now-paynet-mock-local-only";

const scheduledReservationConfirms = new Set<number>();

export function mockPaynetLog(message: string, meta?: Record<string, unknown>): void {
  if (meta) {
    console.log(`[Paynet MOCK] ${message}`, meta);
  } else {
    console.log(`[Paynet MOCK] ${message}`);
  }
}

function assertMockMode(): void {
  if (!isPaynetMockMode()) {
    throw new ServiceError("Paynet mock mode is not enabled.", 403);
  }
}

function defaultFrontendOrigin(): string {
  const fromEnv = process.env.PAYNET_MOCK_REDIRECT_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const port = process.env.VITE_PORT || "5500";
  return `http://localhost:${port}`;
}

export function buildMockReservationRedirectUrl(jobId: number, paynetOrderId: string): string {
  const base = defaultFrontendOrigin();
  const q = new URLSearchParams({
    paynetMock: "reservation",
    jobId: String(jobId),
    orderId: paynetOrderId,
  });
  return `${base}/dashboard?${q.toString()}`;
}

export function buildMockApplicationRedirectUrl(applicationId: number, paynetOrderId: string): string {
  const base = defaultFrontendOrigin();
  const q = new URLSearchParams({
    paynetMock: "payment",
    applicationId: String(applicationId),
    orderId: paynetOrderId,
  });
  return `${base}/dashboard?${q.toString()}`;
}

export function createMockReservationOrderResult(request: MockPaynetReservationOrderRequest): MockPaynetOrderResult {
  const paynetOrderId = `MOCK-RES-${request.reservationId}-${Date.now()}`;
  const redirectUrl = buildMockReservationRedirectUrl(request.jobId, paynetOrderId);
  mockPaynetLog("Created mock reservation order (no external API)", {
    reservationId: request.reservationId,
    jobId: request.jobId,
    paynetOrderId,
    merchantOrderId: request.merchantOrderId,
  });
  return Object.freeze({
    paynetOrderId,
    redirectUrl,
    rawResponse: { mock: true, kind: "job_payment_reservation", merchantOrderId: request.merchantOrderId },
  });
}

export function createMockApplicationOrderResult(request: MockPaynetOrderRequest): MockPaynetOrderResult {
  const paynetOrderId = `MOCK-PMT-${request.paymentId}-${Date.now()}`;
  const redirectUrl = buildMockApplicationRedirectUrl(request.applicationId, paynetOrderId);
  mockPaynetLog("Created mock application payment order (no external API)", {
    paymentId: request.paymentId,
    applicationId: request.applicationId,
    paynetOrderId,
  });
  return Object.freeze({
    paynetOrderId,
    redirectUrl,
    rawResponse: { mock: true, kind: "application_payment", merchantOrderId: request.merchantOrderId },
  });
}

export function signMockWebhookBody(rawBody: string): string {
  return crypto.createHmac("sha256", PAYNET_MOCK_WEBHOOK_SECRET).update(rawBody, "utf8").digest("hex");
}

export function buildMockWebhookHeaders(rawBody: string): Record<string, string> {
  return {
    "x-paynet-signature": signMockWebhookBody(rawBody),
    "x-paynet-event-id": `mock-${crypto.randomUUID()}`,
    "x-paynet-mock": "1",
  };
}

export function isMockWebhookSignatureValid(rawBody: string, received: string | null): boolean {
  if (!isPaynetMockMode() || !received) return false;
  const normalized = received.replace(/^sha256=/i, "").replace(/^v1=/i, "").trim();
  const expected = signMockWebhookBody(rawBody);
  const receivedBuf = Buffer.from(normalized, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  return receivedBuf.length === expectedBuf.length && crypto.timingSafeEqual(receivedBuf, expectedBuf);
}

/**
 * Simulates Paynet webhook: reserve_pending → reserved (same path as production webhook).
 */
export async function mockConfirmReservationSuccess(jobId: number): Promise<{
  ok: true;
  jobId: number;
  skipped: boolean;
  reservationStatus?: string;
  webhook: unknown;
}> {
  assertMockMode();

  if (!Number.isInteger(jobId) || jobId < 1) {
    throw new ServiceError("Job not found.", 404);
  }

  const reservation = await prisma.job_payment_reservations.findUnique({
    where: { job_id: jobId },
    select: { id: true, job_id: true, status: true, paynet_order_id: true },
  });

  if (!reservation) {
    throw new ServiceError("Payment reservation not found for this job.", 404);
  }

  const st = String(reservation.status ?? "").trim().toLowerCase();
  if (st === "reserved") {
    mockPaynetLog("Reservation already reserved — skipping mock webhook", { jobId });
    return {
      ok: true,
      jobId,
      skipped: true,
      reservationStatus: reservation.status,
      webhook: { ok: true, duplicate: false, processed: false, entity: "reservation", status: "already_reserved" },
    };
  }

  if (st !== "reserve_pending") {
    throw new ServiceError(`Cannot mock-confirm reservation in status: ${reservation.status}`, 400);
  }

  const merchantOrderId = `W2N-RES-${reservation.id}`;
  const paynetOrderId = reservation.paynet_order_id ?? `MOCK-RES-${reservation.id}`;
  const rawPayload = JSON.stringify({
    eventId: `mock-reservation-${reservation.id}-${Date.now()}`,
    eventType: "payment_status",
    merchantOrderId,
    paynetOrderId,
    orderId: paynetOrderId,
    status: "paid",
    transactionId: `MOCK-TXN-RES-${Date.now()}`,
    metadata: { kind: "job_payment_reservation", mock: true },
  });

  mockPaynetLog("Delivering mock reservation paid webhook", { jobId, paynetOrderId, merchantOrderId });

  const { processPaynetWebhook } = await import("./paynetService");
  const webhook = await processPaynetWebhook({
    headers: buildMockWebhookHeaders(rawPayload),
    rawBody: rawPayload,
  });

  const updated = await prisma.job_payment_reservations.findUnique({
    where: { job_id: jobId },
    select: { status: true },
  });

  return {
    ok: true,
    jobId,
    skipped: false,
    reservationStatus: updated?.status,
    webhook,
  };
}

export function scheduleMockReservationAutoConfirm(jobId: number): void {
  if (!isPaynetMockMode()) return;

  const delayMs = getPaynetMockAutoConfirmMs();
  if (delayMs <= 0) {
    mockPaynetLog("Auto-confirm disabled (PAYNET_MOCK_AUTO_CONFIRM_MS=0)", { jobId });
    return;
  }

  if (scheduledReservationConfirms.has(jobId)) return;
  scheduledReservationConfirms.add(jobId);

  mockPaynetLog(`Scheduling auto-confirm in ${delayMs}ms`, { jobId });

  setTimeout(() => {
    scheduledReservationConfirms.delete(jobId);
    mockConfirmReservationSuccess(jobId).catch((err) => {
      console.error("[Paynet MOCK] Auto-confirm failed", { jobId, err });
    });
  }, delayMs);
}

export async function mockConfirmApplicationPaymentSuccess(applicationId: number): Promise<{
  ok: true;
  applicationId: number;
  skipped: boolean;
  paymentStatus?: string;
  webhook: unknown;
}> {
  assertMockMode();

  const paymentDb = prisma as typeof prisma & {
    application_payments: {
      findUnique: (args: unknown) => Promise<{
        id: number;
        application_id: number;
        status: string;
        paynet_order_id: string | null;
      } | null>;
    };
  };

  const payment = await paymentDb.application_payments.findUnique({
    where: { application_id: applicationId },
    select: { id: true, application_id: true, status: true, paynet_order_id: true },
  });

  if (!payment) {
    throw new ServiceError("Application payment not found.", 404);
  }

  if (payment.status === "paid") {
    return {
      ok: true,
      applicationId,
      skipped: true,
      paymentStatus: payment.status,
      webhook: { ok: true, duplicate: false, processed: false, entity: "payment", status: "already_paid" },
    };
  }

  const merchantOrderId = `W2N-PMT-${payment.id}`;
  const paynetOrderId = payment.paynet_order_id ?? merchantOrderId;
  const rawPayload = JSON.stringify({
    eventId: `mock-payment-${payment.id}-${Date.now()}`,
    eventType: "payment_status",
    merchantOrderId,
    paynetOrderId,
    orderId: paynetOrderId,
    status: "paid",
    transactionId: `MOCK-TXN-PMT-${Date.now()}`,
    metadata: { kind: "application_payment", mock: true },
  });

  mockPaynetLog("Delivering mock application paid webhook", { applicationId, paynetOrderId });

  const { processPaynetWebhook } = await import("./paynetService");
  const webhook = await processPaynetWebhook({
    headers: buildMockWebhookHeaders(rawPayload),
    rawBody: rawPayload,
  });

  const updated = await paymentDb.application_payments.findUnique({
    where: { id: payment.id },
    select: { status: true },
  });

  return {
    ok: true,
    applicationId,
    skipped: false,
    paymentStatus: updated?.status,
    webhook,
  };
}

export function scheduleMockApplicationPaymentAutoConfirm(applicationId: number): void {
  if (!isPaynetMockMode()) return;
  const delayMs = getPaynetMockAutoConfirmMs();
  if (delayMs <= 0) return;

  setTimeout(() => {
    mockConfirmApplicationPaymentSuccess(applicationId).catch((err) => {
      console.error("[Paynet MOCK] Application auto-confirm failed", { applicationId, err });
    });
  }, delayMs);
}
