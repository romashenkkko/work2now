import { prisma } from "../prismaClient";
import { ServiceError } from "./ServiceError";

// --- Helpers (used by list/create and other endpoints) ---
export type ResolvedRole = "staff" | "customer" | "admin" | "";

export function normalizeRole(raw: unknown): ResolvedRole {
  if (typeof raw === "number") {
    if (raw === 1) return "staff";
    if (raw === 2) return "customer";
    if (raw === 3) return "admin";
    return "";
  }
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return "";
  if (s === "1" || s === "staff" || s === "employee" || s === "user") return "staff";
  if (s === "2" || s === "customer" || s === "business") return "customer";
  if (s === "3" || s === "admin") return "admin";
  return "";
}

export async function isBusinessUser(userId: string): Promise<boolean> {
  const bp = await prisma.business_profiles.findFirst({
    where: { UserId: userId },
    select: { Id: true },
  });
  return !!bp;
}

export async function getResolvedRoleAndCustomerLike(userId: string): Promise<{ role: ResolvedRole; customerLike: boolean }> {
  const user = await prisma.users.findUnique({
    where: { Id: userId },
    select: { Role: true },
  });
  const role = normalizeRole(user?.Role);
  const customerLike = role === "customer" || (await isBusinessUser(userId));
  return { role, customerLike };
}

function formatWorkDateYMD(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const d = v as Date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s.slice(0, 10) || "";
}

function timeStringToMinutes(s: string | undefined): number | null {
  if (s == null || typeof s !== "string") return null;
  const t = s.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59) return null;
  if (h < 0 || h > 23) return null;
  return h * 60 + m;
}

function hoursBetweenTimes(startStr: string | undefined, endStr: string | undefined): number | null {
  const startM = timeStringToMinutes(startStr);
  const endM = timeStringToMinutes(endStr);
  if (startM == null || endM == null) return null;
  const minsPerDay = 24 * 60;
  const durationMins = endM <= startM ? minsPerDay - startM + endM : endM - startM;
  const hours = durationMins / 60;
  return Number.isFinite(hours) && hours >= 0 ? Math.round(hours * 100) / 100 : null;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const DEFAULT_GEO_RADIUS_M = 200;

export async function validateGeoForJob(
  jobId: number,
  body: { lat?: unknown; lng?: unknown }
): Promise<{ valid: true } | { valid: false; statusCode: number; error: string }> {
  const job = await prisma.jobs.findUnique({
    where: { id: jobId },
    select: { check_in_lat: true, check_in_lng: true, check_in_radius_m: true },
  });
  const jLat = job?.check_in_lat ?? NaN;
  const jLng = job?.check_in_lng ?? NaN;
  const jRadius = job?.check_in_radius_m ?? DEFAULT_GEO_RADIUS_M;
  if (!Number.isFinite(jLat) || !Number.isFinite(jLng) || jRadius <= 0) {
    return { valid: true };
  }
  const lat = body.lat != null ? Number(body.lat) : NaN;
  const lng = body.lng != null ? Number(body.lng) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, statusCode: 400, error: "Location permission is required for check-in/check-out at this workplace." };
  }
  const distM = haversineMeters(jLat, jLng, lat, lng);
  if (distM > jRadius) {
    return { valid: false, statusCode: 400, error: "You are not within the allowed location radius." };
  }
  return { valid: true };
}

export function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

export type JobListItem = Record<string, unknown>;

function buildJobListItem(row: {
  id: number;
  Title: string;
  location: string | null;
  status: string;
  status_class: string;
  date: string;
  end_date: string | null;
  job_type: string | null;
  applications_count: number;
  start_time: string | null;
  end_time: string | null;
  people_needed: string | null;
  duration: string | null;
  estimated_salary: string | null;
  image_url: string | null;
  job_category_code: number | null;
  hourly_rate_base: unknown;
  is_promoted: boolean;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_radius_m: number | null;
  job_category_title?: string | null;
  posted_by_name?: string | null;
  posted_by_user_id?: string | null;
  posted_by_role?: unknown;
  posted_by_avatar?: string | null;
  accepted_count?: number;
}): JobListItem {
  const startTime = row.start_time ?? undefined;
  const endTime = row.end_time ?? undefined;
  const computedDuration = hoursBetweenTimes(startTime ?? undefined, endTime ?? undefined);
  const storedDuration = row.duration?.trim() || undefined;
  const duration = storedDuration ?? (computedDuration != null ? String(computedDuration) : undefined);
  const acceptedCount = row.accepted_count ?? 0;
  return {
    id: String(row.id),
    job: row.Title,
    jobCategoryTitle: row.job_category_title ?? undefined,
    location: row.location,
    status: row.status,
    statusClass: row.status_class,
    date: row.date,
    endDate: row.end_date ?? undefined,
    jobType: row.job_type ?? undefined,
    applicationsCount: row.applications_count ?? 0,
    acceptedCount,
    startTime,
    endTime,
    peopleNeeded: row.people_needed ?? undefined,
    duration,
    estimatedSalary: row.estimated_salary ?? undefined,
    imageUrl: row.image_url ?? undefined,
    postedBy: typeof row.posted_by_name === "string" && row.posted_by_name.trim() ? row.posted_by_name.trim() : undefined,
    isPromoted: row.is_promoted,
    jobCategoryCode: row.job_category_code ?? undefined,
    hourlyRateBase: row.hourly_rate_base ?? undefined,
    postedById: row.posted_by_user_id != null ? String(row.posted_by_user_id) : undefined,
    postedByRole: normalizeRole(row.posted_by_role) || undefined,
    postedByAvatar: typeof row.posted_by_avatar === "string" && row.posted_by_avatar.trim() ? row.posted_by_avatar.trim() : undefined,
    ...(Number.isFinite(row.check_in_lat) && Number.isFinite(row.check_in_lng) && row.check_in_radius_m != null && row.check_in_radius_m > 0
      ? { checkInLat: row.check_in_lat, checkInLng: row.check_in_lng, checkInRadiusM: row.check_in_radius_m }
      : {}),
  };
}

