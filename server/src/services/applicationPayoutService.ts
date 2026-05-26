import { Prisma } from "@prisma/client";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { calculatePaymentAmountSnapshot } from "./paymentAmountService";
import { assertPayoutTransition } from "./paymentStateMachine";
import { logPaymentAudit, PaymentActionType } from "./paymentFlowDiagnostics";

const PAYOUT_DUE_HOURS = 72;

export type ConfirmCompletionInput = Readonly<{
  confirmed?: boolean;
  approvedOvertimeMinutes?: number;
}>;

export type ApplicationPayoutDto = Readonly<{
  id: string;
  applicationId: string;
  status: string;
  currency: string;
  plannedMinutesSnapshot: number;
  actualMinutesSnapshot: number;
  approvedOvertimeMinutes: number;
  hourlyRateSnapshot: string;
  reservedAmountSnapshot: string;
  grossAmount: string;
  overtimeAmount: string;
  netPayoutAmount: string;
  payoutDueAt: string | null;
  payoutPendingAt: string | null;
}>;

function norm(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function decimalToString(value: Prisma.Decimal | string | number): string {
  return new Prisma.Decimal(String(value)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2);
}

function toIso(value: Date | null | undefined): string | null {
  if (value == null) return null;
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

type ReservationRow = {
  id: number;
  job_id: number;
  customer_user_id: string;
  currency: string;
  planned_minutes_snapshot: number;
  hourly_rate_snapshot: Prisma.Decimal;
  reserved_amount: Prisma.Decimal;
  status: string;
};

export async function assertJobReservationAllowsWork(jobId: number): Promise<ReservationRow> {
  const job = await prisma.jobs.findUnique({
    where: { id: jobId },
    select: {
      status: true,
      job_payment_reservation: {
        select: {
          id: true,
          job_id: true,
          customer_user_id: true,
          currency: true,
          planned_minutes_snapshot: true,
          hourly_rate_snapshot: true,
          reserved_amount: true,
          status: true,
        },
      },
    },
  });

  if (!job) {
    throw new ServiceError("Job negăsit.", 404);
  }

  if (norm(job.status) !== "open") {
    throw new ServiceError("Jobul nu este publicat. Check-in nu este permis.", 400);
  }

  const reservation = job.job_payment_reservation;
  if (!reservation) {
    throw new ServiceError("Rezervarea de plată lipsește. Check-in nu este permis.", 400);
  }

  const resStatus = norm(reservation.status);
  if (resStatus === "cancelled" || resStatus === "refunded" || resStatus === "released") {
    throw new ServiceError("Rezervarea de plată nu mai este activă. Check-in nu este permis.", 400);
  }

  if (resStatus !== "reserved") {
    throw new ServiceError("Rezervarea de plată nu este confirmată. Check-in nu este permis.", 400);
  }

  return reservation;
}

function mapPayoutRow(row: {
  id: number;
  application_id: number;
  status: string;
  currency: string;
  planned_minutes_snapshot: number;
  actual_minutes_snapshot: number;
  approved_overtime_minutes: number;
  hourly_rate_snapshot: Prisma.Decimal;
  reserved_amount_snapshot: Prisma.Decimal;
  payout_amount: Prisma.Decimal;
  overtime_amount_snapshot: Prisma.Decimal;
  payout_due_at: Date | null;
  payout_pending_at: Date | null;
}): ApplicationPayoutDto {
  const actualMinutes = Number(row.actual_minutes_snapshot) || 0;
  const grossAmount = new Prisma.Decimal(row.hourly_rate_snapshot.toString())
    .mul(new Prisma.Decimal(actualMinutes))
    .div(new Prisma.Decimal(60))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return Object.freeze({
    id: String(row.id),
    applicationId: String(row.application_id),
    status: row.status,
    currency: row.currency,
    plannedMinutesSnapshot: Number(row.planned_minutes_snapshot) || 0,
    actualMinutesSnapshot: actualMinutes,
    approvedOvertimeMinutes: Number(row.approved_overtime_minutes) || 0,
    hourlyRateSnapshot: decimalToString(row.hourly_rate_snapshot),
    reservedAmountSnapshot: decimalToString(row.reserved_amount_snapshot),
    grossAmount: decimalToString(grossAmount),
    overtimeAmount: decimalToString(row.overtime_amount_snapshot),
    netPayoutAmount: decimalToString(row.payout_amount),
    payoutDueAt: toIso(row.payout_due_at),
    payoutPendingAt: toIso(row.payout_pending_at),
  });
}

export type PayoutAmountBreakdown = Readonly<{
  actualMinutes: number;
  plannedMinutes: number;
  approvedOvertimeMinutes: number;
  billableMinutes: number;
  grossAmount: Prisma.Decimal;
  overtimeAmount: Prisma.Decimal;
  netPayoutAmount: Prisma.Decimal;
}>;

export function calculatePayoutAmountBreakdown(params: {
  actualMinutes: number;
  plannedMinutes: number;
  approvedOvertimeMinutes: number;
  hourlyRate: Prisma.Decimal | string | number;
}): PayoutAmountBreakdown {
  const actualMinutes = Math.max(0, Math.round(params.actualMinutes));
  const plannedMinutes = Math.max(0, Math.round(params.plannedMinutes));
  const hourlyRate = new Prisma.Decimal(String(params.hourlyRate));

  const maxOvertime = Math.max(0, actualMinutes - plannedMinutes);
  let approvedOvertime = Math.max(0, Math.round(params.approvedOvertimeMinutes));
  if (approvedOvertime > maxOvertime) {
    throw new ServiceError(
      `Overtime aprobat (${approvedOvertime} min) depășește overtime-ul efectiv (${maxOvertime} min).`,
      400
    );
  }

  const regularMinutes = Math.min(actualMinutes, plannedMinutes);
  const billableMinutes = regularMinutes + approvedOvertime;

  const grossAmount = hourlyRate
    .mul(new Prisma.Decimal(actualMinutes))
    .div(new Prisma.Decimal(60))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const overtimeAmount = hourlyRate
    .mul(new Prisma.Decimal(approvedOvertime))
    .div(new Prisma.Decimal(60))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  const netPayoutAmount = hourlyRate
    .mul(new Prisma.Decimal(billableMinutes))
    .div(new Prisma.Decimal(60))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return Object.freeze({
    actualMinutes,
    plannedMinutes,
    approvedOvertimeMinutes: approvedOvertime,
    billableMinutes,
    grossAmount,
    overtimeAmount,
    netPayoutAmount,
  });
}

/** Create or refresh payout row when staff checks in (status → in_progress). */
export async function ensureApplicationPayoutOnCheckIn(
  tx: Prisma.TransactionClient,
  params: {
    applicationId: number;
    jobId: number;
    staffUserId: string;
    reservation: ReservationRow;
  }
): Promise<void> {
  const existing = await tx.application_payouts.findUnique({
    where: { application_id: params.applicationId },
    select: { id: true, status: true },
  });

  if (existing) {
    const st = norm(existing.status);
    if (st === "paid" || st === "payout_pending") {
      throw new ServiceError("Plata pentru această aplicație este deja în curs de procesare.", 409);
    }
    if (st === "cancelled" || st === "disputed") {
      throw new ServiceError("Plata pentru această aplicație a fost anulată.", 400);
    }
    assertPayoutTransition(existing.status, "in_progress", {
      applicationId: params.applicationId,
    });
    await tx.application_payouts.update({
      where: { id: existing.id },
      data: {
        status: "in_progress",
        updated_at: new Date(),
      },
    });
    return;
  }

  await tx.application_payouts.create({
    data: {
      job_payment_reservation_id: params.reservation.id,
      job_id: params.jobId,
      application_id: params.applicationId,
      customer_user_id: params.reservation.customer_user_id,
      staff_user_id: params.staffUserId,
      currency: params.reservation.currency,
      planned_minutes_snapshot: params.reservation.planned_minutes_snapshot,
      actual_minutes_snapshot: 0,
      approved_overtime_minutes: 0,
      hourly_rate_snapshot: params.reservation.hourly_rate_snapshot,
      reserved_amount_snapshot: params.reservation.reserved_amount,
      payout_amount: new Prisma.Decimal(0),
      overtime_amount_snapshot: new Prisma.Decimal(0),
      status: "in_progress",
    },
  });
}

/** After check-out: awaiting customer confirmation. */
export async function markApplicationPayoutAwaitingCustomerConfirmation(
  tx: Prisma.TransactionClient,
  applicationId: number
): Promise<void> {
  const payout = await tx.application_payouts.findUnique({
    where: { application_id: applicationId },
  });

  if (!payout) {
    throw new ServiceError("Înregistrarea de plată lipsește. Efectuează check-in înainte de check-out.", 400);
  }

  const st = norm(payout.status);
  if (st === "payout_pending" || st === "paid") {
    return;
  }

  if (st === "cancelled" || st === "disputed") {
    throw new ServiceError("Plata pentru această aplicație nu mai poate continua.", 400);
  }

  assertPayoutTransition(payout.status, "awaiting_customer_confirmation", {
    applicationId,
  });
  await tx.application_payouts.update({
    where: { id: payout.id },
    data: {
      status: "awaiting_customer_confirmation",
      updated_at: new Date(),
    },
  });
  await logPaymentAudit(PaymentActionType.PAYOUT_AWAITING_CUSTOMER, {
    targetApplicationId: applicationId,
    targetJobId: payout.job_id,
    summary: "Staff checked out — awaiting customer confirmation",
  });
}

export async function finalizeApplicationPayoutOnCustomerConfirmation(
  userId: string,
  applicationIdRaw: string,
  input: ConfirmCompletionInput = {}
): Promise<{ payout: ApplicationPayoutDto | null; refused: boolean; alreadyConfirmed: boolean }> {
  const applicationId = Number.parseInt(applicationIdRaw, 10);
  if (!Number.isInteger(applicationId) || applicationId < 1) {
    throw new ServiceError("Aplicație negăsită.", 404);
  }

  const confirmed = input.confirmed !== false;
  const app = await prisma.applications.findFirst({
    where: { id: applicationId },
    include: {
      jobs: {
        select: {
          user_id: true,
          id: true,
          Title: true,
          job_payment_reservation: {
            select: {
              id: true,
              job_id: true,
              customer_user_id: true,
              currency: true,
              planned_minutes_snapshot: true,
              hourly_rate_snapshot: true,
              reserved_amount: true,
              status: true,
            },
          },
        },
      },
      application_payout: true,
    },
  });

  if (!app || app.jobs.user_id !== userId) {
    throw new ServiceError("Aplicație negăsită.", 404);
  }

  if (app.status !== "accepted") {
    throw new ServiceError("Doar aplicațiile acceptate pot fi confirmate ca finalizate.", 400);
  }

  if (!app.staff_id) {
    throw new ServiceError("Aplicația nu are staff asignat.", 400);
  }

  const reservation = app.jobs.job_payment_reservation;
  if (!reservation || norm(reservation.status) !== "reserved") {
    throw new ServiceError("Rezervarea de plată nu este activă pentru acest job.", 400);
  }

  if (app.checked_in_at == null || app.checked_out_at == null) {
    throw new ServiceError("Staff trebuie să efectueze check-in și check-out înainte de confirmare.", 400);
  }

  const payoutRow = app.application_payout;
  if (confirmed) {
    if (!payoutRow) {
      throw new ServiceError("Înregistrarea de plată lipsește. Staff trebuie să finalizeze check-out înainte de confirmare.", 400);
    }
    const payoutSt = norm(payoutRow.status);
    if (payoutSt !== "awaiting_customer_confirmation" && payoutSt !== "in_progress") {
      throw new ServiceError(
        "Confirmarea nu este disponibilă în starea curentă a plății. Reîmprospătează pagina.",
        409
      );
    }
    if (payoutSt === "in_progress") {
      throw new ServiceError("Staff trebuie să efectueze check-out înainte de confirmare.", 400);
    }
  }

  if (!confirmed) {
    return await prisma.$transaction(async (tx) => {
      const payout = await tx.application_payouts.findUnique({ where: { application_id: applicationId } });
      if (payout) {
        await tx.application_payouts.update({
          where: { id: payout.id },
          data: {
            status: "cancelled",
            last_error: "Customer declined completion confirmation.",
            updated_at: new Date(),
          },
        });
      }
      return { payout: null, refused: true, alreadyConfirmed: false };
    });
  }

  if (app.business_confirmed_at != null) {
    const existing = app.application_payout;
    if (existing && (norm(existing.status) === "payout_pending" || norm(existing.status) === "paid")) {
      return {
        payout: mapPayoutRow(existing),
        refused: false,
        alreadyConfirmed: true,
      };
    }
  }

  const amountSnapshot = await calculatePaymentAmountSnapshot(applicationId);
  const breakdown = calculatePayoutAmountBreakdown({
    actualMinutes: amountSnapshot.workedMinutes,
    plannedMinutes: reservation.planned_minutes_snapshot,
    approvedOvertimeMinutes: input.approvedOvertimeMinutes ?? 0,
    hourlyRate: reservation.hourly_rate_snapshot,
  });

  const reservedCap = new Prisma.Decimal(reservation.reserved_amount.toString());
  if (breakdown.netPayoutAmount.greaterThan(reservedCap)) {
    throw new ServiceError(
      "Suma calculată depășește suma rezervată. Contactează suportul.",
      400
    );
  }

  const now = new Date();
  const payoutDueAt = new Date(now.getTime() + PAYOUT_DUE_HOURS * 60 * 60 * 1000);

  const payout = await prisma.$transaction(async (tx) => {
    const fresh = await tx.applications.findUnique({
      where: { id: applicationId },
      select: { business_confirmed_at: true },
    });

    if (fresh?.business_confirmed_at != null) {
      const existingPayout = await tx.application_payouts.findUnique({ where: { application_id: applicationId } });
      if (existingPayout && norm(existingPayout.status) === "payout_pending") {
        return existingPayout;
      }
    }

    await tx.applications.update({
      where: { id: applicationId },
      data: { business_confirmed_at: now },
    });

    const payoutData = {
      job_payment_reservation_id: reservation.id,
      job_id: app.job_id,
      application_id: applicationId,
      customer_user_id: reservation.customer_user_id,
      staff_user_id: app.staff_id!,
      currency: reservation.currency,
      planned_minutes_snapshot: reservation.planned_minutes_snapshot,
      actual_minutes_snapshot: breakdown.actualMinutes,
      approved_overtime_minutes: breakdown.approvedOvertimeMinutes,
      hourly_rate_snapshot: reservation.hourly_rate_snapshot,
      reserved_amount_snapshot: reservation.reserved_amount,
      payout_amount: breakdown.netPayoutAmount,
      overtime_amount_snapshot: breakdown.overtimeAmount,
      status: "payout_pending" as const,
      payout_due_at: payoutDueAt,
      payout_pending_at: now,
      last_error: null,
      updated_at: now,
    };

    const existing = await tx.application_payouts.findUnique({ where: { application_id: applicationId } });
    if (existing) {
      if (norm(existing.status) === "payout_pending" || norm(existing.status) === "paid") {
        return existing;
      }
      assertPayoutTransition(existing.status, "payout_pending", {
        applicationId,
        payoutId: existing.id,
      });
      return tx.application_payouts.update({
        where: { id: existing.id },
        data: payoutData,
      });
    }

    try {
      return await tx.application_payouts.create({ data: payoutData });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const concurrent = await tx.application_payouts.findUnique({ where: { application_id: applicationId } });
        if (concurrent) return concurrent;
      }
      throw error;
    }
  });

  await logPaymentAudit(PaymentActionType.PAYOUT_PENDING, {
    actorUserId: userId,
    targetApplicationId: applicationId,
    targetJobId: app.job_id,
    jobTitle: app.jobs.Title ?? null,
    staffName: app.staff_name ?? null,
    summary: "Customer confirmed completion — payout pending",
    metadata: {
      netPayoutAmount: decimalToString(breakdown.netPayoutAmount),
      payoutDueAt: payoutDueAt.toISOString(),
    },
  });

  return {
    payout: mapPayoutRow(payout),
    refused: false,
    alreadyConfirmed: false,
  };
}

export async function getApplicationPayoutForStaff(
  staffUserId: string,
  applicationId: number
): Promise<ApplicationPayoutDto | null> {
  const row = await prisma.application_payouts.findFirst({
    where: { application_id: applicationId, staff_user_id: staffUserId },
  });
  return row ? mapPayoutRow(row) : null;
}

export type StaffPayoutSummary = Readonly<{
  status: string;
  netPayoutAmount: string;
  currency: string;
  payoutDueAt: string | null;
  payoutPendingAt: string | null;
}>;

export function mapPayoutToStaffSummary(
  payout: { status: string; payout_amount: Prisma.Decimal; currency: string; payout_due_at: Date | null; payout_pending_at: Date | null } | null | undefined
): StaffPayoutSummary | undefined {
  if (!payout) return undefined;
  return Object.freeze({
    status: payout.status,
    netPayoutAmount: decimalToString(payout.payout_amount),
    currency: payout.currency,
    payoutDueAt: toIso(payout.payout_due_at),
    payoutPendingAt: toIso(payout.payout_pending_at),
  });
}
