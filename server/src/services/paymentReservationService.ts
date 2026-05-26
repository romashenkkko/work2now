import { Prisma } from "@prisma/client";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { logPaymentAudit, PaymentActionType } from "./paymentFlowDiagnostics";
import { computeReservationExpiresAt } from "./reservationMaintenanceService";
import { debugPublishReserve } from "../utils/publishReserveDebug";

export type PaymentReservationSnapshot = Readonly<{
  plannedMinutesSnapshot: number;
  hourlyRateSnapshot: Prisma.Decimal;
  headcountSnapshot: number;
  reservedAmount: Prisma.Decimal;
  currency: string;
}>;

type ReservationJobRow = {
  id: number;
  user_id: string | null;
  status: string;
  duration: string | null;
  start_time: string | null;
  end_time: string | null;
  people_needed: string | null;
  hourly_rate_base: Prisma.Decimal | string | number | null;
};

type ReservationRecord = {
  id: number;
  job_id: number;
  customer_user_id: string;
  provider: string;
  currency: string;
  planned_minutes_snapshot: number;
  hourly_rate_snapshot: Prisma.Decimal | string | number;
  reserved_amount: Prisma.Decimal | string | number;
  status: string;
  reserved_at: Date | string | null;
  reservation_expires_at: Date | string | null;
  released_at: Date | string | null;
  refunded_at: Date | string | null;
  last_error: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type ReservationCreationResult = Readonly<{
  created: boolean;
  reservation: Readonly<{
    id: string;
    jobId: string;
    customerUserId: string;
    status: string;
    provider: string;
    currency: string;
    plannedMinutesSnapshot: number;
    hourlyRateSnapshot: string;
    reservedAmount: string;
    reservedAt: string | null;
    reservationExpiresAt: string | null;
    releasedAt: string | null;
    refundedAt: string | null;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}>;

const ACTIVE_RESERVATION_STATUSES = new Set(["reserve_pending", "reserved", "release_pending"]);
const PUBLISHABLE_JOB_STATUSES = new Set(["draft", "open"]);

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function decimalToString(value: Prisma.Decimal | string | number | null | undefined): string {
  if (value == null) return "0.00";
  return new Prisma.Decimal(String(value)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function isPublishableJobStatus(value: string | null | undefined): boolean {
  return PUBLISHABLE_JOB_STATUSES.has(normalizeStatus(value));
}

function isActiveReservationStatus(value: string | null | undefined): boolean {
  return ACTIVE_RESERVATION_STATUSES.has(normalizeStatus(value));
}

function mapReservationRecord(record: ReservationRecord): ReservationCreationResult["reservation"] {
  return Object.freeze({
    id: String(record.id),
    jobId: String(record.job_id),
    customerUserId: String(record.customer_user_id),
    status: record.status,
    provider: record.provider,
    currency: record.currency,
    plannedMinutesSnapshot: Number(record.planned_minutes_snapshot) || 0,
    hourlyRateSnapshot: decimalToString(record.hourly_rate_snapshot),
    reservedAmount: decimalToString(record.reserved_amount),
    reservedAt: toIso(record.reserved_at),
    reservationExpiresAt: toIso(record.reservation_expires_at),
    releasedAt: toIso(record.released_at),
    refundedAt: toIso(record.refunded_at),
    lastError: record.last_error ?? null,
    createdAt: toIso(record.created_at) ?? new Date(0).toISOString(),
    updatedAt: toIso(record.updated_at) ?? new Date(0).toISOString(),
  });
}

function timeStringToMinutes(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function parseDecimal(value: Prisma.Decimal | string | number | null | undefined, fieldName: string): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return new Prisma.Decimal(value.toString());
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Prisma.Decimal(value.toString());
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Prisma.Decimal(value.trim());
    if (!parsed.isFinite()) {
      throw new ServiceError(`jobs.${fieldName} must be a valid number.`, 400);
    }
    return parsed;
  }
  throw new ServiceError(`jobs.${fieldName} is required to calculate the reservation amount.`, 400);
}

function parseHeadcount(value: string | null | undefined): number {
  if (value == null || String(value).trim() === "") {
    return 1;
  }

  const parsed = Number.parseInt(String(value).trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ServiceError("jobs.people_needed must be a positive whole number when multiple staff are required.", 400);
  }
  return parsed;
}

function parsePlannedDurationMinutes(job: Pick<ReservationJobRow, "duration" | "start_time" | "end_time">): number {
  const rawDuration = typeof job.duration === "string" ? job.duration.trim() : "";
  if (rawDuration) {
    const durationHours = Number.parseFloat(rawDuration);
    if (Number.isFinite(durationHours) && durationHours > 0) {
      return Math.round(durationHours * 60);
    }
  }

  const startMinutes = timeStringToMinutes(job.start_time);
  const endMinutes = timeStringToMinutes(job.end_time);
  if (startMinutes == null || endMinutes == null) {
    throw new ServiceError(
      "Cannot calculate reserved amount: jobs.duration is missing or non-numeric, and jobs.start_time/jobs.end_time are not both valid HH:mm values.",
      400
    );
  }

  const minutesPerDay = 24 * 60;
  const durationMinutes = endMinutes <= startMinutes ? minutesPerDay - startMinutes + endMinutes : endMinutes - startMinutes;
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new ServiceError("Cannot calculate reserved amount: planned duration is invalid.", 400);
  }

  return Math.round(durationMinutes);
}

function freezeSnapshot(snapshot: PaymentReservationSnapshot): PaymentReservationSnapshot {
  return Object.freeze(snapshot) as PaymentReservationSnapshot;
}

export function calculatePaymentReservationSnapshotFromJob(job: ReservationJobRow): PaymentReservationSnapshot {
  if (!job || !Number.isInteger(job.id) || job.id < 1) {
    throw new ServiceError("Job not found.", 404);
  }

  const plannedMinutesSnapshot = parsePlannedDurationMinutes(job);
  const hourlyRateSnapshot = parseDecimal(job.hourly_rate_base, "hourly_rate_base");
  const headcountSnapshot = parseHeadcount(job.people_needed);

  const reservedAmount = hourlyRateSnapshot
    .mul(new Prisma.Decimal(plannedMinutesSnapshot))
    .div(new Prisma.Decimal(60))
    .mul(new Prisma.Decimal(headcountSnapshot))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return freezeSnapshot({
    plannedMinutesSnapshot,
    hourlyRateSnapshot,
    headcountSnapshot,
    reservedAmount,
    currency: "MDL",
  });
}

export async function calculatePaymentReservationSnapshot(jobId: number): Promise<PaymentReservationSnapshot> {
  if (!Number.isInteger(jobId) || jobId < 1) {
    throw new ServiceError("Job not found.", 404);
  }

  const job = await prisma.jobs.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      duration: true,
      start_time: true,
      end_time: true,
      people_needed: true,
      hourly_rate_base: true,
    },
  });

  if (!job) {
    throw new ServiceError("Job not found.", 404);
  }

  return calculatePaymentReservationSnapshotFromJob(job as ReservationJobRow);
}

