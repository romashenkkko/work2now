import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";

type RatingPayload = {
  applicationId?: unknown;
  score?: unknown;
  comment?: unknown;
  photoUrl?: unknown;
  jobTitle?: unknown;
};

function normalizeRole(raw: unknown): "staff" | "customer" | "admin" | "" {
  if (typeof raw === "number") {
    if (raw === 1) return "staff";
    if (raw === 2) return "customer";
    if (raw === 3) return "admin";
    return "";
  }
  const s = String(raw ?? "").toLowerCase().trim();
  if (s === "1" || s === "staff" || s === "employee" || s === "user") return "staff";
  if (s === "2" || s === "customer" || s === "business") return "customer";
  if (s === "3" || s === "admin") return "admin";
  return "";
}

const toIso = (v: unknown): string | undefined => {
  if (v == null) return undefined;
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  return s.trim() || undefined;
};

function getDisplayName(
  user:
    | {
        Email: string;
        business_profiles?: { CompanyName: string } | null;
        employee_profiles?: { Name: string; Surname: string } | null;
      }
    | null
    | undefined,
  fallback?: string
): string | undefined {
  if (!user) return fallback;
  if (user.business_profiles?.CompanyName?.trim()) return user.business_profiles.CompanyName.trim();
  const employeeName = `${user.employee_profiles?.Name ?? ""} ${user.employee_profiles?.Surname ?? ""}`.trim();
  if (employeeName) return employeeName;
  if (user.Email?.trim()) return user.Email.trim();
  return fallback;
}

const mapRowBasic = (row: Record<string, unknown>) => ({
  id: String(row.id),
  applicationId: String(row.application_id),
  jobTitle: row.job_title != null ? String(row.job_title) : undefined,
  otherPartyName: row.other_name != null ? String(row.other_name) : undefined,
  otherPartyUserId: row.other_party_user_id != null ? String(row.other_party_user_id) : undefined,
  otherPartyRatingAverage: row.other_party_rating_average != null ? Number(row.other_party_rating_average) : undefined,
  otherPartyRatingCount: row.other_party_rating_count != null ? Number(row.other_party_rating_count) : undefined,
  score: Number(row.score) || 0,
  comment: typeof row.comment === "string" && row.comment.trim() ? row.comment.trim() : undefined,
  photoUrl: typeof row.photo_url === "string" && row.photo_url.trim() ? row.photo_url.trim() : undefined,
  createdAt: toIso(row.created_at),
});

const mapRowReceived = (row: Record<string, unknown>) => {
  const avatarKey = Object.keys(row).find((k) => k.toLowerCase() === "other_party_avatar" || k.toLowerCase() === "otherpartyavatar");
  const rawAvatar = avatarKey != null ? row[avatarKey] : (row.other_party_avatar ?? (row as Record<string, unknown>)["otherPartyAvatar"]);
  const avatarStr = rawAvatar != null ? String(rawAvatar).trim() : "";
  return {
    id: String(row.id),
    applicationId: String(row.application_id),
    jobTitle: row.job_title != null ? String(row.job_title) : undefined,
    otherPartyName: row.other_name != null ? String(row.other_name) : undefined,
    otherPartyUserId: row.other_party_user_id != null ? String(row.other_party_user_id) : undefined,
    otherPartyAvatar: avatarStr.length > 0 ? avatarStr : undefined,
    otherPartyRole: normalizeRole(row.other_party_role) || undefined,
    otherPartyRatingAverage: row.other_party_rating_average != null ? Number(row.other_party_rating_average) : undefined,
    otherPartyRatingCount: row.other_party_rating_count != null ? Number(row.other_party_rating_count) : undefined,
    score: Number(row.score) || 0,
    comment: typeof row.comment === "string" && row.comment.trim() ? row.comment.trim() : undefined,
    photoUrl: typeof row.photo_url === "string" && row.photo_url.trim() ? row.photo_url.trim() : undefined,
    createdAt: toIso(row.created_at),
  };
};

