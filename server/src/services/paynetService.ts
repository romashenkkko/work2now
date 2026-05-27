/**
 * Paynet PSP — server-to-server only.
 * Environment variables: see `src/config/paynetConfig.ts` and `server/.env.example`.
 */
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import {
  assertPaynetOrderCreationConfig,
  assertPaynetWebhookConfig,
  getPaynetEnv,
  isPaynetMockMode,
  PAYNET_RESERVATION_URL_KEY,
} from "../config/paynetConfig";
import {
  createMockApplicationOrderResult,
  createMockReservationOrderResult,
  isMockWebhookSignatureValid,
  scheduleMockApplicationPaymentAutoConfirm,
  scheduleMockReservationAutoConfirm,
} from "./paynetMockService";
import { debugPublishReserve } from "../utils/publishReserveDebug";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { markJobPublishedWhenReservationReserved, markJobUnpublishedOnReservationFailure } from "./jobPublicationSync";
import { logPaymentAudit, logPaymentDiagnostic, PaymentActionType } from "./paymentFlowDiagnostics";
import { shouldApplyReservationWebhookUpdate } from "./paymentStateMachine";

const paymentDb = prisma as any;

type PaynetHeaderMap = Record<string, string | string[] | undefined>;

export type PaynetOrderRequest = {
  paymentId: number;
  applicationId: number;
  merchantOrderId: string;
  amountDue: Prisma.Decimal | string | number;
  currency: string;
  customerUserId: string;
  staffUserId: string;
};

/** Server-server reservation (job publish) — distinct merchant reference from application payments. */
export type PaynetReservationOrderRequest = {
  reservationId: number;
  jobId: number;
  merchantOrderId: string;
  reservedAmount: Prisma.Decimal | string | number;
  currency: string;
  customerUserId: string;
};

export type PaynetOrderResult = Readonly<{
  paynetOrderId: string;
  redirectUrl: string;
  rawResponse: unknown;
}>;

export type PaynetWebhookProcessResult = Readonly<{
  ok: true;
  duplicate: boolean;
  processed: boolean;
  entity?: "payment" | "reservation" | "none";
  paymentId?: string;
  reservationId?: string;
  status?: string;
}>;

function env(name: string, fallback = ""): string {
  return getPaynetEnv(name) || fallback;
}

function paynetConfigError(error: unknown): ServiceError {
  const message = error instanceof Error ? error.message : "Configurare Paynet incompletă.";
  return new ServiceError(message, 503);
}

function requiredEnv(name: string): string {
  const value = env(name);
  if (!value) {
    if (name.startsWith("PAYNET_")) {
      try {
        if (name === "PAYNET_WEBHOOK_SECRET") {
          assertPaynetWebhookConfig("webhook Paynet");
        } else {
          assertPaynetOrderCreationConfig(`variabila ${name}`);
        }
      } catch (configErr) {
        throw paynetConfigError(configErr);
      }
    }
    throw new ServiceError(`${name} is required.`, 503);
  }
  return value;
}

function decimalToString(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(String(value)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new ServiceError("Paynet returned invalid JSON.", 502);
  }
}