async function loadReservationContext(jobId: number) {
  return prisma.jobs.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      user_id: true,
      status: true,
      duration: true,
      start_time: true,
      end_time: true,
      people_needed: true,
      hourly_rate_base: true,
      job_payment_reservation: {
        select: {
          id: true,
          job_id: true,
          customer_user_id: true,
          provider: true,
          currency: true,
          planned_minutes_snapshot: true,
          hourly_rate_snapshot: true,
          reserved_amount: true,
          status: true,
          reserved_at: true,
          reservation_expires_at: true,
          released_at: true,
          refunded_at: true,
          last_error: true,
          created_at: true,
          updated_at: true,
        },
      },
    },
  });
}

function buildReservationData(params: {
  job: ReservationJobRow;
  snapshot: PaymentReservationSnapshot;
  customerUserId: string;
}) {
  return {
    job_id: params.job.id,
    customer_user_id: params.customerUserId,
    provider: "paynet" as const,
    currency: params.snapshot.currency,
    planned_minutes_snapshot: params.snapshot.plannedMinutesSnapshot,
    hourly_rate_snapshot: params.snapshot.hourlyRateSnapshot,
    reserved_amount: params.snapshot.reservedAmount,
    status: "reserve_pending" as const,
    reserved_at: null,
    reservation_expires_at: computeReservationExpiresAt(),
    released_at: null,
    refunded_at: null,
    last_error: null,
  };
}