async function getUserRatingMap(userIds: string[]): Promise<Map<string, { average: number; count: number }>> {
  const ids = [...new Set(userIds.map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) return new Map();

  const grouped = await prisma.ratings.groupBy({
    by: ["rated_id"],
    where: {
      rated_id: { in: ids },
    },
    _count: { _all: true },
    _avg: { score: true },
  });

  const map = new Map<string, { average: number; count: number }>();
  for (const row of grouped) {
    const key = String(row.rated_id ?? "").trim();
    if (!key) continue;
    map.set(key, {
      average: row._avg.score != null ? Number(Number(row._avg.score).toFixed(2)) : 0,
      count: row._count._all || 0,
    });
  }
  return map;
}

async function getResolvedRole(userId: string): Promise<string> {
  const user = await prisma.users.findUnique({
    where: { Id: userId },
    include: {
      employee_profiles: true,
      business_profiles: true,
    },
  });
  if (!user) return "";
  if (user.Role === 3) return "admin";
  if (user.business_profiles) return "customer";
  if (user.employee_profiles) return "staff";
  if (user.Role === 2) return "customer";
  return "staff";
}

export async function createRating(userId: string | undefined, payload: RatingPayload = {}): Promise<{ ok: true }> {
  const userIdStr = String(userId ?? "").trim();
  const applicationId = payload.applicationId != null ? String(payload.applicationId) : null;
  let score = payload.score != null ? Number(payload.score) : NaN;
  const comment = typeof payload.comment === "string" ? payload.comment.trim().slice(0, 2000) : null;
  const photoUrl = typeof payload.photoUrl === "string" && payload.photoUrl.trim() ? payload.photoUrl.trim().slice(0, 2000) : null;
  const jobTitle = typeof payload.jobTitle === "string" && payload.jobTitle.trim() ? payload.jobTitle.trim().slice(0, 255) : null;

  if (!userIdStr || !applicationId || applicationId.trim() === "") {
    throw new ServiceError("applicationId este obligatoriu.", 400);
  }
  if (!Number.isFinite(score) || score < 0.5 || score > 5) {
    throw new ServiceError("Score trebuie să fie între 0.5 și 5 (stele sau jumătate de stea).", 400);
  }
  score = Math.round(score * 2) / 2;

  const role = await getResolvedRole(userIdStr);
  if (role !== "customer" && role !== "staff") {
    throw new ServiceError("Doar customer sau staff poate lăsa un review.", 403);
  }

  const app = await prisma.applications.findUnique({
    where: { id: Number(applicationId) },
    include: {
      jobs: {
        select: { user_id: true },
      },
    },
  });
  if (!app || !app.checked_out_at) {
    throw new ServiceError("Aplicație negăsită sau lucrul nu e finalizat.", 404);
  }

  const customerIdStr = app.jobs.user_id != null ? String(app.jobs.user_id).trim() : "";
  const staffIdStr = app.staff_id != null ? String(app.staff_id).trim() : "";
  const currentUserMatchesCustomer = customerIdStr === userIdStr || (Number(customerIdStr) === Number(userIdStr) && Number.isFinite(Number(customerIdStr)));
  const currentUserMatchesStaff = staffIdStr === userIdStr || (Number(staffIdStr) === Number(userIdStr) && Number.isFinite(Number(staffIdStr)));

  let raterId: string;
  let ratedId: string;
  if (role === "customer") {
    if (!customerIdStr || !currentUserMatchesCustomer) {
      throw new ServiceError("Poți evalua doar aplicațiile la joburile tale.", 403);
    }
    raterId = userIdStr;
    ratedId = app.staff_id != null ? String(app.staff_id).trim() : "";
  } else {
    if (!staffIdStr || !currentUserMatchesStaff) {
      throw new ServiceError("Poți evalua doar joburile la care ai lucrat.", 403);
    }
    raterId = userIdStr;
    ratedId = app.jobs.user_id != null ? String(app.jobs.user_id).trim() : "";
  }

  const existing = await prisma.ratings.findFirst({
    where: {
      application_id: Number(applicationId),
      rater_id: raterId,
    },
    select: { id: true },
  });

  if (existing) {
    throw new ServiceError("Ai evaluat deja această oră de lucru.", 400);
  }

  await prisma.ratings.create({
    data: {
      application_id: Number(applicationId),
      rater_id: raterId,
      rated_id: ratedId,
      score,
      comment: comment || null,
      photo_url: photoUrl || null,
      job_title: jobTitle,
    },
  });
  return { ok: true };
}

export async function getMyRatings(userId?: string): Promise<{ given: ReturnType<typeof mapRowBasic>[]; received: ReturnType<typeof mapRowBasic>[] }> {
  if (!userId) throw new ServiceError("Unauthorized", 401);
  const role = await getResolvedRole(userId);
  if (role !== "customer" && role !== "staff") {
    return { given: [], received: [] };
  }

  const givenRows = await prisma.ratings.findMany({
    where: { rater_id: userId },
    orderBy: { created_at: "desc" },
    include: {
      applications: {
        include: {
          jobs: true,
        },
      },
      users_ratings_rated_idTousers: {
        include: {
          business_profiles: true,
          employee_profiles: true,
        },
      },
    },
  });
  const receivedRows = await prisma.ratings.findMany({
    where: { rated_id: userId },
    orderBy: { created_at: "desc" },
    include: {
      applications: {
        include: {
          jobs: true,
        },
      },
      users_ratings_rater_idTousers: {
        include: {
          business_profiles: true,
          employee_profiles: true,
        },
      },
    },
  });
  const givenOtherPartyRatingMap = await getUserRatingMap(
    givenRows.map((row) => row.users_ratings_rated_idTousers?.Id ?? "").filter(Boolean)
  );
  const receivedOtherPartyRatingMap = await getUserRatingMap(
    receivedRows.map((row) => row.users_ratings_rater_idTousers?.Id ?? "").filter(Boolean)
  );

  return {
    given: givenRows.map((row) => {
      const otherPartyId = row.users_ratings_rated_idTousers?.Id?.trim() || undefined;
      const otherPartyRating = otherPartyId ? givenOtherPartyRatingMap.get(otherPartyId) : undefined;
      return {
        id: String(row.id),
        applicationId: String(row.application_id),
        jobTitle: row.job_title ?? row.applications.jobs.Title ?? undefined,
        otherPartyName: getDisplayName(row.users_ratings_rated_idTousers, row.applications.staff_name),
        otherPartyUserId: otherPartyId,
        otherPartyRatingAverage: otherPartyRating?.average,
        otherPartyRatingCount: otherPartyRating?.count,
        score: Number(row.score) || 0,
        comment: typeof row.comment === "string" && row.comment.trim() ? row.comment.trim() : undefined,
        photoUrl: typeof row.photo_url === "string" && row.photo_url.trim() ? row.photo_url.trim() : undefined,
        createdAt: toIso(row.created_at),
      };
    }),
    received: receivedRows.map((row) => {
      const otherPartyId = row.users_ratings_rater_idTousers?.Id?.trim() || undefined;
      const otherPartyRating = otherPartyId ? receivedOtherPartyRatingMap.get(otherPartyId) : undefined;
      return {
        id: String(row.id),
        applicationId: String(row.application_id),
        jobTitle: row.job_title ?? row.applications.jobs.Title ?? undefined,
        otherPartyName: getDisplayName(row.users_ratings_rater_idTousers, row.applications.staff_name),
        otherPartyUserId: otherPartyId,
        otherPartyRatingAverage: otherPartyRating?.average,
        otherPartyRatingCount: otherPartyRating?.count,
        score: Number(row.score) || 0,
        comment: typeof row.comment === "string" && row.comment.trim() ? row.comment.trim() : undefined,
        photoUrl: typeof row.photo_url === "string" && row.photo_url.trim() ? row.photo_url.trim() : undefined,
        createdAt: toIso(row.created_at),
      };
    }),
  };
}

export async function getUserRatingSummary(userId?: string): Promise<{ average: number; count: number }> {
  const trimmedUserId = userId != null ? String(userId).trim() : "";
  if (!trimmedUserId) throw new ServiceError("userId lipsă.", 400);
  const result = await prisma.ratings.aggregate({
    where: { rated_id: trimmedUserId },
    _count: { _all: true },
    _avg: { score: true },
  });
  return {
    count: result._count._all || 0,
    average: result._avg.score != null ? Number(Number(result._avg.score).toFixed(2)) : 0,
  };
}

export async function getReceivedRatings(userId?: string): Promise<{ reviews: ReturnType<typeof mapRowReceived>[] }> {
  const trimmedUserId = userId != null ? String(userId).trim() : "";
  if (!trimmedUserId) throw new ServiceError("userId lipsă.", 400);
  const receivedRows = await prisma.ratings.findMany({
    where: { rated_id: trimmedUserId },
    orderBy: { created_at: "desc" },
    include: {
      applications: {
        include: {
          jobs: true,
        },
      },
      users_ratings_rater_idTousers: {
        include: {
          business_profiles: true,
          employee_profiles: true,
        },
      },
    },
  });
  const otherPartyRatingMap = await getUserRatingMap(
    receivedRows.map((row) => row.users_ratings_rater_idTousers?.Id ?? "").filter(Boolean)
  );
  return {
    reviews: receivedRows.map((row) => {
      const otherPartyId = row.users_ratings_rater_idTousers?.Id?.trim() || undefined;
      const otherPartyRating = otherPartyId ? otherPartyRatingMap.get(otherPartyId) : undefined;
      return {
        id: String(row.id),
        applicationId: String(row.application_id),
        jobTitle: row.job_title ?? row.applications.jobs.Title ?? undefined,
        otherPartyName: getDisplayName(row.users_ratings_rater_idTousers, row.applications.staff_name),
        otherPartyUserId: otherPartyId,
        otherPartyAvatar: row.users_ratings_rater_idTousers?.Avatar?.trim() || row.users_ratings_rater_idTousers?.employee_profiles?.ProfilePictureFileId?.trim() || undefined,
        otherPartyRole: normalizeRole(row.users_ratings_rater_idTousers?.Role) || undefined,
        otherPartyRatingAverage: otherPartyRating?.average,
        otherPartyRatingCount: otherPartyRating?.count,
        score: Number(row.score) || 0,
        comment: typeof row.comment === "string" && row.comment.trim() ? row.comment.trim() : undefined,
        photoUrl: typeof row.photo_url === "string" && row.photo_url.trim() ? row.photo_url.trim() : undefined,
        createdAt: toIso(row.created_at),
      };
    }),
  };
}

export async function getRatingProfile(userId?: string): Promise<{ average: number; count: number; reviews: ReturnType<typeof mapRowReceived>[] }> {
  const summary = await getUserRatingSummary(userId);
  const received = await getReceivedRatings(userId);
  return {
    average: summary.average,
    count: summary.count,
    reviews: received.reviews,
  };
}