export async function getJobCategoryHourlyMin(code: number): Promise<number | null> {
  const cat = await prisma.job_categories.findUnique({
    where: { Code: code },
    select: { HourlyMin: true },
  });
  if (!cat) return null;
  const v = Number(cat.HourlyMin);
  return Number.isFinite(v) ? v : null;
}

export async function getJobCategories() {
  const categories = await prisma.job_categories.findMany({
    orderBy: { Code: "asc" },
    select: {
      Code: true,
      Title: true,
      HourlyMin: true,
    },
  });

  return {
    categories: categories.map((cat) => ({
      code: cat.Code,
      title: cat.Title,
      hourlyMin: cat.HourlyMin,
    })),
  };
}

export async function getRaioane(search?: string) {
  const where = search && search.trim()
    ? {
        name: {
          contains: search.trim(),
        },
      }
    : undefined;

  const raioane = await prisma.raioane.findMany({
    where,
    orderBy: where ? { name: "asc" } : [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
    },
  });

  return {
    raioane: raioane.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
    })),
  };
}

// --- List jobs (customer: own only; staff/admin: all, booster first) ---
export async function listJobs(userId: string): Promise<{ jobs: JobListItem[] }> {
  const { customerLike } = await getResolvedRoleAndCustomerLike(userId);
  const where = customerLike ? { user_id: userId } : {};
  const jobs = await prisma.jobs.findMany({
    where,
    include: {
      job_categories: { select: { Title: true } },
      users: {
        select: {
          Id: true,
          Role: true,
          Avatar: true,
          BoosterUntil: true,
          Email: true,
          business_profiles: { select: { CompanyName: true } },
          employee_profiles: { select: { Name: true, Surname: true } },
        },
      },
    },
    orderBy: customerLike ? [{ is_promoted: "desc" }, { created_at: "desc" }] : [{ created_at: "desc" }],
  });
  const jobIds = jobs.map((j) => j.id);
  const acceptedCounts =
    jobIds.length === 0
      ? new Map<number, number>()
      : (
          await prisma.applications.groupBy({
            by: ["job_id"],
            where: { job_id: { in: jobIds }, status: "accepted" },
            _count: { id: true },
          })
        ).reduce((acc, g) => {
          acc.set(g.job_id, g._count.id);
          return acc;
        }, new Map<number, number>());
  const postedByName = (j: (typeof jobs)[0]) => {
    const u = j.users as typeof jobs[0]["users"] & { Email?: string };
    if (!u) return undefined;
    const bp = u.business_profiles;
    const ep = u.employee_profiles;
    if (bp?.CompanyName?.trim()) return bp.CompanyName.trim();
    if (ep) {
      const name = [ep.Name, ep.Surname].filter(Boolean).join(" ").trim();
      if (name) return name;
    }
    return u.Email?.trim() || undefined;
  };
  const rows = jobs.map((j) => {
    const u = j.users;
    const list: Parameters<typeof buildJobListItem>[0] = {
      id: j.id,
      Title: j.Title,
      location: j.location,
      status: j.status,
      status_class: j.status_class,
      date: j.date,
      end_date: j.end_date,
      job_type: j.job_type,
      applications_count: j.applications_count,
      start_time: j.start_time,
      end_time: j.end_time,
      people_needed: j.people_needed,
      duration: j.duration,
      estimated_salary: j.estimated_salary,
      image_url: j.image_url,
      job_category_code: j.job_category_code,
      hourly_rate_base: j.hourly_rate_base,
      is_promoted: j.is_promoted ?? false,
      check_in_lat: j.check_in_lat,
      check_in_lng: j.check_in_lng,
      check_in_radius_m: j.check_in_radius_m,
      job_category_title: j.job_categories?.Title ?? undefined,
      posted_by_name: postedByName(j) ?? (u?.Id ? undefined : undefined),
      posted_by_user_id: u?.Id ?? undefined,
      posted_by_role: u?.Role,
      posted_by_avatar: u?.Avatar ?? undefined,
      accepted_count: acceptedCounts.get(j.id) ?? 0,
    };
    const uAny = u as { Email?: string } | null;
    if (list.posted_by_name === undefined && uAny?.Email) list.posted_by_name = uAny.Email.trim();
    return buildJobListItem(list);
  });
  if (!customerLike && jobs.length > 0) {
    const withBooster = jobs.map((j, i) => ({
      booster: j.users?.BoosterUntil ? new Date(j.users.BoosterUntil) > new Date() : false,
      promoted: j.is_promoted ?? false,
      created_at: j.created_at,
      index: i,
    }));
    withBooster.sort((a, b) => {
      if (a.booster !== b.booster) return a.booster ? -1 : 1;
      if (a.promoted !== b.promoted) return a.promoted ? -1 : 1;
      return b.created_at.getTime() - a.created_at.getTime();
    });
    const reordered = withBooster.map((x) => rows[x.index]);
    return { jobs: reordered };
  }
  return { jobs: rows };
}

export type CreateJobBody = {
  job?: unknown;
  location?: unknown;
  status?: unknown;
  statusClass?: unknown;
  date?: unknown;
  endDate?: unknown;
  jobType?: unknown;
  peopleNeeded?: unknown;
  duration?: unknown;
  estimatedSalary?: unknown;
  imageUrl?: unknown;
  jobCategoryCode?: unknown;
  hourlyRateBase?: unknown;
  raionId?: unknown;
  localitate?: unknown;
  checkInLat?: unknown;
  checkInLng?: unknown;
  checkInRadiusM?: unknown;
  startTime?: unknown;
  endTime?: unknown;
};

