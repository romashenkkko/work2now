import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";
import { UserRole, userRoleToString } from "../enums";

export type AddActivityLogInput = {
  actorUserId?: string;
  actionType: string;
  targetType?: string;
  targetJobId?: number | null;
  targetApplicationId?: number | null;
  targetUserId?: string | null;
  staffName?: string | null;
  jobTitle?: string | null;
  businessName?: string | null;
  workDate?: string | null; // YYYY-MM-DD
  workSessionCheckedInAt?: Date | null;
  workSessionCheckedOutAt?: Date | null;
  summary?: string | null;
  metadata?: string | null;
};

async function requireSupportOrAdmin(userId?: string): Promise<string> {
  const resolvedUserId = String(userId ?? "").trim();
  if (!resolvedUserId) throw new ServiceError("Unauthorized", 401);

  const user = await prisma.users.findUnique({
    where: { Id: resolvedUserId },
    select: { Role: true },
  });
  if (!user || (user.Role !== UserRole.Admin && user.Role !== UserRole.Support)) {
    throw new ServiceError("Doar support / administrator poate accesa.", 403);
  }
  return resolvedUserId;
}

async function resolveActorFields(actorUserId?: string) {
  if (!actorUserId) return { actorRole: null as number | null, actorEmail: null as string | null, actorRoleStr: "" };
  const u = await prisma.users.findUnique({
    where: { Id: actorUserId },
    select: { Role: true, Email: true },
  });
  return {
    actorRole: u?.Role ?? null,
    actorEmail: u?.Email ?? null,
    actorRoleStr: u?.Role != null ? userRoleToString(u.Role as UserRole) : "",
  };
}

export async function addActivityLog(input: AddActivityLogInput): Promise<void> {
  try {
    const { actorRole, actorEmail } = await resolveActorFields(input.actorUserId);
    await prisma.$executeRaw`
      INSERT INTO activity_logs (
        actor_user_id,
        actor_role,
        actor_email,
        action_type,
        target_type,
        target_job_id,
        target_application_id,
        target_user_id,
        staff_name,
        job_title,
        business_name,
        work_date,
        work_session_checked_in_at,
        work_session_checked_out_at,
        summary,
        metadata
      ) VALUES (
        ${input.actorUserId ?? null},
        ${actorRole ?? null},
        ${actorEmail ?? null},
        ${input.actionType},
        ${input.targetType ?? null},
        ${input.targetJobId ?? null},
        ${input.targetApplicationId ?? null},
        ${input.targetUserId ?? null},
        ${input.staffName ?? null},
        ${input.jobTitle ?? null},
        ${input.businessName ?? null},
        ${input.workDate ?? null},
        ${input.workSessionCheckedInAt ?? null},
        ${input.workSessionCheckedOutAt ?? null},
        ${input.summary ?? null},
        ${input.metadata ?? null}
      )
    `;
  } catch (e) {
    // Logging must never break core flows.
    console.warn("[ActivityLog] failed:", e);
  }
}

export type ActivityLogRow = {
  id: number;
  createdAt: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: number | null;
  actionType: string;
  targetType?: string | null;
  targetJobId?: number | null;
  targetApplicationId?: number | null;
  staffName?: string | null;
  jobTitle?: string | null;
  businessName?: string | null;
  workDate?: string | null;
  workSessionCheckedInAt?: string | null;
  workSessionCheckedOutAt?: string | null;
  summary?: string | null;
};

export async function listActivityLogsForSupport(actorUserId?: string, limit = 200, offset = 0): Promise<{ logs: ActivityLogRow[] }> {
  await requireSupportOrAdmin(actorUserId);
  const lim = Math.min(500, Math.max(1, Number(limit) || 200));
  const off = Math.max(0, Number(offset) || 0);

  const rows = await prisma.$queryRaw<
    Array<Record<string, unknown>>
  >`
    SELECT
      id,
      created_at,
      actor_user_id,
      actor_role,
      actor_email,
      action_type,
      target_type,
      target_job_id,
      target_application_id,
      staff_name,
      job_title,
      business_name,
      work_date,
      work_session_checked_in_at,
      work_session_checked_out_at,
      summary
    FROM activity_logs
    ORDER BY created_at DESC
    LIMIT ${lim}
    OFFSET ${off}
  `;

  return {
    logs: rows.map((r) => {
      const createdAt = r.created_at ? new Date(String(r.created_at)).toISOString() : new Date().toISOString();
      return {
        id: Number(r.id),
        createdAt,
        actorUserId: (r.actor_user_id as string | null) ?? null,
        actorEmail: (r.actor_email as string | null) ?? null,
        actorRole: r.actor_role != null ? Number(r.actor_role) : null,
        actionType: String(r.action_type ?? ""),
        targetType: (r.target_type as string | null) ?? null,
        targetJobId: r.target_job_id != null ? Number(r.target_job_id) : null,
        targetApplicationId: r.target_application_id != null ? Number(r.target_application_id) : null,
        staffName: (r.staff_name as string | null) ?? null,
        jobTitle: (r.job_title as string | null) ?? null,
        businessName: (r.business_name as string | null) ?? null,
        workDate: (r.work_date as string | null) ?? null,
        workSessionCheckedInAt: r.work_session_checked_in_at
          ? new Date(String(r.work_session_checked_in_at)).toISOString()
          : null,
        workSessionCheckedOutAt: r.work_session_checked_out_at
          ? new Date(String(r.work_session_checked_out_at)).toISOString()
          : null,
        summary: (r.summary as string | null) ?? null,
      };
    }),
  };
}

