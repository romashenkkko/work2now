import { Prisma } from "@prisma/client";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { getResolvedRoleAndCustomerLike } from "./jobsService";
import { markJobPublishedWhenReservationReserved } from "./jobPublicationSync";
import { createJobReservation } from "./paymentReservationService";
import { submitJobPaymentReservationToPaynet } from "./paynetService";
import { logPaymentAudit, PaymentActionType } from "./paymentFlowDiagnostics";
import {
  expireStaleReservations,
  retryJobReservationPaynetSubmit,
} from "./reservationMaintenanceService";
import { debugPublishReserve } from "../utils/publishReserveDebug";

function normStatus(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function decimalToString(value: Prisma.Decimal | string | number | null | undefined): string {
  if (value == null) return "0.00";
  return new Prisma.Decimal(String(value)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildPaynetRedirectUrl(paynetOrderId: string | null | undefined): string | null {
  const template = process.env.PAYNET_PAYMENT_REDIRECT_URL_TEMPLATE?.trim();
  if (!template || !paynetOrderId) return null;
  return template.includes("{orderId}")
    ? template.replace("{orderId}", encodeURIComponent(paynetOrderId))
    : `${template}${encodeURIComponent(paynetOrderId)}`;
}

function mapReservationToDto(res: {
  id: number;
  job_id: number;
  status: string;
  provider: string;
  currency: string;
  planned_minutes_snapshot: number;
  hourly_rate_snapshot: Prisma.Decimal | string | number;
  reserved_amount: Prisma.Decimal | string | number;
  paynet_order_id: string | null;
  paynet_transaction_id: string | null;
  reserved_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: String(res.id),
    jobId: String(res.job_id),
    status: res.status,
    provider: res.provider,
    currency: res.currency,
    plannedMinutesSnapshot: Number(res.planned_minutes_snapshot) || 0,
    hourlyRateSnapshot: decimalToString(res.hourly_rate_snapshot),
    reservedAmount: decimalToString(res.reserved_amount),
    paynetOrderId: res.paynet_order_id,
    paynetTransactionId: res.paynet_transaction_id,
    reservedAt: toIso(res.reserved_at),
    lastError: res.last_error,
    createdAt: toIso(res.created_at),
    updatedAt: toIso(res.updated_at),
  };
}

async function loadOwnedJob(userId: string, jobId: number) {
  return prisma.jobs.findFirst({
    where: { id: jobId, user_id: userId },
    include: {
      job_payment_reservation: {
        select: {
          id: true,
          job_id: true,
          status: true,
          provider: true,
          currency: true,
          planned_minutes_snapshot: true,
          hourly_rate_snapshot: true,
          reserved_amount: true,
          paynet_order_id: true,
          paynet_transaction_id: true,
          reserved_at: true,
          last_error: true,
          created_at: true,
          updated_at: true,
        },
      },
    },
  });
}

export type PublishJobAndReserveResult = Readonly<{
  ok: true;
  state: "live" | "payment_pending";
  jobId: number;
  jobStatus: string;
  jobStatusClass: string;
  publishedAt: string | null;
  publishBlockedReason: string | null;
  repaired?: boolean;
  reservation: ReturnType<typeof mapReservationToDto> | null;
  paynet: Readonly<{
    provider: "paynet";
    mode: "server-server";
    orderId: string | null;
    redirectUrl: string | null;
    alreadySubmitted: boolean;
  }>;
}>;

/**
 * Customer: start publish — local reservation + Paynet order. Job stays Draft until webhook sets reservation to reserved, then job becomes Open.
 */
export async function publishJobAndReservePayment(userId: string, jobIdRaw: string): Promise<PublishJobAndReserveResult> {
  const jobId = Number.parseInt(jobIdRaw, 10);
  debugPublishReserve("publishJobAndReservePayment start", { userId, jobIdRaw, jobId });
  if (!Number.isInteger(jobId) || jobId < 1) {
    throw new ServiceError("Job negăsit.", 404);
  }

  const { customerLike } = await getResolvedRoleAndCustomerLike(userId);
  if (!customerLike) {
    throw new ServiceError("Doar customerul poate publica joburi.", 403);
  }

  let job = await loadOwnedJob(userId, jobId);
  if (!job) {
    throw new ServiceError("Job negăsit.", 404);
  }

  const res0 = job.job_payment_reservation;
  const r0 = res0 ? normStatus(res0.status) : "";
  debugPublishReserve("loaded job context", {
    jobId,
    jobStatus: job.status,
    reservationId: res0?.id ?? null,
    reservationStatus: r0 || null,
  });

  if (r0 === "reserved" && normStatus(job.status) === "open") {
    debugPublishReserve("early return: already live (reserved + open)", { jobId });
    return Object.freeze({
      ok: true,
      state: "live",
      jobId,
      jobStatus: job.status,
      jobStatusClass: job.status_class,
      publishedAt: toIso(job.published_at),
      publishBlockedReason: job.publish_blocked_reason ?? null,
      reservation: res0 ? mapReservationToDto(res0) : null,
      paynet: Object.freeze({
        provider: "paynet",
        mode: "server-server",
        orderId: res0?.paynet_order_id ?? null,
        redirectUrl: buildPaynetRedirectUrl(res0?.paynet_order_id),
        alreadySubmitted: true,
      }),
    });
  }

  if (r0 === "reserved" && normStatus(job.status) === "draft") {
    await prisma.$transaction(async (tx) => {
      await markJobPublishedWhenReservationReserved(tx, jobId, new Date());
    });
    job = (await loadOwnedJob(userId, jobId))!;
    const res = job.job_payment_reservation;
    return Object.freeze({
      ok: true,
      state: "live",
      jobId,
      repaired: true,
      jobStatus: job.status,
      jobStatusClass: job.status_class,
      publishedAt: toIso(job.published_at),
      publishBlockedReason: job.publish_blocked_reason ?? null,
      reservation: res ? mapReservationToDto(res) : null,
      paynet: Object.freeze({
        provider: "paynet",
        mode: "server-server",
        orderId: res?.paynet_order_id ?? null,
        redirectUrl: buildPaynetRedirectUrl(res?.paynet_order_id),
        alreadySubmitted: true,
      }),
    });
  }

  if (normStatus(job.status) === "open" && !res0) {
    throw new ServiceError("Jobul este deja publicat fără rezervare plată. Nu poate fi folosit acest endpoint.", 400);
  }

  if (r0 === "reserved") {
    throw new ServiceError("Rezervarea este deja confirmată. Jobul ar trebui să fie publicat.", 400);
  }

  if (r0 === "reserve_pending") {
    debugPublishReserve("branch: reserve_pending — retry Paynet only (no new createJobReservation)", {
      jobId,
      reservationId: res0?.id,
    });
    const retry = await retryJobReservationPaynetSubmit(userId, jobIdRaw);
    const refreshedPending = await loadOwnedJob(userId, jobId);
    const resPending = refreshedPending?.job_payment_reservation;
    return Object.freeze({
      ok: true,
      state: "payment_pending",
      jobId,
      jobStatus: refreshedPending?.status ?? job.status,
      jobStatusClass: refreshedPending?.status_class ?? job.status_class,
      publishedAt: toIso(refreshedPending?.published_at ?? null),
      publishBlockedReason: refreshedPending?.publish_blocked_reason ?? null,
      reservation: resPending ? mapReservationToDto(resPending) : null,
      paynet: Object.freeze({
        provider: "paynet",
        mode: "server-server",
        orderId: retry.paynetOrderId,
        redirectUrl: retry.redirectUrl,
        alreadySubmitted: retry.alreadySubmitted,
      }),
    });
  }

  if (normStatus(job.status) !== "draft") {
    throw new ServiceError("Doar joburile în Draft pot fi trimise la plată / publicare prin acest flux.", 400);
  }

  await prisma.jobs.update({
    where: { id: jobId },
    data: { publish_blocked_reason: null },
  });

  debugPublishReserve("calling createJobReservation", { jobId });
  const reservationResult = await createJobReservation(jobId);
  debugPublishReserve("createJobReservation returned", {
    jobId,
    created: reservationResult.created,
    reservationId: reservationResult.reservation.id,
    status: reservationResult.reservation.status,
  });

  const rowAfterCreate = await prisma.job_payment_reservations.findUnique({
    where: { job_id: jobId },
    select: { id: true, status: true, paynet_order_id: true },
  });
  debugPublishReserve("DB verify after createJobReservation (outside tx)", {
    jobId,
    found: Boolean(rowAfterCreate),
    row: rowAfterCreate,
  });

  if (!rowAfterCreate) {
    throw new ServiceError(
      "Rezervarea nu a fost persistată în baza de date după createJobReservation.",
      500
    );
  }

  debugPublishReserve("calling submitJobPaymentReservationToPaynet", { jobId });
  let submit: Awaited<ReturnType<typeof submitJobPaymentReservationToPaynet>>;
  try {
    submit = await submitJobPaymentReservationToPaynet(jobId);
    debugPublishReserve("submitJobPaymentReservationToPaynet success", {
      jobId,
      paynetOrderId: submit.paynetOrderId,
      alreadySubmitted: submit.alreadySubmitted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paynet reservation failed.";
    await prisma.jobs.update({
      where: { id: jobId },
      data: { publish_blocked_reason: message },
    });
    throw error;
  }

  const refreshed = await loadOwnedJob(userId, jobId);
  if (!refreshed) {
    throw new ServiceError("Job negăsit.", 404);
  }
  const res = refreshed.job_payment_reservation;

  await logPaymentAudit(PaymentActionType.RESERVATION_PAYNET_SUBMITTED, {
    actorUserId: userId,
    targetJobId: jobId,
    summary: "Publish and reserve — Paynet order submitted",
    metadata: { paynetOrderId: submit.paynetOrderId },
  });

  return Object.freeze({
    ok: true,
    state: "payment_pending",
    jobId,
    jobStatus: refreshed.status,
    jobStatusClass: refreshed.status_class,
    publishedAt: toIso(refreshed.published_at),
    publishBlockedReason: refreshed.publish_blocked_reason ?? null,
    reservation: res ? mapReservationToDto(res) : null,
    paynet: Object.freeze({
      provider: "paynet",
      mode: "server-server",
      orderId: submit.paynetOrderId,
      redirectUrl: submit.redirectUrl,
      alreadySubmitted: submit.alreadySubmitted,
    }),
  });
}

export type JobPaymentReservationStatusResult = Readonly<{
  jobId: number;
  jobStatus: string;
  jobStatusClass: string;
  publishedAt: string | null;
  publishBlockedReason: string | null;
  reservation: ReturnType<typeof mapReservationToDto> | null;
  paynet: Readonly<{
    provider: "paynet";
    mode: "server-server";
    orderId: string | null;
    redirectUrl: string | null;
  }>;
}>;

export async function getJobPaymentReservationStatus(userId: string, jobIdRaw: string): Promise<JobPaymentReservationStatusResult> {
  const jobId = Number.parseInt(jobIdRaw, 10);
  if (!Number.isInteger(jobId) || jobId < 1) {
    throw new ServiceError("Job negăsit.", 404);
  }

  const { customerLike } = await getResolvedRoleAndCustomerLike(userId);
  if (!customerLike) {
    throw new ServiceError("Doar customerul poate vedea starea rezervării.", 403);
  }

  await expireStaleReservations();

  let job = await loadOwnedJob(userId, jobId);
  if (!job) {
    throw new ServiceError("Job negăsit.", 404);
  }

  const res = job.job_payment_reservation;
  const rSt = res ? normStatus(res.status) : "";

  if (rSt === "reserved" && normStatus(job.status) === "draft") {
    await prisma.$transaction(async (tx) => {
      await markJobPublishedWhenReservationReserved(tx, jobId, new Date());
    });
    job = (await loadOwnedJob(userId, jobId))!;
  }

  const resFinal = job.job_payment_reservation;

  return Object.freeze({
    jobId,
    jobStatus: job.status,
    jobStatusClass: job.status_class,
    publishedAt: toIso(job.published_at),
    publishBlockedReason: job.publish_blocked_reason ?? null,
    reservation: resFinal ? mapReservationToDto(resFinal) : null,
    paynet: Object.freeze({
      provider: "paynet",
      mode: "server-server",
      orderId: resFinal?.paynet_order_id ?? null,
      redirectUrl: buildPaynetRedirectUrl(resFinal?.paynet_order_id),
    }),
  });
}