export async function createJob(userId: string, body: CreateJobBody): Promise<JobListItem> {
  const { customerLike } = await getResolvedRoleAndCustomerLike(userId);
  if (!customerLike) throw new ServiceError("Doar customer poate crea joburi.", 403);
  const b = body ?? {};
  const jobTitle = String(b.job ?? "").trim().slice(0, 30);
  const location = String(b.location ?? "").trim();
  const status = String(b.status ?? "Draft");
  const statusClass = String(b.statusClass ?? "bg-gray-100 text-gray-700");
  const date = String(b.date ?? "");
  const imageUrl = typeof b.imageUrl === "string" && b.imageUrl.trim() ? b.imageUrl.trim() : null;
  const jobCategoryCode = toNumber(b.jobCategoryCode);
  const hourlyRateBase = toNumber(b.hourlyRateBase);
  const raionId = toNumber(b.raionId);
  const localitate = b.localitate != null ? String(b.localitate).trim().slice(0, 200) : null;
  if (jobCategoryCode == null || jobCategoryCode <= 0) throw new ServiceError("jobCategoryCode is required and must be a positive number.", 400);
  if (hourlyRateBase == null || hourlyRateBase <= 0) throw new ServiceError("hourlyRateBase is required and must be a positive number.", 400);
  if (raionId == null || raionId <= 0) throw new ServiceError("raionId is required and must be a positive number.", 400);
  const raion = await prisma.raioane.findUnique({ where: { id: raionId }, select: { id: true } });
  if (!raion) throw new ServiceError("Invalid raionId (not found in raioane table).", 400);
  if (!jobTitle) throw new ServiceError("Titlul jobului este obligatoriu (maxim 30 caractere).", 400);
  if (!location) throw new ServiceError("location este obligatorie.", 400);
  const category = await prisma.job_categories.findUnique({ where: { Code: jobCategoryCode }, select: { Title: true } });
  if (!category) throw new ServiceError("Invalid jobCategoryCode (not found in job_categories).", 400);
  const hourlyMin = await getJobCategoryHourlyMin(jobCategoryCode);
  if (hourlyMin != null && hourlyRateBase < hourlyMin) throw new ServiceError(`Tariful orar minim pentru această categorie este ${hourlyMin} MDL.`, 400);
  const checkInLat = b.checkInLat != null ? Number(b.checkInLat) : null;
  const checkInLng = b.checkInLng != null ? Number(b.checkInLng) : null;
  const checkInRadiusM =
    b.checkInRadiusM != null ? Math.max(1, Math.min(500, Number(b.checkInRadiusM))) : checkInLat != null && checkInLng != null ? DEFAULT_GEO_RADIUS_M : null;
  const startTime = b.startTime != null ? String(b.startTime).trim() : null;
  const endTime = b.endTime != null ? String(b.endTime).trim() : null;
  const computedDurationHours = hoursBetweenTimes(startTime ?? undefined, endTime ?? undefined);
  const durationValue = computedDurationHours != null ? String(computedDurationHours) : (b.duration != null ? String(b.duration) : null);
  const job = await prisma.jobs.create({
    data: {
      user_id: userId,
      Title: jobTitle,
      location,
      status,
      status_class: statusClass,
      date,
      end_date: b.endDate != null ? String(b.endDate) : null,
      job_type: b.jobType != null ? String(b.jobType) : null,
      applications_count: 0,
      start_time: startTime,
      end_time: endTime,
      people_needed: b.peopleNeeded != null ? String(b.peopleNeeded) : null,
      duration: durationValue,
      estimated_salary: b.estimatedSalary != null ? String(b.estimatedSalary) : null,
      image_url: imageUrl,
      job_category_code: jobCategoryCode,
      hourly_rate_base: hourlyRateBase,
      raion_id: raionId,
      localitate,
      check_in_lat: checkInLat,
      check_in_lng: checkInLng,
      check_in_radius_m: checkInRadiusM,
    },
    include: {
      job_categories: { select: { Title: true } },
      users: {
        select: {
          Id: true,
          Role: true,
          Avatar: true,
          business_profiles: { select: { CompanyName: true } },
          employee_profiles: { select: { Name: true, Surname: true } },
        },
      },
    },
  });
  const u = job.users;
  const postedByName =
    u?.business_profiles?.CompanyName?.trim() ||
    [u?.employee_profiles?.Name, u?.employee_profiles?.Surname].filter(Boolean).join(" ").trim() ||
    undefined;
  return buildJobListItem({
    id: job.id,
    Title: job.Title,
    location: job.location,
    status: job.status,
    status_class: job.status_class,
    date: job.date,
    end_date: job.end_date,
    job_type: job.job_type,
    applications_count: job.applications_count,
    start_time: job.start_time,
    end_time: job.end_time,
    people_needed: job.people_needed,
    duration: job.duration,
    estimated_salary: job.estimated_salary,
    image_url: job.image_url,
    job_category_code: job.job_category_code,
    hourly_rate_base: job.hourly_rate_base,
    is_promoted: job.is_promoted ?? false,
    check_in_lat: job.check_in_lat,
    check_in_lng: job.check_in_lng,
    check_in_radius_m: job.check_in_radius_m,
    job_category_title: job.job_categories?.Title,
    posted_by_name: postedByName,
    posted_by_user_id: u?.Id,
    posted_by_role: u?.Role,
    posted_by_avatar: u?.Avatar,
    accepted_count: 0,
  });
}

