import { Router, Request, Response } from "express";
import db from "../db";
import { authMiddleware, JwtPayload } from "../middleware/auth";
import { notifyCustomerNewApplication, notifyStaffAccepted, notifyStaffRefused } from "../email";
import { stringToVacancyStatus, ApplicationStatus, stringToApplicationStatus } from "../enums";

const router = Router();

type ReqWithUser = Request & { user?: JwtPayload };

function normalizeRole(raw: unknown): "staff" | "customer" | "admin" | "" {
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

function getRoleFromRow(row: unknown): unknown {
  if (!row || typeof row !== "object") return undefined;
  const r = row as Record<string, unknown>;
  return r.role ?? r.Role;
}

async function isBusinessUser(userId: string): Promise<boolean> {
  const [rows] = await db.query(
    "SELECT Id FROM business_profiles WHERE UserId = ? LIMIT 1",
    [userId]
  ) as [Record<string, unknown>[], unknown];
  return Array.isArray(rows) && rows.length > 0;
}

async function optionalQuery(conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, sql: string, params: unknown[]): Promise<void> {
  try {
    await conn.query(sql, params);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "ER_BAD_FIELD_ERROR") return;
    throw e;
  }
}


async function getJobCategoryHourlyMin(conn: { query: (sql: string, params?: unknown[]) => Promise<unknown> }, code: number): Promise<number | null> {
  const [rows] = await conn.query(
    "SELECT HourlyMin FROM job_categories WHERE Code = ? LIMIT 1",
    [code]
  ) as [Record<string, unknown>[], unknown];

  const r = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!r) return null;

  const v = Number((r as any).HourlyMin);
  return Number.isFinite(v) ? v : null;
}

function toNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse "HH:mm" or "H:mm" to minutes since midnight (0..1439).
 * Returns null if invalid.
 */
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

/**
 * Duration in hours between start and end time.
 * If end time is before or equal to start time (e.g. 20:00 -> 05:00), end is treated as next day.
 */
function hoursBetweenTimes(startStr: string | undefined, endStr: string | undefined): number | null {
  const startM = timeStringToMinutes(startStr);
  const endM = timeStringToMinutes(endStr);
  if (startM == null || endM == null) return null;
  const minsPerDay = 24 * 60;
  let durationMins: number;
  if (endM <= startM) {
    durationMins = minsPerDay - startM + endM;
  } else {
    durationMins = endM - startM;
  }
  const hours = durationMins / 60;
  return Number.isFinite(hours) && hours >= 0 ? Math.round(hours * 100) / 100 : null;
}


/** Distanță în metri între două puncte (Haversine formula). */
function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Standard error when user is outside allowed radius (prevents frontend manipulation). */
const LOCATION_RADIUS_ERROR = "You are not within the allowed location radius.";

/** Default workplace radius in meters (check-in/check-out allowed only within this distance). */
const DEFAULT_GEO_RADIUS_M = 200;

/**
 * Validates user coordinates against job workplace (backend authority – prevents faked coordinates).
 * Returns { valid: true } or { valid: false, statusCode, error }.
 */
async function validateGeoForJob(
  jobId: number,
  body: { lat?: unknown; lng?: unknown }
): Promise<{ valid: true } | { valid: false; statusCode: number; error: string }> {
  const [jobRows] = await db.query(
    "SELECT check_in_lat, check_in_lng, check_in_radius_m FROM jobs WHERE id = ?",
    [jobId]
  ) as [Record<string, unknown>[], unknown];
  const jobRow = Array.isArray(jobRows) ? jobRows[0] : null;
  const jLat = jobRow?.check_in_lat != null ? Number(jobRow.check_in_lat) : NaN;
  const jLng = jobRow?.check_in_lng != null ? Number(jobRow.check_in_lng) : NaN;
  const jRadius = jobRow?.check_in_radius_m != null ? Number(jobRow.check_in_radius_m) : DEFAULT_GEO_RADIUS_M;
  if (!Number.isFinite(jLat) || !Number.isFinite(jLng) || jRadius <= 0) {
    return { valid: true }; // No geo-fence for this job
  }
  const lat = body.lat != null ? Number(body.lat) : NaN;
  const lng = body.lng != null ? Number(body.lng) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, statusCode: 400, error: "Location permission is required for check-in/check-out at this workplace." };
  }
  const distM = haversineMeters(jLat, jLng, lat, lng);
  if (distM > jRadius) {
    return { valid: false, statusCode: 400, error: LOCATION_RADIUS_ERROR };
  }
  return { valid: true };
}

function rowToJob(r: Record<string, unknown>): Record<string, unknown> {
  const postedByName = r.posted_by_name ?? (r as Record<string, unknown>).postedByName;
  const name = typeof postedByName === "string" && postedByName.trim() ? postedByName.trim() : undefined;
  const postedByUserId = r.posted_by_user_id ?? r.user_id;
  const postedByRole = r.posted_by_role;
  const postedByAvatar = r.posted_by_avatar;
  const checkInLat = r.check_in_lat != null ? Number(r.check_in_lat) : undefined;
  const checkInLng = r.check_in_lng != null ? Number(r.check_in_lng) : undefined;
  const checkInRadiusM = r.check_in_radius_m != null ? Number(r.check_in_radius_m) : undefined;
  const acceptedCount = r.accepted_count != null ? Number(r.accepted_count) : 0;

  const startTime = r.start_time != null ? String(r.start_time) : undefined;
  const endTime = r.end_time != null ? String(r.end_time) : undefined;
  const storedDuration = r.duration != null && String(r.duration).trim() !== "" ? String(r.duration).trim() : undefined;
  const computedDuration = hoursBetweenTimes(startTime, endTime);
  const duration = storedDuration ?? (computedDuration != null ? String(computedDuration) : undefined);

  const isPromoted = r.is_promoted === 1 || r.is_promoted === true;
  return {
    id: String(r.id),
    job: r.job, // Custom title (max 30 chars)
    jobCategoryTitle: r.job_category_title ?? undefined, // Category name from job_categories
    location: r.location,
    status: r.status,
    statusClass: r.status_class,
    date: r.date,
    endDate: r.end_date ?? undefined,
    jobType: r.job_type ?? undefined,
    applicationsCount: r.applications_count ?? 0,
    acceptedCount,
    startTime,
    endTime,
    peopleNeeded: r.people_needed ?? undefined,
    duration,
    estimatedSalary: r.estimated_salary ?? undefined,
    imageUrl: r.image_url ?? undefined,
    postedBy: name,
    isPromoted,


    // ✅ NEW (so frontend can see/store them)
    jobCategoryCode: r.job_category_code ?? undefined,
    hourlyRateBase: r.hourly_rate_base ?? undefined,

    postedById: postedByUserId != null ? String(postedByUserId) : undefined,
    postedByRole: typeof postedByRole === "string" && postedByRole.trim() ? postedByRole.trim() : undefined,
    postedByAvatar: typeof postedByAvatar === "string" && postedByAvatar.trim() ? postedByAvatar.trim() : undefined,
    ...(Number.isFinite(checkInLat) && Number.isFinite(checkInLng) && Number.isFinite(checkInRadiusM) && checkInRadiusM! > 0
      ? { checkInLat, checkInLng, checkInRadiusM }
      : {}),

  };
}


