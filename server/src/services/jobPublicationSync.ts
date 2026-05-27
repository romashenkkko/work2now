import type { Prisma } from "@prisma/client";

/** Matches dashboard / legacy string job vacancy display. */
const LIVE_JOB_STATUS = "Open";
const LIVE_JOB_STATUS_CLASS = "bg-green-100 text-green-800";
const DRAFT_JOB_STATUS = "Draft";
const DRAFT_JOB_STATUS_CLASS = "bg-gray-100 text-gray-700";

export type PrismaTx = Prisma.TransactionClient;

export async function markJobPublishedWhenReservationReserved(tx: PrismaTx, jobId: number, now: Date): Promise<void> {
  await tx.jobs.update({
    where: { id: jobId },
    data: {
      status: LIVE_JOB_STATUS,
      status_class: LIVE_JOB_STATUS_CLASS,
      published_at: now,
      publish_blocked_reason: null,
    },
  });
}

export async function markJobUnpublishedOnReservationFailure(
  tx: PrismaTx,
  jobId: number,
  reason: string | null,
  _now: Date
): Promise<void> {
  await tx.jobs.update({
    where: { id: jobId },
    data: {
      status: DRAFT_JOB_STATUS,
      status_class: DRAFT_JOB_STATUS_CLASS,
      publish_blocked_reason: reason?.trim() || "Payment reservation failed.",
    },
  });
}