export async function deleteJob(userId: string, jobId: string): Promise<void> {
  const job = await prisma.jobs.findUnique({ where: { id: parseInt(jobId, 10) }, select: { id: true, user_id: true } });
  if (!job) throw new ServiceError("Job negăsit.", 404);
  if (job.user_id !== userId) throw new ServiceError("Nu poți șterge acest job.", 403);
  await prisma.applications.deleteMany({ where: { job_id: job.id } });
  await prisma.jobs.delete({ where: { id: job.id } });
}

export async function setPromoted(userId: string, jobId: string, promoted: boolean): Promise<void> {
  const job = await prisma.jobs.findUnique({ where: { id: parseInt(jobId, 10) }, select: { id: true, user_id: true } });
  if (!job) throw new ServiceError("Job negăsit.", 404);
  const user = await prisma.users.findUnique({ where: { Id: userId }, select: { Role: true } });
  const role = normalizeRole(user?.Role);
  const isOwner = job.user_id === userId;
  if (!isOwner && role !== "admin") throw new ServiceError("Doar proprietarul jobului sau admin poate seta promovarea.", 403);
  await prisma.jobs.update({ where: { id: job.id }, data: { is_promoted: promoted } });
}

function toIso(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (v instanceof Date) return v.toISOString();
  const s = String(v).trim();
  return s || undefined;
}

export type MyApplicationsByJob = Record<
  string,
  { status: string; applicationId: string; checkedInAt?: string; checkedOutAt?: string; workSessions: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] }
>;

export async function getMyApplications(userId: string): Promise<{ byJob: MyApplicationsByJob }> {
  const { role } = await getResolvedRoleAndCustomerLike(userId);
  if (role !== "staff") return { byJob: {} };
  const apps = await prisma.applications.findMany({
    where: { staff_id: userId },
    select: { id: true, job_id: true, status: true, checked_in_at: true, checked_out_at: true },
  });
  const appIds = apps.map((a) => a.id).filter((id) => id > 0);
  let sessionsByApp: Record<string, { workDate: string; checkedInAt?: string; checkedOutAt?: string }[]> = {};
  if (appIds.length > 0) {
    const sessions = await prisma.application_work_sessions.findMany({
      where: { application_id: { in: appIds } },
      orderBy: { work_date: "asc" },
      select: { application_id: true, work_date: true, checked_in_at: true, checked_out_at: true },
    });
    for (const s of sessions) {
      const aid = String(s.application_id);
      if (!sessionsByApp[aid]) sessionsByApp[aid] = [];
      const workDate = formatWorkDateYMD(s.work_date);
      if (workDate)
        sessionsByApp[aid].push({
          workDate,
          checkedInAt: toIso(s.checked_in_at),
          checkedOutAt: toIso(s.checked_out_at),
        });
    }
  }
  const byJob: MyApplicationsByJob = {};
  for (const r of apps) {
    const jid = String(r.job_id);
    const aid = String(r.id);
    byJob[jid] = {
      status: r.status,
      applicationId: aid,
      checkedInAt: toIso(r.checked_in_at),
      checkedOutAt: toIso(r.checked_out_at),
      workSessions: sessionsByApp[aid] ?? [],
    };
  }
  return { byJob };
}

export type MyApplicationListItem = {
  id: string;
  jobId: string;
  status: "pending" | "accepted" | "refused";
  createdAt?: string;
  jobTitle?: string;
  jobLocation?: string;
  jobDate?: string;
  jobEndDate?: string;
  customerName?: string;
  checkedInAt?: string;
  checkedOutAt?: string;
  workSessions: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[];
  ratingScore?: number;
};

export async function getMyApplicationsList(userId: string): Promise<{ applications: MyApplicationListItem[] }> {
  const { role } = await getResolvedRoleAndCustomerLike(userId);
  if (role !== "staff") return { applications: [] };
  const list = await prisma.applications.findMany({
    where: { staff_id: userId },
    include: {
      jobs: {
        select: {
          Title: true,
          location: true,
          date: true,
          end_date: true,
          users: {
            select: {
              Email: true,
              business_profiles: { select: { CompanyName: true } },
              employee_profiles: { select: { Name: true, Surname: true } },
            },
          },
        },
      },
      ratings: { select: { score: true }, take: 1 },
    },
    orderBy: { created_at: "desc" },
  });
  const appIds = list.map((a) => a.id);
  let sessionsByAppId: Record<string, { workDate: string; checkedInAt?: string; checkedOutAt?: string }[]> = {};
  if (appIds.length > 0) {
    const sessions = await prisma.application_work_sessions.findMany({
      where: { application_id: { in: appIds } },
      orderBy: { work_date: "asc" },
      select: { application_id: true, work_date: true, checked_in_at: true, checked_out_at: true },
    });
    for (const s of sessions) {
      const aid = String(s.application_id);
      if (!sessionsByAppId[aid]) sessionsByAppId[aid] = [];
      const workDate = formatWorkDateYMD(s.work_date);
      if (workDate) sessionsByAppId[aid].push({ workDate, checkedInAt: toIso(s.checked_in_at), checkedOutAt: toIso(s.checked_out_at) });
    }
  }
  const applications: MyApplicationListItem[] = list.map((a) => {
    const j = a.jobs;
    const u = j?.users;
    const customerName =
      u?.business_profiles?.CompanyName?.trim() ||
      (u?.employee_profiles ? [u.employee_profiles.Name, u.employee_profiles.Surname].filter(Boolean).join(" ").trim() : null) ||
      u?.Email?.trim() ||
      undefined;
    return {
      id: String(a.id),
      jobId: String(a.job_id),
      status: a.status as "pending" | "accepted" | "refused",
      createdAt: toIso(a.created_at),
      jobTitle: j?.Title ?? undefined,
      jobLocation: j?.location ?? undefined,
      jobDate: j?.date ?? undefined,
      jobEndDate: j?.end_date ?? undefined,
      customerName,
      checkedInAt: toIso(a.checked_in_at),
      checkedOutAt: toIso(a.checked_out_at),
      workSessions: sessionsByAppId[String(a.id)] ?? [],
      ratingScore: a.ratings[0] != null ? Number(a.ratings[0].score) : undefined,
    };
  });
  return { applications };
}