export async function createJobReservation(jobId: number): Promise<ReservationCreationResult> {
  debugPublishReserve("createJobReservation start", { jobId });
  if (!Number.isInteger(jobId) || jobId < 1) {
    throw new ServiceError("Job not found.", 404);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      debugPublishReserve("createJobReservation transaction opened", { jobId });
      const job = await tx.jobs.findUnique({
        where: { id: jobId },
        select: {
          id: true,
          user_id: true,
          status: true,
          duration: true,
          start_time: true,
          end_time: true,
          people_needed: true,
          hourly_rate_base: true,
          job_payment_reservation: {
            select: {
              id: true,
              job_id: true,
              customer_user_id: true,
              provider: true,
              currency: true,
              planned_minutes_snapshot: true,
              hourly_rate_snapshot: true,
              reserved_amount: true,
              status: true,
              reserved_at: true,
              reservation_expires_at: true,
              released_at: true,
              refunded_at: true,
              last_error: true,
              created_at: true,
              updated_at: true,
            },
          },
        },
      });

      if (!job) {
        throw new ServiceError("Job not found.", 404);
      }

      debugPublishReserve("createJobReservation job loaded in tx", {
        jobId,
        jobStatus: job.status,
        userId: job.user_id,
        hasExistingReservation: Boolean(job.job_payment_reservation),
        existingStatus: job.job_payment_reservation?.status ?? null,
      });

      if (!isPublishableJobStatus(job.status)) {
        debugPublishReserve("createJobReservation blocked: job not publishable", { jobId, status: job.status });
        throw new ServiceError("Job is not publishable. Only Draft/Open jobs can reserve funds.", 400);
      }

      if (!job.user_id) {
        debugPublishReserve("createJobReservation blocked: missing user_id", { jobId });
        throw new ServiceError("Job is missing the customer owner required for reservation creation.", 400);
      }

      let snapshot: PaymentReservationSnapshot;
      try {
        snapshot = calculatePaymentReservationSnapshotFromJob(job);
        debugPublishReserve("createJobReservation snapshot calculated", {
          jobId,
          plannedMinutes: snapshot.plannedMinutesSnapshot,
          reservedAmount: decimalToString(snapshot.reservedAmount),
        });
      } catch (snapErr) {
        debugPublishReserve("createJobReservation snapshot validation failed", {
          jobId,
          error: snapErr instanceof Error ? snapErr.message : String(snapErr),
        });
        throw snapErr;
      }

      const existing = job.job_payment_reservation as ReservationRecord | null | undefined;

      if (existing) {
        if (isActiveReservationStatus(existing.status)) {
          debugPublishReserve("createJobReservation early return: active reservation exists", {
            jobId,
            reservationId: existing.id,
            status: existing.status,
          });
          const existingFull = await tx.job_payment_reservations.findUnique({
            where: { id: existing.id },
            select: { paynet_order_id: true, status: true },
          });
          if (
            normalizeStatus(existingFull?.status) === "reserve_pending" &&
            existingFull?.paynet_order_id
          ) {
            throw new ServiceError(
              "Rezervarea este deja trimisă la Paynet. Folosește reîncercarea plății sau așteaptă confirmarea.",
              409
            );
          }
          return Object.freeze({
            created: false,
            reservation: mapReservationRecord(existing),
          });
        }

        debugPublishReserve("createJobReservation Prisma update (inactive prior reservation)", {
          jobId,
          reservationId: existing.id,
        });
        const updated = await tx.job_payment_reservations.update({
          where: { id: existing.id },
          data: buildReservationData({
            job: job as ReservationJobRow,
            snapshot,
            customerUserId: job.user_id,
          }),
        });
        debugPublishReserve("createJobReservation Prisma update done", {
          jobId,
          reservationId: updated.id,
          status: updated.status,
        });

        return Object.freeze({
          created: false,
          reservation: mapReservationRecord(updated as unknown as ReservationRecord),
        });
      }

      debugPublishReserve("createJobReservation Prisma create", { jobId, model: "job_payment_reservations" });
      const created = await tx.job_payment_reservations.create({
        data: buildReservationData({
          job: job as ReservationJobRow,
          snapshot,
          customerUserId: job.user_id,
        }),
      });
      debugPublishReserve("createJobReservation Prisma create done", {
        jobId,
        reservationId: created.id,
        status: created.status,
      });

      await logPaymentAudit(PaymentActionType.RESERVATION_CREATED, {
        actorUserId: job.user_id,
        targetJobId: jobId,
        summary: `Reservation created for job ${jobId}`,
        metadata: {
          reservationId: created.id,
          reservedAmount: decimalToString(snapshot.reservedAmount),
        },
      });

      return Object.freeze({
        created: true,
        reservation: mapReservationRecord(created as unknown as ReservationRecord),
      });
    });
    debugPublishReserve("createJobReservation transaction committed", {
      jobId,
      created: result.created,
      reservationId: result.reservation.id,
    });
    return result;
  } catch (error) {
    debugPublishReserve("createJobReservation catch", {
      jobId,
      isServiceError: error instanceof ServiceError,
      isPrismaKnown: error instanceof Prisma.PrismaClientKnownRequestError,
      code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const job = await loadReservationContext(jobId);
      if (job?.job_payment_reservation) {
        const existing = job.job_payment_reservation as ReservationRecord;
        if (isActiveReservationStatus(existing.status)) {
          return Object.freeze({
            created: false,
            reservation: mapReservationRecord(existing),
          });
        }
      }
      throw new ServiceError("Job already has a reservation.", 409);
    }

    if (error instanceof ServiceError) {
      throw error;
    }

    console.error("[PaymentReservation] createJobReservation failed:", error);
    throw new ServiceError("Failed to create reservation.", 500);
  }
}