function getNestedValue(obj: unknown, paths: string[][]): unknown {
  for (const pathParts of paths) {
    let current: unknown = obj;
    let ok = true;
    for (const part of pathParts) {
      if (!current || typeof current !== "object") {
        ok = false;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (ok && current != null) return current;
  }
  return undefined;
}

function getStringValue(obj: unknown, paths: string[][]): string | null {
  const value = getNestedValue(obj, paths);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function getHeaderValue(headers: PaynetHeaderMap, name: string): string | null {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== target) continue;
    if (Array.isArray(value)) return value[0]?.trim() || null;
    return value?.trim() || null;
  }
  return null;
}

function getWebhookSignature(rawBody: string, headers: PaynetHeaderMap): boolean {
  const headerName = env("PAYNET_WEBHOOK_SIGNATURE_HEADER", "x-paynet-signature");
  const receivedEarly = getHeaderValue(headers, headerName);
  if (isPaynetMockMode() && isMockWebhookSignatureValid(rawBody, receivedEarly)) {
    return true;
  }

  let secret: string;
  try {
    assertPaynetWebhookConfig("verificare semnătură webhook");
    secret = env("PAYNET_WEBHOOK_SECRET");
  } catch (configErr) {
    if (isPaynetMockMode() && isMockWebhookSignatureValid(rawBody, receivedEarly)) {
      return true;
    }
    throw paynetConfigError(configErr);
  }
  if (!secret) {
    throw paynetConfigError(new Error("PAYNET_WEBHOOK_SECRET is required."));
  }
  const received = receivedEarly;
  if (!received) return false;
  const normalizedReceived = received.replace(/^sha256=/i, "").replace(/^v1=/i, "").trim();
  const expectedHex = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expectedBase64 = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");

  const receivedBuf = Buffer.from(normalizedReceived, "utf8");
  const hexBuf = Buffer.from(expectedHex, "utf8");
  const base64Buf = Buffer.from(expectedBase64, "utf8");
  const sameHex = receivedBuf.length === hexBuf.length && crypto.timingSafeEqual(receivedBuf, hexBuf);
  const sameBase64 = receivedBuf.length === base64Buf.length && crypto.timingSafeEqual(receivedBuf, base64Buf);
  return sameHex || sameBase64;
}

type NormalizedPaynetStatus = "paid" | "failed" | "cancelled" | "pending" | "released" | "refunded" | "unknown";

function normalizeWebhookStatus(rawStatus: string | null): NormalizedPaynetStatus {
  const status = (rawStatus ?? "").toLowerCase().trim();
  if (!status) return "unknown";
  if (["paid", "success", "succeeded", "captured", "approved", "completed", "confirmed", "ok", "authorized", "preauth_ok"].includes(status)) {
    return "paid";
  }
  if (["failed", "declined", "rejected", "error"].includes(status)) {
    return "failed";
  }
  if (["cancelled", "canceled", "void", "expired"].includes(status)) {
    return "cancelled";
  }
  if (["released", "voided", "release_ok"].includes(status)) {
    return "released";
  }
  if (["refunded", "refund", "refund_ok"].includes(status)) {
    return "refunded";
  }
  if (["pending", "processing", "in_progress", "waiting"].includes(status)) {
    return "pending";
  }
  return "unknown";
}

function normalizeStringKey(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function buildOrderCreatePayload(request: PaynetOrderRequest) {
  const merchantId = requiredEnv("PAYNET_MERCHANT_ID");
  const webhookUrl = env("PAYNET_WEBHOOK_URL");
  const returnUrl = env("PAYNET_RETURN_URL");

  return {
    merchantId,
    merchantOrderId: request.merchantOrderId,
    amount: decimalToString(request.amountDue),
    currency: request.currency,
    description: `Work2Now salary payment for application #${request.applicationId}`,
    callbackUrl: webhookUrl || undefined,
    returnUrl: returnUrl || undefined,
    metadata: {
      kind: "application_payment",
      paymentId: request.paymentId,
      applicationId: request.applicationId,
      customerUserId: request.customerUserId,
      staffUserId: request.staffUserId,
    },
  };
}

function buildReservationOrderPayload(request: PaynetReservationOrderRequest) {
  const merchantId = requiredEnv("PAYNET_MERCHANT_ID");
  const webhookUrl = env("PAYNET_WEBHOOK_URL");
  const returnUrl = env("PAYNET_RETURN_URL");

  return {
    merchantId,
    merchantOrderId: request.merchantOrderId,
    amount: decimalToString(request.reservedAmount),
    currency: request.currency,
    description: `Work2Now job payment reservation for job #${request.jobId}`,
    callbackUrl: webhookUrl || undefined,
    returnUrl: returnUrl || undefined,
    metadata: {
      kind: "job_payment_reservation",
      reservationId: request.reservationId,
      jobId: request.jobId,
      customerUserId: request.customerUserId,
    },
  };
}

async function fetchJson(url: string, init: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(url, init);
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function resolveCreateOrderUrlForReservation(): string {
  const dedicated = env(PAYNET_RESERVATION_URL_KEY);
  if (dedicated) return dedicated;
  return requiredEnv("PAYNET_CREATE_ORDER_URL");
}

function parsePaynetOrderResponse(raw: unknown, merchantOrderIdFallback: string): PaynetOrderResult {
  const paynetOrderId =
    getStringValue(raw, [["paynetOrderId"]]) ??
    getStringValue(raw, [["orderId"]]) ??
    getStringValue(raw, [["order_id"]]) ??
    merchantOrderIdFallback;

  const redirectUrl =
    getStringValue(raw, [["redirectUrl"]]) ??
    getStringValue(raw, [["redirect_url"]]) ??
    getStringValue(raw, [["paymentUrl"]]) ??
    getStringValue(raw, [["payment_url"]]) ??
    getStringValue(raw, [["url"]]) ??
    (env("PAYNET_PAYMENT_REDIRECT_URL_TEMPLATE")?.includes("{orderId}")
      ? env("PAYNET_PAYMENT_REDIRECT_URL_TEMPLATE").replace("{orderId}", encodeURIComponent(paynetOrderId))
      : env("PAYNET_PAYMENT_REDIRECT_URL_TEMPLATE")
        ? `${env("PAYNET_PAYMENT_REDIRECT_URL_TEMPLATE")}${encodeURIComponent(paynetOrderId)}`
        : null);

  if (!redirectUrl) {
    throw new ServiceError("Paynet response did not include a redirect URL.", 502);
  }

  return Object.freeze({
    paynetOrderId,
    redirectUrl,
    rawResponse: raw,
  });
}

async function postPaynetJson(url: string, body: Record<string, unknown>, logLabel: string): Promise<unknown> {
  const authToken = env("PAYNET_API_TOKEN");
  const apiKey = env("PAYNET_API_KEY");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (apiKey) headers["X-API-Key"] = apiKey;

  const result = await fetchJson(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    console.error(`[Paynet] ${logLabel} failed`, result.status, result.text);
    throw new ServiceError(`Paynet request failed (${result.status}).`, 502);
  }

  return parseJson(result.text);
}

export async function createPaynetOrder(request: PaynetOrderRequest): Promise<PaynetOrderResult> {
  if (isPaynetMockMode()) {
    const result = createMockApplicationOrderResult({
      paymentId: request.paymentId,
      applicationId: request.applicationId,
      merchantOrderId: request.merchantOrderId,
    });
    scheduleMockApplicationPaymentAutoConfirm(request.applicationId);
    return result;
  }

  try {
    assertPaynetOrderCreationConfig("creare comandă plată aplicație");
  } catch (configErr) {
    throw paynetConfigError(configErr);
  }
  const createUrl = requiredEnv("PAYNET_CREATE_ORDER_URL");
  const payload = buildOrderCreatePayload(request);

  console.log("[Paynet] Creating application payment order", {
    paymentId: request.paymentId,
    applicationId: request.applicationId,
    merchantOrderId: request.merchantOrderId,
    amount: decimalToString(request.amountDue),
    currency: request.currency,
  });

  const raw = await postPaynetJson(createUrl, payload, "Order create");
  return parsePaynetOrderResponse(raw, request.merchantOrderId);
}

export async function createPaynetReservationOrder(request: PaynetReservationOrderRequest): Promise<PaynetOrderResult> {
  if (isPaynetMockMode()) {
    return createMockReservationOrderResult({
      reservationId: request.reservationId,
      jobId: request.jobId,
      merchantOrderId: request.merchantOrderId,
    });
  }

  try {
    assertPaynetOrderCreationConfig("creare comandă rezervare job");
  } catch (configErr) {
    throw paynetConfigError(configErr);
  }
  const createUrl = resolveCreateOrderUrlForReservation();
  const payload = buildReservationOrderPayload(request);

  console.log("[Paynet] Creating job reservation order", {
    reservationId: request.reservationId,
    jobId: request.jobId,
    merchantOrderId: request.merchantOrderId,
    amount: decimalToString(request.reservedAmount),
    currency: request.currency,
  });

  const raw = await postPaynetJson(createUrl, payload, "Reservation order create");
  return parsePaynetOrderResponse(raw, request.merchantOrderId);
}

/**
 * After a `job_payment_reservations` row exists in `reserve_pending`, call Paynet and persist `paynet_order_id`.
 * Idempotent if `paynet_order_id` is already set. On Paynet failure, sets `reserve_failed` and `last_error`.
 */
export async function submitJobPaymentReservationToPaynet(jobId: number): Promise<
  Readonly<{
    ok: boolean;
    jobId: number;
    reservationId: number;
    paynetOrderId: string | null;
    redirectUrl: string | null;
    status: string;
    alreadySubmitted: boolean;
  }>
> {
  debugPublishReserve("submitJobPaymentReservationToPaynet start", { jobId });
  if (!Number.isInteger(jobId) || jobId < 1) {
    throw new ServiceError("Job not found.", 404);
  }

  const reservation = await prisma.job_payment_reservations.findUnique({
    where: { job_id: jobId },
    select: {
      id: true,
      job_id: true,
      customer_user_id: true,
      currency: true,
      reserved_amount: true,
      status: true,
      paynet_order_id: true,
    },
  });

  if (!reservation) {
    debugPublishReserve("submitJobPaymentReservationToPaynet: no reservation row", { jobId });
    throw new ServiceError("Payment reservation not found for this job.", 404);
  }

  debugPublishReserve("submitJobPaymentReservationToPaynet loaded reservation", {
    jobId,
    reservationId: reservation.id,
    status: reservation.status,
    paynetOrderId: reservation.paynet_order_id,
  });

  const st = normalizeStringKey(reservation.status).toLowerCase();
  if (st !== "reserve_pending") {
    throw new ServiceError(`Reservation is not awaiting Paynet submission (status: ${reservation.status}).`, 400);
  }

  if (reservation.paynet_order_id) {
    const template = env("PAYNET_PAYMENT_REDIRECT_URL_TEMPLATE");
    const redirectUrl = template
      ? template.includes("{orderId}")
        ? template.replace("{orderId}", encodeURIComponent(reservation.paynet_order_id))
        : `${template}${encodeURIComponent(reservation.paynet_order_id)}`
      : null;
    return Object.freeze({
      ok: true,
      jobId,
      reservationId: reservation.id,
      paynetOrderId: reservation.paynet_order_id,
      redirectUrl,
      status: reservation.status,
      alreadySubmitted: true,
    });
  }

  const merchantOrderId = `W2N-RES-${reservation.id}`;

  try {
    const order = await createPaynetReservationOrder({
      reservationId: reservation.id,
      jobId: reservation.job_id,
      merchantOrderId,
      reservedAmount: reservation.reserved_amount,
      currency: reservation.currency ?? "MDL",
      customerUserId: reservation.customer_user_id,
    });

    await prisma.job_payment_reservations.update({
      where: { id: reservation.id },
      data: {
        paynet_order_id: order.paynetOrderId,
        last_error: null,
        updated_at: new Date(),
      },
    });

    if (isPaynetMockMode()) {
      scheduleMockReservationAutoConfirm(jobId);
    }

    return Object.freeze({
      ok: true,
      jobId,
      reservationId: reservation.id,
      paynetOrderId: order.paynetOrderId,
      redirectUrl: order.redirectUrl,
      status: "reserve_pending",
      alreadySubmitted: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paynet reservation order failed.";
    await prisma.job_payment_reservations.update({
      where: { id: reservation.id },
      data: {
        status: "reserve_failed",
        last_error: message,
        updated_at: new Date(),
      },
    });
    await logPaymentAudit(PaymentActionType.RESERVATION_FAILED, {
      targetJobId: jobId,
      summary: message,
      metadata: { reservationId: reservation.id },
    });
    throw error instanceof ServiceError ? error : new ServiceError(message, 502);
  }
}

async function findPaymentByPaynetOrderId(paynetOrderId: string) {
  return paymentDb.application_payments.findFirst({
    where: {
      OR: [{ paynet_order_id: paynetOrderId }, { paynet_transaction_id: paynetOrderId }],
    },
  });
}

async function findReservationByPaynetReference(reference: string) {
  const trimmed = normalizeStringKey(reference);
  if (!trimmed) return null;

  const byMerchant = /^W2N-RES-(\d+)$/i.exec(trimmed);
  if (byMerchant) {
    const resId = Number.parseInt(byMerchant[1], 10);
    if (Number.isInteger(resId) && resId > 0) {
      const row = await prisma.job_payment_reservations.findUnique({
        where: { id: resId },
      });
      if (row) return row;
    }
  }

  return prisma.job_payment_reservations.findFirst({
    where: {
      OR: [{ paynet_order_id: trimmed }, { paynet_transaction_id: trimmed }],
    },
  });
}

async function findWebhookIdempotency(providerEventId: string): Promise<"payment" | "reservation" | null> {
  const [payRow, resRow] = await Promise.all([
    prisma.paynet_webhook_events.findUnique({ where: { provider_event_id: providerEventId } }),
    prisma.payment_webhook_events.findUnique({ where: { provider_event_id: providerEventId } }),
  ]);
  if (payRow) return "payment";
  if (resRow) return "reservation";
  return null;
}

function rawBodyToString(rawBody: string | Buffer | undefined): string {
  if (typeof rawBody === "string") return rawBody;
  if (Buffer.isBuffer(rawBody)) return rawBody.toString("utf8");
  return "";
}

function reservationStatusFromNormalized(normalized: NormalizedPaynetStatus): string | null {
  if (normalized === "paid") return "reserved";
  if (normalized === "failed") return "reserve_failed";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "released") return "released";
  if (normalized === "refunded") return "refunded";
  return null;
}

async function processApplicationPaymentWebhook(params: {
  providerEventId: string;
  paynetOrderId: string;
  eventType: string;
  rawPayload: string;
  payload: unknown;
  normalizedStatus: NormalizedPaynetStatus;
  statusRaw: string | null;
  transactionId: string | null;
}): Promise<PaynetWebhookProcessResult> {
  const { providerEventId, paynetOrderId, eventType, rawPayload, payload, normalizedStatus, statusRaw, transactionId } = params;

  const existingDup = await prisma.paynet_webhook_events.findUnique({
    where: { provider_event_id: providerEventId },
  });
  if (existingDup) {
    console.log("[Paynet] Duplicate webhook event ignored (payment)", { providerEventId, paynetOrderId });
    return {
      ok: true,
      duplicate: true,
      processed: true,
      entity: "payment",
      paymentId: String(existingDup.application_payment_id),
      status: existingDup.processing_status,
    };
  }

  const payment = await findPaymentByPaynetOrderId(paynetOrderId);
  if (!payment) {
    console.warn("[Paynet] Webhook received for unknown application payment order", { providerEventId, paynetOrderId, statusRaw });
    return { ok: true, duplicate: false, processed: false, entity: "none", status: "unknown_order" };
  }

  const now = new Date();
  await paymentDb.$transaction(async (tx: typeof paymentDb) => {
    await tx.paynet_webhook_events.create({
      data: {
        provider: "paynet",
        provider_event_id: providerEventId,
        paynet_order_id: paynetOrderId,
        application_payment_id: payment.id,
        event_type: eventType,
        signature_valid: true,
        processing_status: "received",
        raw_payload: rawPayload,
      },
    });

    const updateData: Record<string, unknown> = {};
    if (normalizedStatus === "paid") {
      updateData.status = "paid";
      updateData.paid_at = payment.paid_at ?? now;
      updateData.failed_at = null;
      updateData.last_error = null;
      if (transactionId) updateData.paynet_transaction_id = transactionId;
    } else if (normalizedStatus === "failed") {
      updateData.status = "failed";
      updateData.failed_at = now;
      updateData.last_error =
        getStringValue(payload, [["reason"]]) ??
        getStringValue(payload, [["errorMessage"]]) ??
        getStringValue(payload, [["error_message"]]) ??
        statusRaw ??
        "Paynet payment failed.";
      if (transactionId) updateData.paynet_transaction_id = transactionId;
    } else if (normalizedStatus === "cancelled") {
      updateData.status = "cancelled";
      updateData.failed_at = now;
      updateData.last_error = getStringValue(payload, [["reason"]]) ?? statusRaw ?? "Paynet payment cancelled.";
      if (transactionId) updateData.paynet_transaction_id = transactionId;
    } else {
      updateData.last_error = null;
      if (transactionId) updateData.paynet_transaction_id = transactionId;
    }

    await tx.application_payments.update({
      where: { id: payment.id },
      data: updateData,
    });

    await tx.paynet_webhook_events.update({
      where: { provider_event_id: providerEventId },
      data: {
        application_payment_id: payment.id,
        processing_status:
          normalizedStatus === "paid"
            ? "processed"
            : normalizedStatus === "failed" || normalizedStatus === "cancelled"
              ? "processed"
              : "ignored",
        processed_at: now,
        error_message: normalizedStatus === "pending" ? "Webhook received before terminal payment state." : null,
      },
    });
  });

  console.log("[Paynet] Webhook processed (application payment)", {
    providerEventId,
    paynetOrderId,
    paymentId: payment.id,
    status: normalizedStatus,
  });

  return {
    ok: true,
    duplicate: false,
    processed: normalizedStatus !== "pending" && normalizedStatus !== "unknown",
    entity: "payment",
    paymentId: String(payment.id),
    status: normalizedStatus,
  };
}

async function processReservationWebhook(params: {
  providerEventId: string;
  paynetOrderId: string;
  eventType: string;
  rawPayload: string;
  payload: unknown;
  normalizedStatus: NormalizedPaynetStatus;
  statusRaw: string | null;
  transactionId: string | null;
}): Promise<PaynetWebhookProcessResult> {
  const { providerEventId, paynetOrderId, eventType, rawPayload, payload, normalizedStatus, statusRaw, transactionId } = params;

  const existingDup = await prisma.payment_webhook_events.findUnique({
    where: { provider_event_id: providerEventId },
  });
  if (existingDup) {
    console.log("[Paynet] Duplicate webhook event ignored (reservation)", { providerEventId, paynetOrderId });
    return {
      ok: true,
      duplicate: true,
      processed: true,
      entity: "reservation",
      reservationId: String(existingDup.job_payment_reservation_id),
      status: existingDup.processing_status,
    };
  }

  const reservation = await findReservationByPaynetReference(paynetOrderId);
  if (!reservation) {
    console.warn("[Paynet] Webhook received for unknown reservation order", { providerEventId, paynetOrderId, statusRaw });
    return { ok: true, duplicate: false, processed: false, entity: "none", status: "unknown_order" };
  }

  const nextStatus = reservationStatusFromNormalized(normalizedStatus);
  const now = new Date();
  const currentReservationStatus = normalizeStringKey(reservation.status).toLowerCase();

  if (nextStatus && !shouldApplyReservationWebhookUpdate(currentReservationStatus, nextStatus)) {
    logPaymentDiagnostic("warn", "Reservation webhook ignored (invalid transition)", {
      reservationId: reservation.id,
      from: currentReservationStatus,
      to: nextStatus,
      paynetOrderId,
    });
    return {
      ok: true,
      duplicate: false,
      processed: false,
      entity: "reservation",
      reservationId: String(reservation.id),
      status: "transition_rejected",
    };
  }

  let failureReasonForJob: string | null = null;
  if (nextStatus === "reserve_failed") {
    failureReasonForJob =
      getStringValue(payload, [["reason"]]) ??
      getStringValue(payload, [["errorMessage"]]) ??
      getStringValue(payload, [["error_message"]]) ??
      statusRaw ??
      "Paynet reservation failed.";
  } else if (nextStatus === "cancelled") {
    failureReasonForJob = getStringValue(payload, [["reason"]]) ?? statusRaw ?? "Reservation cancelled.";
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment_webhook_events.create({
      data: {
        provider: "paynet",
        provider_event_id: providerEventId,
        job_payment_reservation_id: reservation.id,
        paynet_order_id: paynetOrderId,
        event_type: eventType,
        signature_valid: true,
        processing_status: "received",
        raw_payload: rawPayload,
      },
    });

    const resUpdate: Record<string, unknown> = {
      updated_at: now,
    };

    if (transactionId) {
      resUpdate.paynet_transaction_id = transactionId;
    }

    if (nextStatus === "reserved") {
      resUpdate.status = "reserved";
      resUpdate.reserved_at = reservation.reserved_at ?? now;
      resUpdate.last_error = null;
    } else if (nextStatus === "reserve_failed") {
      resUpdate.status = "reserve_failed";
      resUpdate.last_error =
        getStringValue(payload, [["reason"]]) ??
        getStringValue(payload, [["errorMessage"]]) ??
        getStringValue(payload, [["error_message"]]) ??
        statusRaw ??
        "Paynet reservation failed.";
    } else if (nextStatus === "cancelled") {
      resUpdate.status = "cancelled";
      resUpdate.last_error = getStringValue(payload, [["reason"]]) ?? statusRaw ?? "Reservation cancelled.";
    } else if (nextStatus === "released") {
      resUpdate.status = "released";
      resUpdate.released_at = reservation.released_at ?? now;
      resUpdate.last_error = null;
    } else if (nextStatus === "refunded") {
      resUpdate.status = "refunded";
      resUpdate.refunded_at = reservation.refunded_at ?? now;
      resUpdate.last_error = null;
    } else {
      resUpdate.last_error = reservation.last_error;
    }

    await tx.job_payment_reservations.update({
      where: { id: reservation.id },
      data: resUpdate as Prisma.job_payment_reservationsUpdateInput,
    });

    if (nextStatus === "reserved") {
      await markJobPublishedWhenReservationReserved(tx, reservation.job_id, now);
    } else if (nextStatus === "reserve_failed" || nextStatus === "cancelled") {
      await markJobUnpublishedOnReservationFailure(tx, reservation.job_id, failureReasonForJob, now);
    }

    const terminalReservationUpdate = nextStatus != null;

    await tx.payment_webhook_events.update({
      where: { provider_event_id: providerEventId },
      data: {
        processing_status: terminalReservationUpdate ? "processed" : "ignored",
        processed_at: terminalReservationUpdate ? now : null,
        error_message:
          normalizedStatus === "pending" || normalizedStatus === "unknown"
            ? "Webhook received before terminal reservation state."
            : null,
      },
    });
  });

  if (nextStatus === "reserved") {
    await logPaymentAudit(PaymentActionType.RESERVATION_RESERVED, {
      targetJobId: reservation.job_id,
      summary: "Paynet reservation confirmed",
      metadata: { reservationId: reservation.id, paynetOrderId },
    });
  } else if (nextStatus === "reserve_failed" || nextStatus === "cancelled") {
    await logPaymentAudit(
      nextStatus === "reserve_failed" ? PaymentActionType.RESERVATION_FAILED : PaymentActionType.RESERVATION_CANCELLED,
      {
        targetJobId: reservation.job_id,
        summary: failureReasonForJob ?? nextStatus,
        metadata: { reservationId: reservation.id, paynetOrderId },
      }
    );
  }

  console.log("[Paynet] Webhook processed (job reservation)", {
    providerEventId,
    paynetOrderId,
    reservationId: reservation.id,
    status: normalizedStatus,
    nextStatus,
  });

  return {
    ok: true,
    duplicate: false,
    processed: nextStatus != null,
    entity: "reservation",
    reservationId: String(reservation.id),
    status: nextStatus ?? normalizedStatus,
  };
}

export async function processPaynetWebhook(input: {
  headers: PaynetHeaderMap;
  rawBody: string | Buffer | undefined;
}): Promise<PaynetWebhookProcessResult> {
  const rawPayload = rawBodyToString(input.rawBody);
  if (!rawPayload.trim()) {
    throw new ServiceError("Empty Paynet webhook body.", 400);
  }

  const signatureValid = getWebhookSignature(rawPayload, input.headers);
  if (!signatureValid) {
    console.warn("[Paynet] Webhook signature invalid");
    throw new ServiceError("Invalid Paynet webhook signature.", 401);
  }

  const payload = parseJson(rawPayload);
  const providerEventId =
    getHeaderValue(input.headers, env("PAYNET_WEBHOOK_EVENT_ID_HEADER", "x-paynet-event-id")) ??
    getStringValue(payload, [["eventId"]]) ??
    getStringValue(payload, [["event_id"]]) ??
    getStringValue(payload, [["notificationId"]]) ??
    getStringValue(payload, [["notification_id"]]) ??
    crypto.createHash("sha256").update(rawPayload, "utf8").digest("hex");

  const prior = await findWebhookIdempotency(providerEventId);
  if (prior === "payment") {
    const row = await prisma.paynet_webhook_events.findUnique({ where: { provider_event_id: providerEventId } });
    return {
      ok: true,
      duplicate: true,
      processed: true,
      entity: "payment",
      paymentId: row ? String(row.application_payment_id) : undefined,
      status: row?.processing_status,
    };
  }
  if (prior === "reservation") {
    const row = await prisma.payment_webhook_events.findUnique({ where: { provider_event_id: providerEventId } });
    return {
      ok: true,
      duplicate: true,
      processed: true,
      entity: "reservation",
      reservationId: row ? String(row.job_payment_reservation_id) : undefined,
      status: row?.processing_status,
    };
  }

  const paynetOrderId =
    getHeaderValue(input.headers, env("PAYNET_WEBHOOK_ORDER_ID_HEADER", "x-paynet-order-id")) ??
    getStringValue(payload, [["paynetOrderId"]]) ??
    getStringValue(payload, [["paynet_order_id"]]) ??
    getStringValue(payload, [["orderId"]]) ??
    getStringValue(payload, [["order_id"]]) ??
    getStringValue(payload, [["merchantOrderId"]]) ??
    getStringValue(payload, [["merchant_order_id"]]) ??
    "";

  if (!paynetOrderId) {
    console.warn("[Paynet] Webhook missing order id", { providerEventId });
    return { ok: true, duplicate: false, processed: false, entity: "none", status: "missing_order_id" };
  }

  const eventType =
    getStringValue(payload, [["eventType"]]) ??
    getStringValue(payload, [["event_type"]]) ??
    getStringValue(payload, [["type"]]) ??
    "payment_status";

  const statusRaw =
    getHeaderValue(input.headers, env("PAYNET_WEBHOOK_STATUS_HEADER", "x-paynet-status")) ??
    getStringValue(payload, [["status"]]) ??
    getStringValue(payload, [["paymentStatus"]]) ??
    getStringValue(payload, [["payment_status"]]) ??
    getStringValue(payload, [["transactionStatus"]]) ??
    getStringValue(payload, [["transaction_status"]]) ??
    null;
  const normalizedStatus = normalizeWebhookStatus(statusRaw);
  const transactionId =
    getHeaderValue(input.headers, env("PAYNET_WEBHOOK_TRANSACTION_ID_HEADER", "x-paynet-transaction-id")) ??
    getStringValue(payload, [["transactionId"]]) ??
    getStringValue(payload, [["transaction_id"]]) ??
    getStringValue(payload, [["paymentId"]]) ??
    getStringValue(payload, [["payment_id"]]) ??
    null;

  const paymentHit = await findPaymentByPaynetOrderId(paynetOrderId);
  if (paymentHit) {
    return processApplicationPaymentWebhook({
      providerEventId,
      paynetOrderId,
      eventType,
      rawPayload,
      payload,
      normalizedStatus,
      statusRaw,
      transactionId,
    });
  }

  const reservationHit = await findReservationByPaynetReference(paynetOrderId);
  if (reservationHit) {
    return processReservationWebhook({
      providerEventId,
      paynetOrderId,
      eventType,
      rawPayload,
      payload,
      normalizedStatus,
      statusRaw,
      transactionId,
    });
  }

  console.warn("[Paynet] Webhook: no matching payment or reservation", { providerEventId, paynetOrderId });
  return { ok: true, duplicate: false, processed: false, entity: "none", status: "unknown_order" };
}