export type ApplyToJobResult = { ok: true; customerEmail: string; jobTitle: string; staffName: string };

export async function applyToJob(userId: string, jobId: string): Promise<ApplyToJobResult> {
  const user = await prisma.users.findUnique({
    where: { Id: userId },
    include: { employee_profiles: { select: { Name: true, Surname: true } } },
  });
  if (!user || normalizeRole(user.Role) !== "staff")
    throw new ServiceError("Doar staff poate aplica la joburi.", 403);
  const staffName =
    user.employee_profiles ? [user.employee_profiles.Name, user.employee_profiles.Surname].filter(Boolean).join(" ").trim() : "";
  const staffEmail = user.Email ?? null;
  const job = await prisma.jobs.findUnique({
    where: { id: parseInt(jobId, 10) },
    select: { id: true, Title: true, user_id: true, users: { select: { Email: true } } },
  });
  if (!job) throw new ServiceError("Job negăsit.", 404);
  const existing = await prisma.applications.findFirst({
    where: { job_id: job.id, staff_id: userId },
    select: { id: true },
  });
  if (existing) throw new ServiceError("Ai aplicat deja la acest job.", 400);
  await prisma.$transaction([
    prisma.applications.create({
      data: {
        job_id: job.id,
        staff_id: userId,
        staff_name: staffName || "Staff",
        staff_email: staffEmail,
        status: "pending",
      },
    }),
    prisma.jobs.update({
      where: { id: job.id },
      data: { applications_count: { increment: 1 } },
    }),
  ]);
  const customerEmail = (job.users?.Email ?? "").trim();
  return {
    ok: true,
    customerEmail,
    jobTitle: (job.Title ?? "").trim() || "Job",
    staffName: staffName || "Angajat",
  };
}

export type ApplicationsByJob = Record<string, unknown[]>;

export async function getApplications(userId: string): Promise<{ applications: ApplicationsByJob }> {
  const { customerLike } = await getResolvedRoleAndCustomerLike(userId);
  if (!customerLike) throw new ServiceError("Doar customer poate vedea aplicațiile.", 403);
  const jobIds = (
    await prisma.jobs.findMany({
      where: { user_id: userId },
      select: { id: true },
      orderBy: { id: "asc" },
    })
  ).map((j) => j.id);
  if (jobIds.length === 0) return { applications: {} };
  const list = await prisma.applications.findMany({
    where: { job_id: { in: jobIds } },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      job_id: true,
      staff_id: true,
      staff_name: true,
      staff_email: true,
      status: true,
      checked_in_at: true,
      checked_out_at: true,
      business_confirmed_at: true,
      created_at: true,
    },
  });
  const staffIds = [...new Set(list.map((a) => a.staff_id).filter(Boolean))] as string[];
  let avatarByStaffId: Record<string, string> = {};
  if (staffIds.length > 0) {
    const users = await prisma.users.findMany({
      where: { Id: { in: staffIds } },
      select: { Id: true, Avatar: true },
    });
    const withEp = await prisma.employee_profiles.findMany({
      where: { UserId: { in: staffIds } },
      select: { UserId: true, ProfilePictureFileId: true },
    });
    const epMap = withEp.reduce((acc, e) => {
      acc[e.UserId] = e.ProfilePictureFileId;
      return acc;
    }, {} as Record<string, string | null>);
    for (const u of users) {
      const av = u.Avatar ?? epMap[u.Id];
      if (typeof av === "string" && av.trim()) avatarByStaffId[u.Id] = av.trim();
    }
  }
  const appIds = list.map((a) => a.id);
  let sessionsByAppId: Record<string, { workDate: string; checkedInAt?: string; checkedOutAt?: string }[]> = {};
  if (appIds.length > 0) {
    const sessions = await prisma.application_work_sessions.findMany({
      where: { application_id: { in: appIds } },
      orderBy: { work_date: "asc" },
      select: { application_id: true, work_date: true, checked_in_at: true, checked_out_at: true },
    });
    for (const s of sessions) {
      const aid = String(s.application_id);
      if (!sessionsByAppId[aid]) sessionsByAppId[aid] = [];
      const workDate = formatWorkDateYMD(s.work_date);
      if (workDate) sessionsByAppId[aid].push({ workDate, checkedInAt: toIso(s.checked_in_at), checkedOutAt: toIso(s.checked_out_at) });
    }
  }
  const ratingScores = await prisma.ratings.findMany({
    where: { application_id: { in: appIds }, rater_id: userId },
    select: { application_id: true, score: true },
  });
  const scoreByAppId = ratingScores.reduce((acc, r) => {
    acc[r.application_id] = Number(r.score);
    return acc;
  }, {} as Record<number, number>);
  const byJob: ApplicationsByJob = {};
  for (const a of list) {
    const jid = String(a.job_id);
    if (!byJob[jid]) byJob[jid] = [];
    const sidStr = a.staff_id ?? "";
    byJob[jid].push({
      id: String(a.id),
      jobId: jid,
      staffId: sidStr,
      staffName: a.staff_name,
      staffEmail: a.staff_email ?? undefined,
      staffAvatar: sidStr ? avatarByStaffId[sidStr] : undefined,
      status: a.status,
      checkedInAt: toIso(a.checked_in_at),
      checkedOutAt: toIso(a.checked_out_at),
      businessConfirmedAt: toIso(a.business_confirmed_at),
      isBusinessConfirmed: !!a.business_confirmed_at,
      workSessions: sessionsByAppId[String(a.id)] ?? [],
      ratingScore: scoreByAppId[a.id],
    });
  }
  return { applications: byJob };
}