/** GET /api/jobs/categories - Get all job categories with minimum hourly rates */
router.get("/categories", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [categories] = await db.query(
      `SELECT Code, Title, HourlyMin FROM job_categories ORDER BY Code ASC`
    ) as [{ Code: number; Title: string; HourlyMin: number }[], unknown];

    const result = Array.isArray(categories)
      ? categories.map((cat) => ({
          code: cat.Code,
          title: cat.Title,
          hourlyMin: cat.HourlyMin,
        }))
      : [];

    res.json({ categories: result });
  } catch (e) {
    const err = e as Error;
    console.error("GET /api/jobs/categories error:", err);
    res.status(500).json({ error: "Eroare la încărcarea categoriilor de job." });
  }
});

/** GET /api/jobs/raioane - list/search raioane (districts/municipalities) */
router.get("/raioane", async (req: Request, res: Response): Promise<void> => {
  try {
    const search = String(req.query.search ?? "").trim();
    let query = "SELECT id, name, type FROM raioane";
    const params: unknown[] = [];
    
    if (search) {
      query += " WHERE name LIKE ? ORDER BY name";
      params.push(`%${search}%`);
    } else {
      query += " ORDER BY type, name";
    }
    
    const [rows] = await db.query(query, params) as [Record<string, unknown>[], unknown];
    const raioane = (Array.isArray(rows) ? rows : []).map((r) => ({
      id: Number(r.id ?? 0),
      name: String(r.name ?? ""),
      type: String(r.type ?? "raion"),
    }));
    res.json({ raioane });
  } catch (err) {
    console.error("GET /api/jobs/raioane error:", err);
    res.status(500).json({ error: "Eroare la încărcarea raioanelor." });
  }
});

/** GET /api/jobs - customer/business: doar joburile proprii; staff/admin: toate joburile */
router.get("/", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [rows] = await db.query(
    "SELECT Role FROM users WHERE Id = ?",
    [userId]
  ) as [unknown[], unknown];
  const roleRaw = getRoleFromRow((rows as unknown[] | undefined)?.[0]);
  const role = normalizeRole(roleRaw);
  const customerLike = role === "customer" || await isBusinessUser(String(userId));
  let list: Record<string, unknown>[];
  if (customerLike) {
    const [r] = await db.query(
      `SELECT j.*,
              j.Title AS job,
              COALESCE(jc.Title, (SELECT Title FROM job_categories WHERE Code = j.job_category_code LIMIT 1)) AS job_category_title,
              COALESCE(
                bp.CompanyName,
                TRIM(CONCAT(ep.Name, ' ', ep.Surname)),
                u.Email
              ) AS posted_by_name,
              u.Id AS posted_by_user_id,
              u.Role AS posted_by_role,
              COALESCE(u.Avatar, ep.ProfilePictureFileId, NULL) AS posted_by_avatar,
              (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND LOWER(TRIM(COALESCE(a.status,''))) = 'accepted') AS accepted_count
         FROM jobs j
         LEFT JOIN job_categories jc ON jc.Code = j.job_category_code
         LEFT JOIN users u ON u.Id = j.user_id
         LEFT JOIN business_profiles bp ON bp.UserId = u.Id
         LEFT JOIN employee_profiles ep ON ep.UserId = u.Id
         WHERE j.user_id = ?
         ORDER BY COALESCE(j.is_promoted, 0) DESC, j.created_at DESC`,
      [userId]
    ) as [Record<string, unknown>[], unknown];
    list = Array.isArray(r) ? r : [];
  } else {
    const [r] = await db.query(
      `SELECT j.*,
              j.Title AS job,
              COALESCE(jc.Title, (SELECT Title FROM job_categories WHERE Code = j.job_category_code LIMIT 1)) AS job_category_title,
              COALESCE(
                bp.CompanyName,
                TRIM(CONCAT(ep.Name, ' ', ep.Surname)),
                u.Email
              ) AS posted_by_name,
              u.Id AS posted_by_user_id,
              u.Role AS posted_by_role,
              COALESCE(u.Avatar, ep.ProfilePictureFileId, NULL) AS posted_by_avatar,
              (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND LOWER(TRIM(COALESCE(a.status,''))) = 'accepted') AS accepted_count
         FROM jobs j
         LEFT JOIN job_categories jc ON jc.Code = j.job_category_code
         LEFT JOIN users u ON u.Id = j.user_id
         LEFT JOIN business_profiles bp ON bp.UserId = u.Id
         LEFT JOIN employee_profiles ep ON ep.UserId = u.Id
         ORDER BY COALESCE(j.is_promoted, 0) DESC, j.created_at DESC`
    ) as [Record<string, unknown>[], unknown];
    list = Array.isArray(r) ? r : [];
  }
  res.json({ jobs: list.map(rowToJob) });
});

