import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import {
  calculatePaymentAmountSnapshot,
  type PaymentAmountSnapshot,
} from "./paymentAmountService";
import { createPaynetOrder } from "./paynetService";

const paymentDb = prisma as any;
const PAYMENT_IDEMPOTENCY_SCOPE = "payments.start-application";

export type PaymentStartResponse = Readonly<{
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
    failedAt: string | null;
    lastError: string | null;
  };
  paynet: {
    provider: "paynet";
    mode: "server-server";
    orderId: string | null;
    redirectUrl: string;
  };
}>;

export type StartApplicationPaymentResult = Readonly<{
  created: boolean;
  response: PaymentStartResponse;
}>;

function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString();
  }
  const parsed = new Date(String(v));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function decimalToString(value: Prisma.Decimal | null | undefined): string {
  if (value == null) return "0.00";
  return new Prisma.Decimal(value.toString()).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

function makeResponse(payment: {
  id: number;
  application_id: number;
  status: string;
  currency: string;
  worked_minutes: number;
  hourly_rate_snapshot: Prisma.Decimal | string | number;
  amount_due: Prisma.Decimal | string | number;
  paynet_order_id: string | null;
  customer_confirmed_at: Date | string | null;
  payment_started_at: Date | string | null;
  paid_at: Date | string | null;
  failed_at: Date | string | null;
  last_error: string | null;
}): PaymentStartResponse {
  const paynetOrderId = payment.paynet_order_id ?? `W2N-PMT-${payment.id}`;
  return Object.freeze({
    payment: {
      id: String(payment.id),
      applicationId: String(payment.application_id),
      status: payment.status,
      currency: payment.currency,
      workedMinutes: Number(payment.worked_minutes) || 0,
      hourlyRateSnapshot: decimalToString(payment.hourly_rate_snapshot as Prisma.Decimal),
      amountDue: decimalToString(payment.amount_due as Prisma.Decimal),
      paynetOrderId,
      customerConfirmedAt: toIso(payment.customer_confirmed_at),
      paymentStartedAt: toIso(payment.payment_started_at),
      paidAt: toIso(payment.paid_at),
      failedAt: toIso(payment.failed_at),
      lastError: payment.last_error ?? null,
    },
    paynet: {
      provider: "paynet",
      mode: "server-server",
      orderId: paynetOrderId,
      redirectUrl: envRedirectUrl(payment.paynet_order_id ?? `W2N-PMT-${payment.id}`),
    },
  });
}

function makeAwaitingResponse(params: {
  applicationId: number;
  snapshot: PaymentAmountSnapshot;
  customerConfirmedAt: Date | string | null;
}): PaymentStartResponse {
  return Object.freeze({
    payment: {
      id: "0",
      applicationId: String(params.applicationId),
      status: "draft",
      currency: "MDL",
      workedMinutes: Number(params.snapshot.workedMinutes) || 0,
      hourlyRateSnapshot: decimalToString(params.snapshot.hourlyRateSnapshot as Prisma.Decimal),
      amountDue: decimalToString(params.snapshot.amountDue as Prisma.Decimal),
      paynetOrderId: null,
      customerConfirmedAt: toIso(params.customerConfirmedAt),
      paymentStartedAt: null,
      paidAt: null,
      failedAt: null,
      lastError: null,
    },
    paynet: {
      provider: "paynet",
      mode: "server-server",
      orderId: null,
      redirectUrl: "",
    },
  });
}

function envRedirectUrl(orderId: string): string {
  const template = process.env.PAYNET_PAYMENT_REDIRECT_URL_TEMPLATE?.trim();
  if (!template) {
    throw new ServiceError("PAYNET_PAYMENT_REDIRECT_URL_TEMPLATE is required when Paynet does not return a redirect URL.", 500);
  }
  return template.includes("{orderId}") ? template.replace("{orderId}", encodeURIComponent(orderId)) : `${template}${encodeURIComponent(orderId)}`;
}

function normalizeIdempotencyKey(raw: unknown): string {
  const key = String(raw ?? "").trim();
  if (!key) {
    throw new ServiceError("Idempotency-Key este obligatoriu.", 400);
  }
  if (key.length > 100) {
    throw new ServiceError("Idempotency-Key este prea lung.", 400);
  }
  return key;
}

function hashRequest(userId: string, applicationId: number, key: string): string {
  return crypto
    .createHash("sha256")
    .update(`${PAYMENT_IDEMPOTENCY_SCOPE}:${userId}:${applicationId}:${key}`)
    .digest("hex");
}

function parseCachedResponse(record: { response_body?: string | null } | null | undefined): PaymentStartResponse | null {
  if (!record?.response_body) return null;
  try {
    const parsed = JSON.parse(record.response_body) as PaymentStartResponse;
    if (!parsed?.payment || !parsed?.paynet) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readIdempotencyRecord(userId: string, key: string) {
  return paymentDb.payment_idempotency_keys.findFirst({
    where: {
      actor_user_id: userId,
      scope: PAYMENT_IDEMPOTENCY_SCOPE,
      idempotency_key: key,
    },
  });
}

async function writeIdempotencyRecord(params: {
  userId: string;
  key: string;
  requestHash: string;
  response: PaymentStartResponse;
}) {
  await paymentDb.payment_idempotency_keys.create({
    data: {
      actor_user_id: params.userId,
      scope: PAYMENT_IDEMPOTENCY_SCOPE,
      idempotency_key: params.key,
      request_hash: params.requestHash,
      response_status: 201,
      response_body: JSON.stringify(params.response),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
}

async function loadApplicationForPayment(applicationId: number) {
  return prisma.applications.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      job_id: true,
      staff_id: true,
      status: true,
      checked_in_at: true,
      checked_out_at: true,
      business_confirmed_at: true,
      jobs: {
        select: {
          id: true,
          user_id: true,
          hourly_rate_base: true,
        },
      },
    },
  });
}

async function loadApplicationPaymentContext(applicationIdRaw: string, userId: string) {
  const applicationId = Number(applicationIdRaw);
  if (!Number.isInteger(applicationId) || applicationId < 1) {
    throw new ServiceError("Application not found.", 404);
  }

  const application = await loadApplicationForPayment(applicationId);
  if (!application) {
    throw new ServiceError("Application not found.", 404);
  }

  const isCustomerOwner = String(application.jobs?.user_id ?? "") === userId;
  const isAssignedStaff = String(application.staff_id ?? "") === userId;
  if (!isCustomerOwner && !isAssignedStaff) {
    throw new ServiceError("Nu ai acces la această plată.", 403);
  }

  return { applicationId, application };
}

async function loadExistingPayment(applicationId: number) {
  return paymentDb.application_payments.findUnique({
    where: { application_id: applicationId },
  });
}

async function createDraftPayment(params: {
  applicationId: number;
  jobId: number;
  customerUserId: string;
  staffUserId: string;
  snapshot: PaymentAmountSnapshot;
}) {
  return paymentDb.application_payments.create({
    data: {
      application_id: params.applicationId,
      job_id: params.jobId,
      customer_user_id: params.customerUserId,
      staff_user_id: params.staffUserId,
      currency: "MDL",
      hourly_rate_snapshot: params.snapshot.hourlyRateSnapshot,
      worked_minutes: params.snapshot.workedMinutes,
      amount_due: params.snapshot.amountDue,
      status: "draft",
      provider: "paynet",
      paynet_order_id: null,
      paynet_transaction_id: null,
      customer_confirmed_at: null,
      payment_started_at: null,
      paid_at: null,
      failed_at: null,
      last_error: null,
    },
  });
}

async function updatePaymentStatus<T extends Record<string, unknown>>(paymentId: number, data: T) {
  return paymentDb.application_payments.update({
    where: { id: paymentId },
    data,
  });
}

export async function startApplicationPayment(
  userId: string,
  applicationIdRaw: string,
  idempotencyKeyRaw: unknown
): Promise<StartApplicationPaymentResult> {
  const applicationId = Number(applicationIdRaw);
  if (!Number.isInteger(applicationId) || applicationId < 1) {
    throw new ServiceError("Application not found.", 404);
  }

  const idempotencyKey = normalizeIdempotencyKey(idempotencyKeyRaw);
  const requestHash = hashRequest(userId, applicationId, idempotencyKey);

  const cachedRecord = await readIdempotencyRecord(userId, idempotencyKey);
  if (cachedRecord) {
    if (cachedRecord.request_hash !== requestHash) {
      throw new ServiceError("Idempotency-Key already used for another request.", 409);
    }
    const cachedResponse = parseCachedResponse(cachedRecord);
    if (cachedResponse) {
      return { created: false, response: cachedResponse };
    }
  }

  const application = await loadApplicationForPayment(applicationId);
  if (!application) {
    throw new ServiceError("Application not found.", 404);
  }

  if (String(application.jobs?.user_id ?? "") !== userId) {
    throw new ServiceError("Doar customer-ul care a creat jobul poate porni plata.", 403);
  }

  if (application.status !== "accepted") {
    throw new ServiceError("Doar aplicațiile acceptate pot fi plătite.", 400);
  }

  if (application.business_confirmed_at == null) {
    throw new ServiceError("Customer trebuie să confirme finalizarea înainte de pornirea plății.", 400);
  }

  if (!application.staff_id) {
    throw new ServiceError("Aplicația nu are un staff asignat.", 400);
  }

  const existingPayment = await loadExistingPayment(applicationId);
  if (existingPayment && existingPayment.status === "paid") {
    const response = makeResponse(existingPayment as {
      id: number;
      application_id: number;
      status: string;
      currency: string;
      worked_minutes: number;
      hourly_rate_snapshot: Prisma.Decimal;
      amount_due: Prisma.Decimal;
      paynet_order_id: string | null;
      customer_confirmed_at: Date | string | null;
      payment_started_at: Date | string | null;
      paid_at: Date | string | null;
    });

    if (!cachedRecord) {
      await writeIdempotencyRecord({ userId, key: idempotencyKey, requestHash, response });
    }

    return { created: false, response };
  }

  const amountSnapshot: PaymentAmountSnapshot =
    existingPayment != null
      ? {
          workedMinutes: Number(existingPayment.worked_minutes),
          hourlyRateSnapshot: new Prisma.Decimal(String(existingPayment.hourly_rate_snapshot)),
          amountDue: new Prisma.Decimal(String(existingPayment.amount_due)),
        }
      : await calculatePaymentAmountSnapshot(applicationId);

  try {
    const payment =
      existingPayment ??
      (await createDraftPayment({
        applicationId: application.id,
        jobId: application.job_id,
        customerUserId: String(application.jobs?.user_id ?? userId),
        staffUserId: String(application.staff_id),
        snapshot: amountSnapshot,
      }));

    const paynetOrderId = payment.paynet_order_id ? String(payment.paynet_order_id) : `W2N-PMT-${payment.id}`;
    const paymentStartedAt = new Date();

    if (payment.status === "paynet_pending" && payment.paynet_order_id) {
      const response = makeResponse(payment as {
        id: number;
        application_id: number;
        status: string;
        currency: string;
        worked_minutes: number;
        hourly_rate_snapshot: Prisma.Decimal;
        amount_due: Prisma.Decimal;
        paynet_order_id: string | null;
        customer_confirmed_at: Date | string | null;
        payment_started_at: Date | string | null;
        paid_at: Date | string | null;
      });
      if (!cachedRecord) {
        await writeIdempotencyRecord({ userId, key: idempotencyKey, requestHash, response });
      }
      return { created: false, response };
    }

    const paynetOrder = await createPaynetOrder({
      paymentId: payment.id,
      applicationId: application.id,
      merchantOrderId: paynetOrderId,
      amountDue: amountSnapshot.amountDue,
      currency: payment.currency ?? "MDL",
      customerUserId: String(application.jobs?.user_id ?? userId),
      staffUserId: String(application.staff_id),
    });

    const updatedPayment = await updatePaymentStatus(payment.id, {
      status: "paynet_pending",
      paynet_order_id: paynetOrder.paynetOrderId,
      payment_started_at: payment.payment_started_at ?? paymentStartedAt,
      customer_confirmed_at: payment.customer_confirmed_at ?? application.business_confirmed_at,
      last_error: null,
    });

    const response = makeResponse(updatedPayment as {
      id: number;
      application_id: number;
      status: string;
      currency: string;
      worked_minutes: number;
      hourly_rate_snapshot: Prisma.Decimal;
      amount_due: Prisma.Decimal;
      paynet_order_id: string | null;
      customer_confirmed_at: Date | string | null;
      payment_started_at: Date | string | null;
      paid_at: Date | string | null;
    });

    if (!cachedRecord) {
      await writeIdempotencyRecord({ userId, key: idempotencyKey, requestHash, response });
    }

    console.log("[Paynet] Payment order created", {
      paymentId: payment.id,
      applicationId: application.id,
      paynetOrderId: paynetOrder.paynetOrderId,
    });

    return { created: true, response };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const concurrentPayment = await loadExistingPayment(applicationId);
      if (concurrentPayment) {
        const response = makeResponse(concurrentPayment as {
          id: number;
          application_id: number;
          status: string;
          currency: string;
          worked_minutes: number;
          hourly_rate_snapshot: Prisma.Decimal;
          amount_due: Prisma.Decimal;
          paynet_order_id: string | null;
          customer_confirmed_at: Date | string | null;
          payment_started_at: Date | string | null;
          paid_at: Date | string | null;
        });
        if (!cachedRecord) {
          await writeIdempotencyRecord({ userId, key: idempotencyKey, requestHash, response });
        }
        return { created: false, response };
      }
      throw new ServiceError("Payment already exists for this application.", 409);
    }

    const failedPayment = await loadExistingPayment(applicationId);
    if (failedPayment) {
      await updatePaymentStatus(failedPayment.id, {
        status: "failed",
        failed_at: new Date(),
        last_error: error instanceof Error ? error.message : "Paynet order creation failed.",
      });
    }

    throw error;
  }
}

export async function getApplicationPayment(
  userId: string,
  applicationIdRaw: string
): Promise<PaymentStartResponse> {
  const { applicationId, application } = await loadApplicationPaymentContext(applicationIdRaw, userId);
  const existingPayment = await loadExistingPayment(applicationId);

  if (existingPayment) {
    return makeResponse(existingPayment as {
      id: number;
      application_id: number;
      status: string;
      currency: string;
      worked_minutes: number;
      hourly_rate_snapshot: Prisma.Decimal;
      amount_due: Prisma.Decimal;
      paynet_order_id: string | null;
      customer_confirmed_at: Date | string | null;
      payment_started_at: Date | string | null;
      paid_at: Date | string | null;
      failed_at: Date | string | null;
      last_error: string | null;
    });
  }

  const snapshot = await calculatePaymentAmountSnapshot(applicationId);
  return makeAwaitingResponse({
    applicationId,
    snapshot,
    customerConfirmedAt: application.business_confirmed_at,
  });
}