export async function confirmCompletion(userId: string, appId: string): Promise<void> {
  const app = await prisma.applications.findFirst({
    where: { id: parseInt(appId, 10) },
    include: { jobs: { select: { user_id: true } } },
  });
  if (!app || app.jobs.user_id !== userId) throw new ServiceError("Aplicație negăsită.", 404);
  if (app.status !== "accepted") throw new ServiceError("Doar aplicațiile acceptate pot fi confirmate ca finalizate.", 400);
  await prisma.applications.update({
    where: { id: app.id },
    data: { business_confirmed_at: new Date() },
  });
}

export async function checkIn(
  userId: string,
  appId: number,
  body: { lat?: unknown; lng?: unknown; workDate?: unknown }
): Promise<{ alreadyDone?: boolean }> {
  const app = await prisma.applications.findFirst({
    where: { id: appId, staff_id: userId },
    select: { id: true, job_id: true, status: true, checked_in_at: true },
  });
  if (!app) throw new ServiceError("Aplicație negăsită.", 404);
  if (app.status !== "accepted") throw new ServiceError("Doar aplicațiile acceptate pot fi check-in.", 400);
  if (app.checked_in_at != null) return { alreadyDone: true };
  if (app.job_id) {
    const geo = await validateGeoForJob(app.job_id, body);
    if (!geo.valid) throw new ServiceError(geo.error, geo.statusCode);
  }
  const workDateStr = body.workDate ? String(body.workDate).trim().slice(0, 10) : null;
  await prisma.applications.update({
    where: { id: appId },
    data: { checked_in_at: new Date() },
  });
  if (workDateStr && /^\d{4}-\d{2}-\d{2}$/.test(workDateStr)) {
    const workDate = new Date(workDateStr + "T12:00:00Z");
    const existing = await prisma.application_work_sessions.findFirst({
      where: { application_id: appId, work_date: workDate },
    });
    if (existing) {
      await prisma.application_work_sessions.update({
        where: { id: existing.id },
        data: { checked_in_at: new Date() },
      });
    } else {
      await prisma.application_work_sessions.create({
        data: { application_id: appId, work_date: workDate, checked_in_at: new Date() },
      });
    }
  }
  return {};
}

export async function checkOut(
  userId: string,
  appId: number,
  body: { lat?: unknown; lng?: unknown; workDate?: unknown }
): Promise<{ alreadyDone?: boolean }> {
  const app = await prisma.applications.findFirst({
    where: { id: appId, staff_id: userId },
    select: { id: true, job_id: true, status: true, checked_in_at: true, checked_out_at: true },
  });
  if (!app) throw new ServiceError("Aplicație negăsită.", 404);
  if (app.status !== "accepted") throw new ServiceError("Doar aplicațiile acceptate pot fi check-out.", 400);
  if (app.checked_in_at == null) throw new ServiceError("Efectuează mai întâi check-in.", 400);
  if (app.checked_out_at != null) return { alreadyDone: true };
  if (app.job_id) {
    const geo = await validateGeoForJob(app.job_id, body);
    if (!geo.valid) throw new ServiceError(geo.error, geo.statusCode);
  }
  const workDateStr = body.workDate ? String(body.workDate).trim().slice(0, 10) : null;
  const now = new Date();
  await prisma.applications.update({
    where: { id: appId },
    data: { checked_out_at: now },
  });

  // Close the currently open work session (checked_in_at exists but checked_out_at is null),
  // regardless of what `workDate` the frontend sends.
  //
  // This prevents UI inconsistencies when `workDate` was off by 1 day (timezone / user selection)
  // and the session was saved under a different work_date value.
  const openSession = await prisma.application_work_sessions.findFirst({
    where: { application_id: appId, checked_out_at: null },
    select: { id: true, work_date: true },
    orderBy: { work_date: "asc" },
  });

  if (openSession) {
    await prisma.application_work_sessions.update({
      where: { id: openSession.id },
      data: { checked_out_at: now },
    });
    return {};
  }

  // If there's no open session row, use the provided workDate to upsert.
  if (workDateStr && /^\d{4}-\d{2}-\d{2}$/.test(workDateStr)) {
    const workDate = new Date(workDateStr + "T12:00:00Z");
    const existing = await prisma.application_work_sessions.findFirst({
      where: { application_id: appId, work_date: workDate },
    });
    if (existing) {
      await prisma.application_work_sessions.update({
        where: { id: existing.id },
        data: { checked_out_at: now },
      });
    } else {
      await prisma.application_work_sessions.create({
        data: {
          application_id: appId,
          work_date: workDate,
          checked_in_at: app.checked_in_at,
          checked_out_at: now,
        },
      });
    }
  }
  return {};
}

export type SetApplicationStatusResult = {
  staffEmail: string;
  staffName: string;
  jobTitle: string;
  jobDetails: {
    title: string;
    category: string;
    location: string;
    date: string;
    endDate: string;
    startTime: string;
    endTime: string;
    hourlyRate: number | null;
  };
};