/** POST /api/jobs - create job (customer only) */
router.post("/", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [rows] = await db.query(
    "SELECT Role FROM users WHERE Id = ?",
    [userId]
  ) as [unknown[], unknown];
  const roleRaw = getRoleFromRow((rows as unknown[] | undefined)?.[0]);
  const role = normalizeRole(roleRaw);
  const customerLike = role === "customer" || await isBusinessUser(String(userId));
  if (!customerLike) {
    res.status(403).json({ error: "Doar customer poate crea joburi." });
    return;
  }
  const b = req.body ?? {};
  const jobTitle = String(b.job ?? "").trim().slice(0, 30); // Custom title, max 30 chars
  const location = String(b.location ?? "").trim();
  const status = String(b.status ?? "Draft");
  const statusClass = String(b.statusClass ?? "bg-gray-100 text-gray-700");
  const date = String(b.date ?? "");
  const imageUrl = typeof b.imageUrl === "string" && b.imageUrl.trim() ? b.imageUrl.trim() : null;

    // ✅ NEW: category + hourly rate base (MDL/hour)
    const jobCategoryCode = toNumber((b as any).jobCategoryCode);
    const hourlyRateBase = toNumber((b as any).hourlyRateBase);
  
    if (jobCategoryCode == null || jobCategoryCode <= 0) {
      res.status(400).json({ error: "jobCategoryCode is required and must be a positive number." });
      return;
    }
    if (hourlyRateBase == null || hourlyRateBase <= 0) {
      res.status(400).json({ error: "hourlyRateBase is required and must be a positive number." });
      return;
    }
  
  // ✅ NEW: raion_id and localitate for precise region tracking
  const raionId = (b as any).raionId != null ? toNumber((b as any).raionId) : null;
  const localitate = (b as any).localitate != null ? String((b as any).localitate).trim().slice(0, 200) : null;
  
  // Validate raion_id is required and exists
  if (raionId == null || raionId <= 0) {
    res.status(400).json({ error: "raionId is required and must be a positive number." });
    return;
  }
  const [raionRows] = await db.query(
    "SELECT id FROM raioane WHERE id = ? LIMIT 1",
    [raionId]
  ) as [Record<string, unknown>[], unknown];
  if (!Array.isArray(raionRows) || raionRows.length === 0) {
    res.status(400).json({ error: "Invalid raionId (not found in raioane table)." });
    return;
  }
  
  if (!jobTitle || jobTitle.length === 0) {
    res.status(400).json({ error: "Titlul jobului este obligatoriu (maxim 30 caractere)." });
    return;
  }
  if (!location) {
    res.status(400).json({ error: "location este obligatorie." });
    return;
  }

  const checkInLat = b.checkInLat != null ? Number(b.checkInLat) : null;
  const checkInLng = b.checkInLng != null ? Number(b.checkInLng) : null;
  const checkInRadiusM =
    b.checkInRadiusM != null
      ? Math.max(1, Math.min(500, Number(b.checkInRadiusM)))
      : (checkInLat != null && checkInLng != null ? DEFAULT_GEO_RADIUS_M : null);

  const startTime = (b as any).startTime != null ? String((b as any).startTime).trim() : null;
  const endTime = (b as any).endTime != null ? String((b as any).endTime).trim() : null;
  const computedDurationHours = hoursBetweenTimes(startTime ?? undefined, endTime ?? undefined);
  const durationValue = computedDurationHours != null
    ? String(computedDurationHours)
    : ((b as any).duration != null ? String((b as any).duration) : null);
  
  // MIGRATION FIX: Use transaction to ensure atomicity and populate UUID/enum columns
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
        // Validate that job category exists
        const [categoryRows] = await conn.query(
          "SELECT Title FROM job_categories WHERE Code = ? LIMIT 1",
          [jobCategoryCode]
        ) as [{ Title: string }[], unknown];
        
        if (!Array.isArray(categoryRows) || categoryRows.length === 0) {
          await conn.rollback();
          res.status(400).json({ error: "Invalid jobCategoryCode (not found in job_categories)." });
          return;
        }
    
    // Insert job
       // Insert job (✅ now includes category + hourly base)
    // Insert job (using custom title in job field)
       const [result] = await conn.query(
        `INSERT INTO jobs (
            user_id,
            Title,
            location,
            status,
            status_class,
            date,
            end_date,
            job_type,
            applications_count,
            start_time,
            end_time,
            people_needed,
            duration,
            estimated_salary,
            image_url,
            job_category_code,
            hourly_rate_base,
            raion_id,
            localitate
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          jobTitle, // Use custom title (max 30 chars)
          location,
          status,
          statusClass,
          date,
          (b as any).endDate ?? null,
          (b as any).jobType ?? null,
          startTime,
          endTime,
          (b as any).peopleNeeded ?? null,
          durationValue,
          (b as any).estimatedSalary ?? null,
          imageUrl,
          jobCategoryCode,
          hourlyRateBase,
          raionId,
          localitate,
        ]
      ) as [{ insertId: number }, unknown];
  
    const id = result.insertId;
    
    await conn.commit();
    
    // Fetch created job for response
    const [r] = await conn.query(
      `SELECT j.*,

              j.Title AS job,
              jc.Title AS job_category_title,
              u.Id AS posted_by_user_id,
              u.Role AS posted_by_role,
              COALESCE(u.Avatar, ep.ProfilePictureFileId, NULL) AS posted_by_avatar,
              COALESCE(
                bp.CompanyName,
                TRIM(CONCAT(ep.Name, ' ', ep.Surname)),
                u.Email
              ) AS posted_by_name
         FROM jobs j
         LEFT JOIN job_categories jc ON jc.Code = j.job_category_code
         LEFT JOIN users u ON u.Id = j.user_id
         LEFT JOIN business_profiles bp ON bp.UserId = u.Id
         LEFT JOIN employee_profiles ep ON ep.UserId = u.Id
         WHERE j.id = ?`,
      [id]
    ) as [Record<string, unknown>[], unknown];
    const created = Array.isArray(r) && r[0] ? rowToJob(r[0]) : { id: String(id), job: jobTitle, location, status, statusClass, date };
    res.status(201).json(created);
  } catch (error) {
    await conn.rollback();
    console.error("Job creation error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Eroare la crearea jobului." });
    }
  } finally {
    conn.release();
  }
});

/** DELETE /api/jobs/:id - delete job (customer, own jobs only) */
router.delete("/:id", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const jobId = req.params.id;
  if (!userId || !jobId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [rows] = await db.query(
    "SELECT id, user_id FROM jobs WHERE id = ?",
    [jobId]
  ) as [Record<string, unknown>[], unknown];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    res.status(404).json({ error: "Job negăsit." });
    return;
  }
  if (String(row.user_id) !== userId) {
    res.status(403).json({ error: "Nu poți șterge acest job." });
    return;
  }
  await db.query("DELETE FROM applications WHERE job_id = ?", [jobId]);
  await db.query("DELETE FROM jobs WHERE id = ?", [jobId]);
  res.json({ ok: true });
});

/** PATCH /api/jobs/:id/promote - customer/admin: set job as promoted (booster) or not */
router.patch("/:id/promote", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const jobId = req.params.id;
  const promoted = req.body?.promoted === true;
  if (!userId || !jobId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [rows] = await db.query(
    "SELECT id, user_id FROM jobs WHERE id = ?",
    [jobId]
  ) as [Record<string, unknown>[], unknown];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    res.status(404).json({ error: "Job negăsit." });
    return;
  }
  const [roleRows] = await db.query("SELECT Role FROM users WHERE Id = ?", [userId]) as [unknown[], unknown];
  const role = normalizeRole(getRoleFromRow((roleRows as unknown[] | undefined)?.[0]));
  const isOwner = String(row.user_id) === userId;
  if (!isOwner && role !== "admin") {
    res.status(403).json({ error: "Doar proprietarul jobului sau admin poate seta promovarea." });
    return;
  }
  await db.query("UPDATE jobs SET is_promoted = ? WHERE id = ?", [promoted ? 1 : 0, jobId]);
  res.json({ ok: true, promoted });
});

/** GET /api/jobs/my-applications - staff: my application status per job */
router.get("/my-applications", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [rows] = await db.query(
    "SELECT Role FROM users WHERE Id = ?",
    [userId]
  ) as [unknown[], unknown];
  const roleRaw = getRoleFromRow((rows as unknown[] | undefined)?.[0]);
  const role = normalizeRole(roleRaw);
  if (role !== "staff") {
    res.json({ byJob: {} });
    return;
  }
  const [list] = await db.query(
    "SELECT id, job_id, status, checked_in_at, checked_out_at FROM applications WHERE staff_id = ?",
    [userId]
  ) as [Record<string, unknown>[], unknown];
  const appList = Array.isArray(list) ? list : [];
  const byJob: Record<string, { status: string; applicationId: string; checkedInAt?: string; checkedOutAt?: string; workSessions: { workDate: string; checkedInAt?: string; checkedOutAt?: string }[] }> = {};
  const appIds = appList.map((r) => (r.id != null ? Number(r.id) : NaN)).filter((id) => !Number.isNaN(id) && id > 0);
  const sessionsByApp: Record<string, { workDate: string; checkedInAt?: string; checkedOutAt?: string }[]> = {};
  if (appIds.length > 0) {
    const ph = appIds.map(() => "?").join(",");
    const [sessions] = await db.query(
      `SELECT application_id, work_date, checked_in_at, checked_out_at FROM application_work_sessions WHERE application_id IN (${ph}) ORDER BY work_date`,
      appIds
    ) as [Record<string, unknown>[], unknown];
    (Array.isArray(sessions) ? sessions : []).forEach((s) => {
      const aid = String(s.application_id);
      if (!sessionsByApp[aid]) sessionsByApp[aid] = [];
      const raw = s.work_date;
      let workDate: string;
      if (raw instanceof Date) {
        const d = raw as Date;
        workDate = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      } else {
        workDate = String(raw ?? "").slice(0, 10);
      }
      sessionsByApp[aid].push({
        workDate,
        checkedInAt: s.checked_in_at != null ? (s.checked_in_at instanceof Date ? (s.checked_in_at as Date).toISOString() : String(s.checked_in_at)) : undefined,
        checkedOutAt: s.checked_out_at != null ? (s.checked_out_at instanceof Date ? (s.checked_out_at as Date).toISOString() : String(s.checked_out_at)) : undefined,
      });
    });
  }
  appList.forEach((r) => {
    const jid = String(r.job_id);
    const aid = String(r.id);
    const checkedIn = r.checked_in_at;
    const checkedOut = r.checked_out_at;
    byJob[jid] = {
      status: String(r.status),
      applicationId: aid,
      checkedInAt: checkedIn != null ? (checkedIn instanceof Date ? (checkedIn as Date).toISOString() : String(checkedIn)) : undefined,
      checkedOutAt: checkedOut != null ? (checkedOut instanceof Date ? (checkedOut as Date).toISOString() : String(checkedOut)) : undefined,
      workSessions: sessionsByApp[aid] ?? [],
    };
  });
  res.json({ byJob });
});
/** GET /api/jobs/my-applications/list - staff: full applications history (list) with job details + sessions + rating */
router.get("/my-applications/list", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Ensure role = staff
  const [roleRows] = await db.query("SELECT Role FROM users WHERE Id = ?", [userId]) as [unknown[], unknown];
  const roleRaw = getRoleFromRow((roleRows as unknown[] | undefined)?.[0]);
  const role = normalizeRole(roleRaw);
  if (role !== "staff") {
    res.json({ applications: [] });
    return;
  }

  // Get applications + job details + business/customer name
  const [appRows] = await db.query(
    `SELECT 
        a.id,
        a.job_id,
        a.status,
        a.created_at,
        a.checked_in_at,
        a.checked_out_at,
        j.Title AS job_title,
        jc.Title AS job_category_title,
        j.location AS job_location,
        j.date AS job_date,
        j.end_date AS job_end_date,
        COALESCE(
          bp.CompanyName,
          TRIM(CONCAT(ep.Name, ' ', ep.Surname)),
          u.Email
        ) AS customer_name,
        r.score AS rating_score
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     LEFT JOIN job_categories jc ON jc.Code = j.job_category_code
     LEFT JOIN users u ON u.Id = j.user_id
     LEFT JOIN business_profiles bp ON bp.UserId = u.Id
     LEFT JOIN employee_profiles ep ON ep.UserId = u.Id
     LEFT JOIN ratings r ON r.application_id = a.id
     WHERE a.staff_id = ?
     ORDER BY a.created_at DESC`,
    [userId]
  ) as [Record<string, unknown>[], unknown];

  const list = Array.isArray(appRows) ? appRows : [];

  const toIso = (v: unknown): string | undefined => {
    if (v == null) return undefined;
    if (v instanceof Date) return v.toISOString();
    const s = String(v);
    return s.trim() || undefined;
  };

  // Work sessions (if table exists)
  const appIds = list
    .map((r) => (r.id != null ? Number(r.id) : NaN))
    .filter((id) => !Number.isNaN(id) && id > 0);

  const sessionsByAppId: Record<string, { workDate: string; checkedInAt?: string; checkedOutAt?: string }[]> = {};

  if (appIds.length > 0) {
    const ph = appIds.map(() => "?").join(",");
    const [sessions] = await db.query(
      `SELECT application_id, work_date, checked_in_at, checked_out_at
       FROM application_work_sessions
       WHERE application_id IN (${ph})
       ORDER BY work_date`,
      appIds
    ) as [Record<string, unknown>[], unknown];

    (Array.isArray(sessions) ? sessions : []).forEach((s) => {
      const aid = String(s.application_id);
      if (!sessionsByAppId[aid]) sessionsByAppId[aid] = [];
      const workDate =
        s.work_date instanceof Date
          ? (s.work_date as Date).toISOString().slice(0, 10)
          : String(s.work_date ?? "").slice(0, 10);

      sessionsByAppId[aid].push({
        workDate,
        checkedInAt: toIso(s.checked_in_at),
        checkedOutAt: toIso(s.checked_out_at),
      });
    });
  }

  // Build response
  const out = list.map((a) => {
    const aid = String(a.id);
    return {
      id: aid,
      jobId: String(a.job_id),
      status: String(a.status) as "pending" | "accepted" | "refused",
      createdAt: toIso(a.created_at),

      jobTitle: a.job_title != null ? String(a.job_title) : undefined,
      jobLocation: a.job_location != null ? String(a.job_location) : undefined,
      jobDate: a.job_date != null ? String(a.job_date) : undefined,
      jobEndDate: a.job_end_date != null ? String(a.job_end_date) : undefined,

      customerName: a.customer_name != null ? String(a.customer_name) : undefined,

      checkedInAt: toIso(a.checked_in_at),
      checkedOutAt: toIso(a.checked_out_at),
      workSessions: sessionsByAppId[aid] ?? [],

      ratingScore: a.rating_score != null ? Number(a.rating_score) : undefined,
    };
  });

  res.json({ applications: out });
});


/** POST /api/jobs/:id/apply - staff applies to job */
router.post("/:id/apply", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const jobId = req.params.id;
  if (!userId || !jobId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [userRows] = await db.query(
    `SELECT
        COALESCE(NULLIF(TRIM(CONCAT(ep.Name, ' ', ep.Surname)), ''), u.Email) AS staff_name,
        u.Email AS staff_email,
        u.Role AS role_value
      FROM users u
      LEFT JOIN employee_profiles ep ON ep.UserId = u.Id
      WHERE u.Id = ?`,
    [userId]
  ) as [Record<string, unknown>[], unknown];
  const userRow = Array.isArray(userRows) ? userRows[0] : null;
  if (!userRow || normalizeRole(userRow.role_value) !== "staff") {
    res.status(403).json({ error: "Doar staff poate aplica la joburi." });
    return;
  }
  const [jobRows] = await db.query("SELECT id, Title, user_id FROM jobs WHERE id = ?", [jobId]) as [Record<string, unknown>[], unknown];
  if (!Array.isArray(jobRows) || !jobRows[0]) {
    res.status(404).json({ error: "Job negăsit." });
    return;
  }
  const jobRow = jobRows[0];
  const [existing] = await db.query(
    "SELECT id FROM applications WHERE job_id = ? AND staff_id = ?",
    [jobId, userId]
  ) as [Record<string, unknown>[], unknown];
  if (Array.isArray(existing) && existing.length > 0) {
    res.status(400).json({ error: "Ai aplicat deja la acest job." });
    return;
  }
  
  // MIGRATION FIX: Use transaction to ensure atomicity and populate UUID/enum columns
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    // Insert application
    const [insertResult] = await conn.query(
      "INSERT INTO applications (job_id, staff_id, staff_name, staff_email, status) VALUES (?, ?, ?, ?, 'pending')",
      [jobId, userId, String(userRow.staff_name ?? "").trim(), (userRow.staff_email as string | undefined) ?? null]
    ) as [{ insertId: number }, unknown];
    const appId = insertResult.insertId;
    
    // Update applications count
    await conn.query(
      "UPDATE jobs SET applications_count = applications_count + 1 WHERE id = ?",
      [jobId]
    );
    
    await conn.commit();
    
    // Send notification (outside transaction)
    const customerUserId = jobRow.user_id;
    if (customerUserId) {
      const [ownerRows] = await conn.query("SELECT Email AS email FROM users WHERE Id = ?", [customerUserId]) as [Record<string, unknown>[], unknown];
      const ownerEmail = Array.isArray(ownerRows) && ownerRows[0] ? String((ownerRows[0] as { email: string }).email ?? "").trim() : "";
      const jobTitle = String(jobRow.Title ?? "").trim() || "Job";
      const staffName = String(userRow.staff_name ?? "").trim() || "Angajat";
      if (ownerEmail) notifyCustomerNewApplication(ownerEmail, staffName, jobTitle).catch(() => {});
    }
    
    res.status(201).json({ ok: true });
  } catch (error) {
    await conn.rollback();
    console.error("Application creation error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Eroare la aplicarea la job." });
    }
  } finally {
    conn.release();
  }
});

/** GET /api/jobs/applications - customer/business: applications for their jobs */
router.get("/applications", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [rows] = await db.query(
    "SELECT Role FROM users WHERE Id = ?",
    [userId]
  ) as [unknown[], unknown];
  const roleRaw = getRoleFromRow((rows as unknown[] | undefined)?.[0]);
  const role = normalizeRole(roleRaw);
  const customerLike = role === "customer" || await isBusinessUser(String(userId));
  if (!customerLike) {
    res.status(403).json({ error: "Doar customer poate vedea aplicațiile." });
    return;
  }
  const [jobRows] = await db.query("SELECT id FROM jobs WHERE user_id = ? ORDER BY id", [userId]) as [Record<string, unknown>[], unknown];
  const jobIds = (Array.isArray(jobRows) ? jobRows : [])
    .map((r) => r.id ?? (r as Record<string, unknown>).Id)
    .filter((id) => id != null && id !== "");
  if (jobIds.length === 0) {
    res.json({ applications: {} });
    return;
  }
  const placeholders = jobIds.map(() => "?").join(",");
  const [appRows] = await db.query(
    `SELECT a.id, a.job_id, a.staff_id, a.staff_name, a.staff_email, a.status, a.checked_in_at, a.checked_out_at, a.business_confirmed_at, a.created_at,
     r.score AS rating_score
     FROM applications a
     LEFT JOIN ratings r ON r.application_id = a.id AND r.rater_id = ?
     WHERE a.job_id IN (${placeholders}) ORDER BY a.created_at DESC`,
    [userId, ...jobIds]
  ) as [Record<string, unknown>[], unknown];
  const list = Array.isArray(appRows) ? appRows : [];
  const staffIdStrings = [...new Set(list.map((a) => (a.staff_id != null ? String(a.staff_id).trim() : "")).filter(Boolean))];
  const avatarByStaffId: Record<string, string> = {};
  if (staffIdStrings.length > 0) {
    const ph = staffIdStrings.map(() => "?").join(",");
    const [userRows] = await db.query(
      `SELECT u.Id AS id, COALESCE(u.Avatar, ep.ProfilePictureFileId, NULL) AS avatar
       FROM users u
       LEFT JOIN employee_profiles ep ON u.Id = ep.UserId
       WHERE u.Id IN (${ph})`,
      staffIdStrings
    ) as [Record<string, unknown>[], unknown];
    (Array.isArray(userRows) ? userRows : []).forEach((u) => {
      const id = u.id != null ? String(u.id).trim() : "";
      if (!id) return;
      let av = u.avatar;
      if (Buffer.isBuffer(av)) av = av.toString("utf8");
      if (typeof av === "string" && av.trim()) avatarByStaffId[id] = av.trim();
    });
  }
  const toIso = (v: unknown): string | undefined => {
    if (v == null) return undefined;
    if (v instanceof Date) return v.toISOString();
    const s = String(v);
    return s.trim() || undefined;
  };
  const appIdsForSessions = list.map((a) => a.id);
  const sessionsByAppId: Record<string, { workDate: string; checkedInAt?: string; checkedOutAt?: string }[]> = {};
  if (appIdsForSessions.length > 0) {
    const ph = appIdsForSessions.map(() => "?").join(",");
    const [sessions] = await db.query(
      `SELECT application_id, work_date, checked_in_at, checked_out_at FROM application_work_sessions WHERE application_id IN (${ph}) ORDER BY work_date`,
      appIdsForSessions
    ) as [Record<string, unknown>[], unknown];
    (Array.isArray(sessions) ? sessions : []).forEach((s) => {
      const aid = String(s.application_id);
      if (!sessionsByAppId[aid]) sessionsByAppId[aid] = [];
      const workDate = s.work_date instanceof Date ? (s.work_date as Date).toISOString().slice(0, 10) : String(s.work_date ?? "").slice(0, 10);
      sessionsByAppId[aid].push({
        workDate,
        checkedInAt: toIso(s.checked_in_at),
        checkedOutAt: toIso(s.checked_out_at),
      });
    });
  }
  const byJob: Record<string, unknown[]> = {};
  list.forEach((a) => {
    const rawJobId = a.job_id ?? (a as Record<string, unknown>).job_Id;
    const jid = rawJobId != null && String(rawJobId).trim() !== "" ? String(rawJobId).trim() : null;
    if (jid == null) return;
    const aid = String(a.id);
    if (!byJob[jid]) byJob[jid] = [];
    const sidStr = a.staff_id != null ? String(a.staff_id).trim() : "";
    const staffAvatar = sidStr ? avatarByStaffId[sidStr] : undefined;
    const businessConfirmedAtVal = toIso(a.business_confirmed_at ?? (a as Record<string, unknown>).business_confirmed_at);
    byJob[jid].push({
      id: aid,
      jobId: jid,
      staffId: sidStr,
      staffName: a.staff_name,
      staffEmail: a.staff_email ?? undefined,
      staffAvatar,
      status: a.status,
      checkedInAt: toIso(a.checked_in_at),
      checkedOutAt: toIso(a.checked_out_at),
      businessConfirmedAt: businessConfirmedAtVal,
      isBusinessConfirmed: !!businessConfirmedAtVal,
      workSessions: sessionsByAppId[aid] ?? [],
      ratingScore: a.rating_score != null ? Number(a.rating_score) : undefined,
    });
  });
  res.json({ applications: byJob });
});

/** PATCH /api/jobs/applications/:id/confirm-completion - customer: confirm job finished (after staff checkout); application then moves to history */
router.patch("/applications/:id/confirm-completion", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const appId = req.params.id;
  if (!userId || !appId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [rows] = await db.query(
    "SELECT a.id, a.job_id, j.user_id, a.status FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ? AND j.user_id = ?",
    [appId, userId]
  ) as [Record<string, unknown>[], unknown];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || String(row.user_id) !== userId) {
    res.status(404).json({ error: "Aplicație negăsită." });
    return;
  }
  if (String(row.status) !== "accepted") {
    res.status(400).json({ error: "Doar aplicațiile acceptate pot fi confirmate ca finalizate." });
    return;
  }
  await db.query("UPDATE applications SET business_confirmed_at = CURRENT_TIMESTAMP WHERE id = ?", [appId]);
  res.json({ ok: true });
});

/** PATCH /api/jobs/applications/:id/check-in - staff: înregistrează începutul lucrului; stored on applications.checked_in_at */
router.patch("/applications/:id/check-in", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const appIdRaw = req.params.id;
  const appId = appIdRaw ? Number(appIdRaw) : NaN;
  if (!userId || !appIdRaw || Number.isNaN(appId) || appId < 1) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = req.body ?? {};
  const [rows] = await db.query(
    "SELECT a.id, a.staff_id, a.status, a.job_id, a.checked_in_at FROM applications a WHERE a.id = ? AND a.staff_id = ?",
    [appId, userId]
  ) as [Record<string, unknown>[], unknown];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || String(row.staff_id) !== userId) {
    res.status(404).json({ error: "Aplicație negăsită." });
    return;
  }
  if (String(row.status) !== "accepted") {
    res.status(400).json({ error: "Doar aplicațiile acceptate pot fi check-in." });
    return;
  }
  if (row.checked_in_at != null) {
    res.json({ ok: true, alreadyDone: true });
    return;
  }
  const jobId = row.job_id != null ? Number(row.job_id) : NaN;
  if (Number.isFinite(jobId) && jobId > 0) {
    const geoResult = await validateGeoForJob(jobId, body);
    if (!geoResult.valid) {
      res.status(geoResult.statusCode).json({ error: geoResult.error });
      return;
    }
  }
  const workDate = body.workDate ? String(body.workDate).trim().slice(0, 10) : null;
  await db.query("UPDATE applications SET checked_in_at = CURRENT_TIMESTAMP WHERE id = ? AND staff_id = ?", [appId, userId]);
  
  // Also create/update work session entry if workDate is provided
  if (workDate && workDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [existingSession] = await db.query(
      "SELECT id FROM application_work_sessions WHERE application_id = ? AND work_date = ?",
      [appId, workDate]
    ) as [Record<string, unknown>[], unknown];
    
    if (Array.isArray(existingSession) && existingSession.length > 0) {
      // Update existing session
      await db.query(
        "UPDATE application_work_sessions SET checked_in_at = CURRENT_TIMESTAMP WHERE application_id = ? AND work_date = ?",
        [appId, workDate]
      );
    } else {
      // Create new session
      await db.query(
        "INSERT INTO application_work_sessions (application_id, work_date, checked_in_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
        [appId, workDate]
      );
    }
  }
  
  res.json({ ok: true });
});

/** PATCH /api/jobs/applications/:id/check-out - staff: înregistrează sfârșitul lucrului; stored on applications.checked_out_at */
router.patch("/applications/:id/check-out", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const appIdRaw = req.params.id;
  const appId = appIdRaw ? Number(appIdRaw) : NaN;
  if (!userId || !appIdRaw || Number.isNaN(appId) || appId < 1) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = req.body ?? {};
  const [rows] = await db.query(
    "SELECT id, staff_id, status, job_id, checked_in_at, checked_out_at FROM applications WHERE id = ? AND staff_id = ?",
    [appId, userId]
  ) as [Record<string, unknown>[], unknown];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || String(row.staff_id) !== userId) {
    res.status(404).json({ error: "Aplicație negăsită." });
    return;
  }
  if (String(row.status) !== "accepted") {
    res.status(400).json({ error: "Doar aplicațiile acceptate pot fi check-out." });
    return;
  }
  if (row.checked_in_at == null) {
    res.status(400).json({ error: "Efectuează mai întâi check-in." });
    return;
  }
  if (row.checked_out_at != null) {
    res.json({ ok: true, alreadyDone: true });
    return;
  }
  const jobId = row.job_id != null ? Number(row.job_id) : NaN;
  if (Number.isFinite(jobId) && jobId > 0) {
    const geoResult = await validateGeoForJob(jobId, body);
    if (!geoResult.valid) {
      res.status(geoResult.statusCode).json({ error: geoResult.error });
      return;
    }
  }
  const workDate = body.workDate ? String(body.workDate).trim().slice(0, 10) : null;
  await db.query("UPDATE applications SET checked_out_at = CURRENT_TIMESTAMP WHERE id = ? AND staff_id = ?", [appId, userId]);
  
  // Also update work session entry if workDate is provided
  if (workDate && workDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [existingSession] = await db.query(
      "SELECT id, checked_in_at FROM application_work_sessions WHERE application_id = ? AND work_date = ?",
      [appId, workDate]
    ) as [Record<string, unknown>[], unknown];
    
    if (Array.isArray(existingSession) && existingSession.length > 0) {
      // Update existing session
      await db.query(
        "UPDATE application_work_sessions SET checked_out_at = CURRENT_TIMESTAMP WHERE application_id = ? AND work_date = ?",
        [appId, workDate]
      );
    } else {
      // Create new session with both check-in and check-out (fallback if session wasn't created during check-in)
      const checkedInAt = row.checked_in_at;
      await db.query(
        "INSERT INTO application_work_sessions (application_id, work_date, checked_in_at, checked_out_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
        [appId, workDate, checkedInAt]
      );
    }
  }
  
  res.json({ ok: true });
});

/** GET /api/jobs/statistics - customer/business: general statistics (employees count, job categories distribution) */
router.get("/statistics", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [rows] = await db.query(
    "SELECT Role FROM users WHERE Id = ?",
    [userId]
  ) as [unknown[], unknown];
  const roleRaw = getRoleFromRow((rows as unknown[] | undefined)?.[0]);
  const role = normalizeRole(roleRaw);
  const customerLike = role === "customer" || await isBusinessUser(String(userId));
  if (!customerLike) {
    res.status(403).json({ error: "Doar customer poate vedea statisticile." });
    return;
  }

  // Get unique employees count (staff who have accepted applications for this business's jobs)
  const [employeeRows] = await db.query(
    `SELECT COUNT(DISTINCT a.staff_id) AS total_employees
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE j.user_id = ? AND LOWER(TRIM(COALESCE(a.status,''))) = 'accepted'`,
    [userId]
  ) as [Record<string, unknown>[], unknown];
  const totalEmployees = Array.isArray(employeeRows) && employeeRows[0] && employeeRows[0].total_employees != null
    ? Number(employeeRows[0].total_employees)
    : 0;

  // Get job distribution by category
  const [categoryRows] = await db.query(
    `SELECT 
       COALESCE(jc.Code, 0) AS category_code,
       COALESCE(jc.Title, 'Fără categorie') AS category_title,
       COUNT(j.id) AS job_count
     FROM jobs j
     LEFT JOIN job_categories jc ON jc.Code = j.job_category_code
     WHERE j.user_id = ?
     GROUP BY COALESCE(jc.Code, 0), COALESCE(jc.Title, 'Fără categorie')
     ORDER BY job_count DESC`,
    [userId]
  ) as [Record<string, unknown>[], unknown];
  
  const categories = (Array.isArray(categoryRows) ? categoryRows : []).map((r) => ({
    code: r.category_code != null ? Number(r.category_code) : 0,
    title: String(r.category_title ?? "Fără categorie"),
    count: r.job_count != null ? Number(r.job_count) : 0,
  }));

  // Get job distribution by branch (match jobs to branches by location)
  // First get business profile ID
  const [bpRows] = await db.query(
    `SELECT Id FROM business_profiles WHERE UserId = ? LIMIT 1`,
    [userId]
  ) as [Record<string, unknown>[], unknown];
  const businessProfileId = Array.isArray(bpRows) && bpRows[0] && bpRows[0].Id ? String(bpRows[0].Id) : null;
  
  let branchesByJobCount: Array<{ branchId: string; branchName: string; count: number }> = [];
  if (businessProfileId) {
    const [branchStatsRows] = await db.query(
      `SELECT 
         b.Id AS branch_id,
         b.Name AS branch_name,
         COUNT(DISTINCT j.id) AS job_count
       FROM branches b
       LEFT JOIN jobs j ON j.user_id = ? 
         AND (j.location LIKE CONCAT('%', b.Address, '%') 
              OR j.location LIKE CONCAT('%', b.City, '%')
              OR b.Address LIKE CONCAT('%', j.location, '%')
              OR b.City LIKE CONCAT('%', j.location, '%'))
       WHERE b.BusinessProfileId = ? AND b.IsActive = 1
       GROUP BY b.Id, b.Name
       ORDER BY job_count DESC`,
      [userId, businessProfileId]
    ) as [Record<string, unknown>[], unknown];
    
    branchesByJobCount = (Array.isArray(branchStatsRows) ? branchStatsRows : []).map((r: Record<string, unknown>) => ({
      branchId: r.branch_id != null ? String(r.branch_id) : "",
      branchName: String(r.branch_name ?? "Fără nume"),
      count: r.job_count != null ? Number(r.job_count) : 0,
    }));
  }

  res.json({
    totalEmployees,
    categoriesByJobCount: categories,
    branchesByJobCount: branchesByJobCount,
  });
});

/** PATCH /api/jobs/applications/:id - customer: accept/refuse application */
router.patch("/applications/:id", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const appId = req.params.id;
  const status = String((req.body ?? {}).status ?? "").toLowerCase();
  if (!userId || !appId || (status !== "accepted" && status !== "refused")) {
    res.status(400).json({ error: "Status invalid (accepted sau refused)." });
    return;
  }
  const [rows] = await db.query(
    `SELECT a.id, a.job_id, a.staff_id, a.staff_email, a.staff_name, j.user_id, 
            j.Title AS job_title,
            j.location AS job_location,
            j.date AS job_date,
            j.end_date AS job_end_date,
            j.start_time AS job_start_time,
            j.end_time AS job_end_time,
            j.hourly_rate_base AS job_hourly_rate,
            jc.Title AS job_category_title
     FROM applications a 
     JOIN jobs j ON j.id = a.job_id 
     LEFT JOIN job_categories jc ON jc.Code = j.job_category_code
     WHERE a.id = ? AND j.user_id = ?`,
    [appId, userId]
  ) as [Record<string, unknown>[], unknown];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || String(row.user_id) !== userId) {
    res.status(404).json({ error: "Aplicație negăsită." });
    return;
  }
  
  await db.query("UPDATE applications SET status = ? WHERE id = ?", [status, appId]);
  let staffEmail = row.staff_email != null ? String(row.staff_email).trim() : "";
  if (!staffEmail && row.staff_id) {
    const [u] = await db.query("SELECT Email FROM users WHERE Id = ?", [row.staff_id]) as [Record<string, unknown>[], unknown];
    staffEmail = (Array.isArray(u) && u[0] && (u[0].Email ?? u[0].email) != null) ? String((u[0].Email ?? u[0].email)).trim() : "";
  }
  const staffName = String(row.staff_name ?? "").trim() || "Angajat";
  const jobTitle = String(row.job_title ?? "").trim() || "Job";
  
  if (staffEmail && status === "accepted") {
    const jobDetails = {
      title: jobTitle,
      category: String(row.job_category_title ?? "").trim() || "",
      location: String(row.job_location ?? "").trim() || "",
      date: row.job_date ? String(row.job_date).trim() : "",
      endDate: row.job_end_date ? String(row.job_end_date).trim() : "",
      startTime: row.job_start_time ? String(row.job_start_time).trim() : "",
      endTime: row.job_end_time ? String(row.job_end_time).trim() : "",
      hourlyRate: row.job_hourly_rate != null ? Number(row.job_hourly_rate) : null,
    };
    notifyStaffAccepted(staffEmail, staffName, jobDetails).catch(() => {});
  }
  if (staffEmail && status === "refused") {
    notifyStaffRefused(staffEmail, staffName, jobTitle).catch(() => {});
  }
  res.json({ ok: true });
});

// Platform financial constants (must match client utils/salary.ts)
const BUSINESS_TAX_RATE = 0.24;
const BUSINESS_MAINTENANCE_RATE = 0.1;

/** GET /api/jobs/admin/statistics - admin only: salary by domain/region, financial, company ranking */
router.get("/admin/statistics", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [roleRows] = await db.query("SELECT Role FROM users WHERE Id = ?", [userId]) as [unknown[], unknown];
  const role = normalizeRole(getRoleFromRow((roleRows as unknown[] | undefined)?.[0]));
  if (role !== "admin") {
    res.status(403).json({ error: "Doar administratorii pot accesa statisticile." });
    return;
  }

  try {
    // Totals: activi = conectați în ultimele 15 min; inactivi = restul (pagina închisă, delogare sau inactivitate > 15 min)
    const [[usersRow], [jobsRow], [appsRow]] = await Promise.all([
      db.query("SELECT COUNT(*) AS c FROM users") as Promise<[Record<string, unknown>[], unknown]>,
      db.query("SELECT COUNT(*) AS c FROM jobs") as Promise<[Record<string, unknown>[], unknown]>,
      db.query("SELECT COUNT(*) AS c FROM applications") as Promise<[Record<string, unknown>[], unknown]>,
    ]);
    const totalUsers = Number(usersRow?.[0]?.c ?? 0);

    let activeUsers = 0;
    try {
      const [activeRow] = await db.query(
        "SELECT COUNT(*) AS c FROM users WHERE COALESCE(IsActive, 1) = 1 AND LastActiveAt >= DATE_SUB(NOW(), INTERVAL 15 MINUTE) AND (Role IS NULL OR Role != 3)"
      ) as [Record<string, unknown>[], unknown];
      activeUsers = Number(activeRow?.[0]?.c ?? 0);
    } catch (_) {
      // LastActiveAt poate să lipsească la prima rulare; afișăm 0 până la migrare
    }
    const inactiveUsers = Math.max(0, totalUsers - activeUsers);
    const totalJobs = Number(jobsRow?.[0]?.c ?? 0);
    const totalApplications = Number(appsRow?.[0]?.c ?? 0);

    // Salary by domain (job category): avg/min/max hourly rate, count
    const [salaryByDomainRows] = await db.query(
      `SELECT
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
       ORDER BY avg_hourly DESC`
    ) as [Record<string, unknown>[], unknown];
    const salaryByDomain = (Array.isArray(salaryByDomainRows) ? salaryByDomainRows : []).map((r) => ({
      categoryCode: r.category_code != null ? Number(r.category_code) : 0,
      categoryTitle: String(r.category_title ?? "Fără categorie"),
      avgHourly: r.avg_hourly != null ? Number(Number(r.avg_hourly).toFixed(2)) : 0,
      minHourly: r.min_hourly != null ? Number(r.min_hourly) : 0,
      maxHourly: r.max_hourly != null ? Number(r.max_hourly) : 0,
      jobCount: r.job_count != null ? Number(r.job_count) : 0,
    }));

    // Salary by region: use raion_id if available, otherwise fallback to old logic
    const [salaryByRegionRows] = await db.query(
      `SELECT
         COALESCE(r.name, region_city, 'Alte') AS region,
         AVG(j.hourly_rate_base) AS avg_hourly,
         COUNT(*) AS job_count
       FROM jobs j
       LEFT JOIN raioane r ON r.id = j.raion_id
       LEFT JOIN (
         SELECT j2.id,
           (SELECT b.City FROM branches b
            INNER JOIN business_profiles bp ON bp.Id = b.BusinessProfileId AND bp.UserId = j2.user_id
            WHERE (j2.location LIKE CONCAT('%', b.City, '%') OR b.City LIKE CONCAT('%', j2.location, '%'))
            LIMIT 1) AS region_city
         FROM jobs j2
         WHERE j2.raion_id IS NULL
       ) AS fallback ON fallback.id = j.id
       WHERE j.hourly_rate_base IS NOT NULL
       GROUP BY COALESCE(r.name, fallback.region_city, 'Alte')
       ORDER BY avg_hourly DESC`
    ) as [Record<string, unknown>[], unknown];
    const salaryByRegion = (Array.isArray(salaryByRegionRows) ? salaryByRegionRows : []).map((r) => ({
      region: String(r.region ?? "Alte"),
      avgHourly: r.avg_hourly != null ? Number(Number(r.avg_hourly).toFixed(2)) : 0,
      jobCount: r.job_count != null ? Number(r.job_count) : 0,
    }));

    // Salary by domain AND region (avg hourly, count): use raion_id if available
    const [salaryByDomainRegionRows] = await db.query(
      `SELECT
         COALESCE(r.name, fallback.region_city, 'Alte') AS region,
         COALESCE(j.job_category_code, 0) AS category_code,
         COALESCE(jc.Title, 'Fără categorie') AS category_title,
         AVG(j.hourly_rate_base) AS avg_hourly,
         COUNT(j.id) AS job_count
       FROM jobs j
       LEFT JOIN job_categories jc ON jc.Code = j.job_category_code
       LEFT JOIN raioane r ON r.id = j.raion_id
       LEFT JOIN (
         SELECT j2.id,
           (SELECT b.City FROM branches b
            INNER JOIN business_profiles bp ON bp.Id = b.BusinessProfileId AND bp.UserId = j2.user_id
            WHERE (j2.location LIKE CONCAT('%', b.City, '%') OR b.City LIKE CONCAT('%', j2.location, '%'))
            LIMIT 1) AS region_city
         FROM jobs j2
         WHERE j2.raion_id IS NULL
       ) AS fallback ON fallback.id = j.id
       WHERE j.hourly_rate_base IS NOT NULL
       GROUP BY COALESCE(r.name, fallback.region_city, 'Alte'), j.job_category_code, jc.Title
       ORDER BY region, category_title`
    ) as [Record<string, unknown>[], unknown];
    const salaryByDomainAndRegion = (Array.isArray(salaryByDomainRegionRows) ? salaryByDomainRegionRows : []).map((r) => ({
      region: String(r.region ?? "Alte"),
      categoryCode: r.category_code != null ? Number(r.category_code) : 0,
      categoryTitle: String(r.category_title ?? "Fără categorie"),
      avgHourly: r.avg_hourly != null ? Number(Number(r.avg_hourly).toFixed(2)) : 0,
      jobCount: r.job_count != null ? Number(r.job_count) : 0,
    }));

    // Financial: total base from completed work sessions (checked in + checked out), then tax & profit
    const [financialRows] = await db.query(
      `SELECT SUM(
         (TIMESTAMPDIFF(SECOND, ws.checked_in_at, ws.checked_out_at) / 3600.0) * COALESCE(j.hourly_rate_base, 0)
       ) AS total_base
       FROM application_work_sessions ws
       INNER JOIN applications a ON a.id = ws.application_id
       INNER JOIN jobs j ON j.id = a.job_id
       WHERE ws.checked_in_at IS NOT NULL AND ws.checked_out_at IS NOT NULL`
    ) as [Record<string, unknown>[], unknown];
    const totalBase = Number(financialRows?.[0]?.total_base ?? 0) || 0;
    const taxesCollected = Number((totalBase * BUSINESS_TAX_RATE).toFixed(2));
    const profit = Number((totalBase * BUSINESS_MAINTENANCE_RATE).toFixed(2));

    // Company ranking by number of accepted applications (most active hirers)
    const [rankingRows] = await db.query(
      `SELECT
         COALESCE(bp.CompanyName, 'Necunoscut') AS company_name,
         j.user_id AS user_id,
         COUNT(a.id) AS accepted_count
       FROM applications a
       INNER JOIN jobs j ON j.id = a.job_id
       LEFT JOIN business_profiles bp ON bp.UserId = j.user_id
       WHERE LOWER(TRIM(COALESCE(a.status, ''))) = 'accepted'
       GROUP BY j.user_id, bp.CompanyName
       ORDER BY accepted_count DESC
       LIMIT 50`
    ) as [Record<string, unknown>[], unknown];
    const companyRanking = (Array.isArray(rankingRows) ? rankingRows : []).map((r, i) => ({
      rank: i + 1,
      companyName: String(r.company_name ?? "Necunoscut"),
      userId: r.user_id != null ? String(r.user_id) : "",
      acceptedCount: Number(r.accepted_count ?? 0),
    }));

    res.json({
      totalUsers,
      activeUsers,
      inactiveUsers,
      totalJobs,
      totalApplications,
      salaryByDomain,
      salaryByRegion,
      salaryByDomainAndRegion,
      financial: {
        totalBase: Number(totalBase.toFixed(2)),
        taxesCollected,
        profit,
      },
      companyRanking,
    });
  } catch (err) {
    console.error("GET /api/jobs/admin/statistics error:", err);
    res.status(500).json({ error: "Eroare la încărcarea statisticilor admin." });
  }
});

export default router;
