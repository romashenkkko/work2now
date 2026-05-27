import { Prisma } from "@prisma/client";
import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";

export type PaymentAmountSnapshot = Readonly<{
  workedMinutes: number;
  hourlyRateSnapshot: Prisma.Decimal;
  amountDue: Prisma.Decimal;
}>;

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDurationSeconds(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    throw new ServiceError("Session is incomplete or invalid. Checkout must be after check-in.", 400);
  }
  return diffMs / 1000;
}

function asDecimal(value: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return new Prisma.Decimal(value.toString());
  if (typeof value === "number") return new Prisma.Decimal(value.toFixed(2));
  if (typeof value === "string" && value.trim()) return new Prisma.Decimal(value.trim());
  throw new ServiceError("Job hourly rate is required to calculate payment amount.", 400);
}

function freezeSnapshot(snapshot: {
  workedMinutes: number;
  hourlyRateSnapshot: Prisma.Decimal;
  amountDue: Prisma.Decimal;
}): PaymentAmountSnapshot {
  return Object.freeze(snapshot) as PaymentAmountSnapshot;
}

export function calculatePaymentAmountSnapshotFromMinutes(
  workedMinutes: number,
  hourlyRateSnapshot: Prisma.Decimal | number | string
): PaymentAmountSnapshot {
  if (!Number.isFinite(workedMinutes) || workedMinutes < 0) {
    throw new ServiceError("Worked minutes are invalid.", 400);
  }

  const hourlyRate = asDecimal(hourlyRateSnapshot);
  const amountDue = hourlyRate
    .mul(new Prisma.Decimal(workedMinutes))
    .div(new Prisma.Decimal(60))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

  return freezeSnapshot({
    workedMinutes: Math.round(workedMinutes),
    hourlyRateSnapshot: hourlyRate,
    amountDue,
  });
}

export async function calculatePaymentAmountSnapshot(applicationId: number): Promise<PaymentAmountSnapshot> {
  if (!Number.isInteger(applicationId) || applicationId < 1) {
    throw new ServiceError("Application not found.", 404);
  }

  const application = await prisma.applications.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      checked_in_at: true,
      checked_out_at: true,
      application_work_sessions: {
        select: {
          checked_in_at: true,
          checked_out_at: true,
        },
        orderBy: { work_date: "asc" },
      },
      jobs: {
        select: {
          hourly_rate_base: true,
        },
      },
    },
  });

  if (!application) {
    throw new ServiceError("Application not found.", 404);
  }

  const hourlyRate = asDecimal(application.jobs?.hourly_rate_base ?? null);
  const sessions = application.application_work_sessions ?? [];

  let totalSeconds = 0;
  let hasCompleteSession = false;

  if (sessions.length > 0) {
    for (const session of sessions) {
      const checkedInAt = toDate(session.checked_in_at);
      const checkedOutAt = toDate(session.checked_out_at);

      if ((checkedInAt && !checkedOutAt) || (!checkedInAt && checkedOutAt)) {
        throw new ServiceError("Session is incomplete. Both check-in and check-out are required.", 400);
      }

      if (!checkedInAt || !checkedOutAt) {
        continue;
      }

      totalSeconds += getDurationSeconds(checkedInAt, checkedOutAt);
      hasCompleteSession = true;
    }
  }

  if (!hasCompleteSession) {
    const appCheckedInAt = toDate(application.checked_in_at);
    const appCheckedOutAt = toDate(application.checked_out_at);

    if ((appCheckedInAt && !appCheckedOutAt) || (!appCheckedInAt && appCheckedOutAt)) {
      throw new ServiceError("Work session is incomplete. Both check-in and check-out are required.", 400);
    }

    if (!appCheckedInAt || !appCheckedOutAt) {
      throw new ServiceError("No completed work session found for this application.", 400);
    }

    totalSeconds = getDurationSeconds(appCheckedInAt, appCheckedOutAt);
  }

  const workedMinutes = Math.round(totalSeconds / 60);

  return calculatePaymentAmountSnapshotFromMinutes(workedMinutes, hourlyRate);
}