export async function setApplicationStatus(
  userId: string,
  appId: string,
  status: "accepted" | "refused"
): Promise<SetApplicationStatusResult> {
  const app = await prisma.applications.findFirst({
    where: { id: parseInt(appId, 10) },
    include: {
      jobs: {
        select: {
          user_id: true,
          Title: true,
          location: true,
          date: true,
          end_date: true,
          start_time: true,
          end_time: true,
          hourly_rate_base: true,
          job_categories: { select: { Title: true } },
        },
      },
    },
  });
  if (!app || app.jobs.user_id !== userId) throw new ServiceError("Aplicație negăsită.", 404);
  await prisma.applications.update({
    where: { id: app.id },
    data: { status },
  });
  let staffEmail = app.staff_email?.trim() ?? "";
  if (!staffEmail && app.staff_id) {
    const u = await prisma.users.findUnique({
      where: { Id: app.staff_id },
      select: { Email: true },
    });
    staffEmail = u?.Email?.trim() ?? "";
  }
  const staffName = app.staff_name?.trim() || "Angajat";
  const jobTitle = app.jobs.Title?.trim() || "Job";
  const jobDetails = {
    title: jobTitle,
    category: (app.jobs.job_categories?.Title ?? "").trim() || "",
    location: (app.jobs.location ?? "").trim() || "",
    date: app.jobs.date?.trim() ?? "",
    endDate: (app.jobs.end_date ?? "").trim() ?? "",
    startTime: (app.jobs.start_time ?? "").trim() ?? "",
    endTime: (app.jobs.end_time ?? "").trim() ?? "",
    hourlyRate: app.jobs.hourly_rate_base != null ? Number(app.jobs.hourly_rate_base) : null,
  };
  return { staffEmail, staffName, jobTitle, jobDetails };
}

const BUSINESS_TAX_RATE = 0.24;
const BUSINESS_MAINTENANCE_RATE = 0.1;

export type AdminStatistics = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalJobs: number;
  totalApplications: number;
  salaryByDomain: Array<{ categoryCode: number; categoryTitle: string; avgHourly: number; minHourly: number; maxHourly: number; jobCount: number }>;
  salaryByRegion: Array<{ region: string; avgHourly: number; jobCount: number }>;
  salaryByDomainAndRegion: Array<{ region: string; categoryCode: number; categoryTitle: string; avgHourly: number; jobCount: number }>;
  financial: { totalBase: number; taxesCollected: number; profit: number };
  companyRanking: Array<{ rank: number; companyName: string; userId: string; acceptedCount: number }>;
};

export async function getAdminStatistics(userId: string): Promise<AdminStatistics> {
  const user = await prisma.users.findUnique({ where: { Id: userId }, select: { Role: true } });
  if (normalizeRole(user?.Role) !== "admin") throw new ServiceError("Doar administratorii pot accesa statisticile.", 403);
  const [totalUsers, totalJobs, totalApplications] = await Promise.all([
    prisma.users.count(),
    prisma.jobs.count(),
    prisma.applications.count(),
  ]);
  let activeUsers = 0;
  try {
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
    activeUsers = await prisma.users.count({
      where: {
        IsActive: true,
        LastActiveAt: { gte: fifteenMinAgo },
        Role: { not: 3 },
      },
    });
  } catch {
    // LastActiveAt may be missing on older DB
  }
  const inactiveUsers = Math.max(0, totalUsers - activeUsers);
  const salaryByDomainRows = await prisma.$queryRaw<
    Array<{ category_code: number; category_title: string; avg_hourly: number; min_hourly: number; max_hourly: number; job_count: number }>
  >`
    SELECT
      COALESCE(j.job_category_code, 0) AS category_code,
      COALESCE(jc.Title, 'Fără categorie') AS category_title,
      AVG(j.hourly_rate_base) AS avg_hourly,
      MIN(j.hourly_rate_base) AS min_hourly,
      MAX(j.hourly_rate_base) AS max_hourly,
      COUNT(j.id) AS job_count
    FROM jobs j
    LEFT JOIN job_categories jc ON jc.Code = j.job_category_code
    WHERE j.hourly_rate_base IS NOT NULL
    GROUP BY j.job_category_code, jc.Title
    ORDER BY avg_hourly DESC
  `;
  const salaryByDomain = salaryByDomainRows.map((r) => ({
    categoryCode: r.category_code ?? 0,
    categoryTitle: String(r.category_title ?? "Fără categorie"),
    avgHourly: Number(Number(r.avg_hourly).toFixed(2)),
    minHourly: Number(r.min_hourly) ?? 0,
    maxHourly: Number(r.max_hourly) ?? 0,
    jobCount: Number(r.job_count) ?? 0,
  }));
  const salaryByRegionRows = await prisma.$queryRaw<
    Array<{ region: string; avg_hourly: number; job_count: number }>
  >`
    SELECT
      COALESCE(r.name, 'Alte') AS region,
      AVG(j.hourly_rate_base) AS avg_hourly,
      COUNT(*) AS job_count
    FROM jobs j
    LEFT JOIN raioane r ON r.id = j.raion_id
    WHERE j.hourly_rate_base IS NOT NULL
    GROUP BY COALESCE(r.name, 'Alte')
    ORDER BY avg_hourly DESC
  `;
  const salaryByRegion = salaryByRegionRows.map((r) => ({
    region: String(r.region ?? "Alte"),
    avgHourly: Number(Number(r.avg_hourly).toFixed(2)),
    jobCount: Number(r.job_count) ?? 0,
  }));
  const salaryByDomainRegionRows = await prisma.$queryRaw<
    Array<{ region: string; category_code: number; category_title: string; avg_hourly: number; job_count: number }>
  >`
    SELECT
      COALESCE(r.name, 'Alte') AS region,
      COALESCE(j.job_category_code, 0) AS category_code,
      COALESCE(jc.Title, 'Fără categorie') AS category_title,
      AVG(j.hourly_rate_base) AS avg_hourly,
      COUNT(j.id) AS job_count
    FROM jobs j
    LEFT JOIN job_categories jc ON jc.Code = j.job_category_code
    LEFT JOIN raioane r ON r.id = j.raion_id
    WHERE j.hourly_rate_base IS NOT NULL
    GROUP BY COALESCE(r.name, 'Alte'), j.job_category_code, jc.Title
    ORDER BY region, category_title
  `;
  const salaryByDomainAndRegion = salaryByDomainRegionRows.map((r) => ({
    region: String(r.region ?? "Alte"),
    categoryCode: r.category_code ?? 0,
    categoryTitle: String(r.category_title ?? "Fără categorie"),
    avgHourly: Number(Number(r.avg_hourly).toFixed(2)),
    jobCount: Number(r.job_count) ?? 0,
  }));
  const financialRows = await prisma.$queryRaw<Array<{ total_base: number }>>`
    SELECT SUM(
      (TIMESTAMPDIFF(SECOND, ws.checked_in_at, ws.checked_out_at) / 3600.0) * COALESCE(j.hourly_rate_base, 0)
    ) AS total_base
    FROM application_work_sessions ws
    INNER JOIN applications a ON a.id = ws.application_id
    INNER JOIN jobs j ON j.id = a.job_id
    WHERE ws.checked_in_at IS NOT NULL AND ws.checked_out_at IS NOT NULL
  `;
  const totalBase = Number(financialRows[0]?.total_base ?? 0) || 0;
  const taxesCollected = Number((totalBase * BUSINESS_TAX_RATE).toFixed(2));
  const profit = Number((totalBase * BUSINESS_MAINTENANCE_RATE).toFixed(2));
  const rankingRows = await prisma.$queryRaw<
    Array<{ company_name: string; user_id: string; accepted_count: number }>
  >`
    SELECT
      COALESCE(bp.CompanyName, 'Necunoscut') AS company_name,
      j.user_id AS user_id,
      COUNT(a.id) AS accepted_count
    FROM applications a
    INNER JOIN jobs j ON j.id = a.job_id
    LEFT JOIN business_profiles bp ON bp.UserId = j.user_id
    WHERE LOWER(TRIM(COALESCE(a.status, ''))) = 'accepted'
    GROUP BY j.user_id, bp.CompanyName
    ORDER BY accepted_count DESC
    LIMIT 50
  `;
  const companyRanking = rankingRows.map((r, i) => ({
    rank: i + 1,
    companyName: String(r.company_name ?? "Necunoscut"),
    userId: String(r.user_id ?? ""),
    acceptedCount: Number(r.accepted_count ?? 0),
  }));
  return {
    totalUsers,
    activeUsers,
    inactiveUsers,
    totalJobs,
    totalApplications,
    salaryByDomain,
    salaryByRegion,
    salaryByDomainAndRegion,
    financial: { totalBase: Number(totalBase.toFixed(2)), taxesCollected, profit },
    companyRanking,
  };
}

export type CustomerStatistics = {
  totalEmployees: number;
  categoriesByJobCount: Array<{ code: number; title: string; count: number }>;
  branchesByJobCount: Array<{ branchId: string; branchName: string; count: number }>;
};

export async function getStatistics(userId: string): Promise<CustomerStatistics> {
  const { customerLike } = await getResolvedRoleAndCustomerLike(userId);
  if (!customerLike) throw new ServiceError("Doar customer poate vedea statisticile.", 403);
  const [staffIdGroups, categoryAgg, bp] = await Promise.all([
    prisma.applications.groupBy({
      by: ["staff_id"],
      where: { status: "accepted", jobs: { user_id: userId } },
    }),
    prisma.jobs.groupBy({
      by: ["job_category_code"],
      where: { user_id: userId },
      _count: { id: true },
    }),
    prisma.business_profiles.findFirst({
      where: { UserId: userId },
      select: { Id: true },
    }),
  ]);
  const categoryCodes = categoryAgg.map((c) => c.job_category_code).filter((c): c is number => c != null);
  const categoriesData =
    categoryCodes.length > 0
      ? await prisma.job_categories.findMany({
          where: { Code: { in: categoryCodes } },
          select: { Code: true, Title: true },
        })
      : [];
  const titleByCode = Object.fromEntries(categoriesData.map((c) => [c.Code, c.Title]));
  const categoriesByJobCount = categoryAgg.map((r) => ({
    code: r.job_category_code ?? 0,
    title: titleByCode[r.job_category_code!] ?? "Fără categorie",
    count: r._count.id,
  }));
  let branchesByJobCount: Array<{ branchId: string; branchName: string; count: number }> = [];
  if (bp) {
    const branches = await prisma.branches.findMany({
      where: { BusinessProfileId: bp.Id, IsActive: true },
      select: { Id: true, Name: true, Address: true, City: true },
    });
    const jobs = await prisma.jobs.findMany({
      where: { user_id: userId },
      select: { id: true, location: true },
    });
    for (const b of branches) {
      const count = jobs.filter(
        (j) =>
          (j.location && (j.location.includes(b.Address) || j.location.includes(b.City) || b.Address.includes(j.location) || b.City.includes(j.location))) ||
          false
      ).length;
      branchesByJobCount.push({ branchId: b.Id, branchName: b.Name, count });
    }
    branchesByJobCount.sort((a, b) => b.count - a.count);
  }
  return {
    totalEmployees: staffIdGroups.length,
    categoriesByJobCount,
    branchesByJobCount,
  };
}

