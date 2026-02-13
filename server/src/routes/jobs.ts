import { Router, Request, Response } from "express";
import db, { getUserUuidFromLegacyId } from "../db";
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
  const checkInLat = r.check_in_lat != null ? Number(r.check_in_lat) : undefined;
  const checkInLng = r.check_in_lng != null ? Number(r.check_in_lng) : undefined;
  const checkInRadiusM = r.check_in_radius_m != null ? Number(r.check_in_radius_m) : undefined;
  return {
    id: String(r.id),
    job: r.job,
    location: r.location,
    status: r.status,
    statusClass: r.status_class,
    date: r.date,
    endDate: r.end_date ?? undefined,
    jobType: r.job_type ?? undefined,
    applicationsCount: r.applications_count ?? 0,
    startTime: r.start_time ?? undefined,
    endTime: r.end_time ?? undefined,
    peopleNeeded: r.people_needed ?? undefined,
    duration: r.duration ?? undefined,
    estimatedSalary: r.estimated_salary ?? undefined,
    imageUrl: r.image_url ?? undefined,
    postedBy: name,
    ...(Number.isFinite(checkInLat) && Number.isFinite(checkInLng) && Number.isFinite(checkInRadiusM) && checkInRadiusM! > 0
      ? { checkInLat, checkInLng, checkInRadiusM }
      : {}),
  };
}

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
              COALESCE(
                bp.CompanyName,
                TRIM(CONCAT(ep.Name, ' ', ep.Surname)),
                u.Email
              ) AS posted_by_name
         FROM jobs j
         LEFT JOIN users u ON u.Id = j.user_id
         LEFT JOIN business_profiles bp ON bp.UserId = u.Id
         LEFT JOIN employee_profiles ep ON ep.UserId = u.Id
         WHERE j.user_id = ?
         ORDER BY j.created_at DESC`,
      [userId]
    ) as [Record<string, unknown>[], unknown];
    list = Array.isArray(r) ? r : [];
  } else {
    const [r] = await db.query(
      `SELECT j.*,
              COALESCE(
                bp.CompanyName,
                TRIM(CONCAT(ep.Name, ' ', ep.Surname)),
                u.Email
              ) AS posted_by_name
         FROM jobs j
         LEFT JOIN users u ON u.Id = j.user_id
         LEFT JOIN business_profiles bp ON bp.UserId = u.Id
         LEFT JOIN employee_profiles ep ON ep.UserId = u.Id
         ORDER BY j.created_at DESC`
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
  const job = String(b.job ?? "").trim();
  const location = String(b.location ?? "").trim();
  const status = String(b.status ?? "Draft");
  const statusClass = String(b.statusClass ?? "bg-gray-100 text-gray-700");
  const date = String(b.date ?? "");
  const imageUrl = typeof b.imageUrl === "string" && b.imageUrl.trim() ? b.imageUrl.trim() : null;
  const checkInLat = b.checkInLat != null ? Number(b.checkInLat) : null;
  const checkInLng = b.checkInLng != null ? Number(b.checkInLng) : null;
  const checkInRadiusM =
    b.checkInRadiusM != null
      ? Math.max(1, Math.min(500, Number(b.checkInRadiusM)))
      : (checkInLat != null && checkInLng != null ? DEFAULT_GEO_RADIUS_M : null);
  if (!job || !location) {
    res.status(400).json({ error: "job și location sunt obligatorii." });
    return;
  }
  
  // MIGRATION FIX: Use transaction to ensure atomicity and populate UUID/enum columns
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    
    // MIGRATION FIX: Get UUID for user_id
    const userUuid = await getUserUuidFromLegacyId(userId);
    if (!userUuid) {
      console.warn(`[MIGRATION FIX] No UUID mapping found for user ${userId}, job will have NULL user_id_uuid`);
    }
    
    // MIGRATION FIX: Map status string to enum code
    const vacancyStatusCode = stringToVacancyStatus(status);
    
    // Insert job (check_in_* columns added by migration)
    const [result] = await conn.query(
      `INSERT INTO jobs (user_id, job, location, status, status_class, date, end_date, job_type, applications_count, start_time, end_time, people_needed, duration, estimated_salary, image_url, check_in_lat, check_in_lng, check_in_radius_m)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        job,
        location,
        status,
        statusClass,
        date,
        b.endDate ?? null,
        b.jobType ?? null,
        b.startTime ?? null,
        b.endTime ?? null,
        b.peopleNeeded ?? null,
        b.duration ?? null,
        b.estimatedSalary ?? null,
        imageUrl,
        Number.isFinite(checkInLat) ? checkInLat : null,
        Number.isFinite(checkInLng) ? checkInLng : null,
        checkInRadiusM,
      ]
    ) as [{ insertId: number }, unknown];
    const id = result.insertId;
    
    // MIGRATION FIX: Update UUID and enum columns
    if (userUuid) {
      await optionalQuery(conn, "UPDATE jobs SET user_id_uuid = ? WHERE id = ?", [userUuid, id]);
    }
    await optionalQuery(conn, "UPDATE jobs SET vacancy_status_code = ? WHERE id = ?", [vacancyStatusCode, id]);
    
    await conn.commit();
    
    // Fetch created job for response
    const [r] = await conn.query(
      `SELECT j.*,
              COALESCE(
                bp.CompanyName,
                TRIM(CONCAT(ep.Name, ' ', ep.Surname)),
                u.Email
              ) AS posted_by_name
         FROM jobs j
         LEFT JOIN users u ON u.Id = j.user_id
         LEFT JOIN business_profiles bp ON bp.UserId = u.Id
         LEFT JOIN employee_profiles ep ON ep.UserId = u.Id
         WHERE j.id = ?`,
      [id]
    ) as [Record<string, unknown>[], unknown];
    const created = Array.isArray(r) && r[0] ? rowToJob(r[0]) : { id: String(id), job, location, status, statusClass, date };
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
  if (String(row.user_id ?? "") !== String(userId)) {
    res.status(403).json({ error: "Nu poți șterge acest job." });
    return;
  }
  await db.query("DELETE FROM applications WHERE job_id = ?", [jobId]);
  await db.query("DELETE FROM jobs WHERE id = ?", [jobId]);
  res.json({ ok: true });
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
  const [jobRows] = await db.query("SELECT id, job, user_id FROM jobs WHERE id = ?", [jobId]) as [Record<string, unknown>[], unknown];
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
    
    // MIGRATION FIX: Get UUID for staff_id
    const staffUuid = await getUserUuidFromLegacyId(userId);
    if (!staffUuid) {
      console.warn(`[MIGRATION FIX] No UUID mapping found for user ${userId}, application will have NULL staff_id_uuid`);
    }
    
    // MIGRATION FIX: Set status_code enum
    const statusCode = ApplicationStatus.Pending;
    
    // Insert application
    const [insertResult] = await conn.query(
      "INSERT INTO applications (job_id, staff_id, staff_name, staff_email, status) VALUES (?, ?, ?, ?, 'pending')",
      [jobId, userId, String(userRow.staff_name ?? "").trim(), (userRow.staff_email as string | undefined) ?? null]
    ) as [{ insertId: number }, unknown];
    const appId = insertResult.insertId;
    
    // MIGRATION FIX: Update UUID and enum columns
    if (staffUuid) {
      await optionalQuery(conn, "UPDATE applications SET staff_id_uuid = ? WHERE id = ?", [staffUuid, appId]);
    }
    await optionalQuery(conn, "UPDATE applications SET status_code = ? WHERE id = ?", [statusCode, appId]);
    
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
      const jobTitle = String(jobRow.job ?? "").trim() || "Job";
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
  const [jobRows] = await db.query("SELECT id FROM jobs WHERE user_id = ?", [userId]) as [Record<string, unknown>[], unknown];
  const jobIds = (Array.isArray(jobRows) ? jobRows : []).map((r) => r.id);
  if (jobIds.length === 0) {
    res.json({ applications: {} });
    return;
  }
  const placeholders = jobIds.map(() => "?").join(",");
  const [appRows] = await db.query(
    `SELECT a.id, a.job_id, a.staff_id, a.staff_name, a.staff_email, a.status, a.completed_at, a.checked_in_at, a.checked_out_at, a.created_at,
     r.score AS rating_score
     FROM applications a
     LEFT JOIN ratings r ON r.application_id = a.id
     WHERE a.job_id IN (${placeholders}) ORDER BY a.created_at DESC`,
    jobIds
  ) as [Record<string, unknown>[], unknown];
  const list = Array.isArray(appRows) ? appRows : [];
  const staffIds = [...new Set(list.map((a) => Number(a.staff_id)).filter(Boolean))];
  const avatarByStaffId: Record<number, string> = {};
  if (staffIds.length > 0) {
    const ph = staffIds.map(() => "?").join(",");
    const [userRows] = await db.query(
      `SELECT Id AS id, NULL AS avatar FROM users WHERE Id IN (${ph})`,
      staffIds
    ) as [Record<string, unknown>[], unknown];
    (Array.isArray(userRows) ? userRows : []).forEach((u) => {
      const id = Number(u.id);
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
    const jid = String(a.job_id);
    const aid = String(a.id);
    if (!byJob[jid]) byJob[jid] = [];
    const sid = Number(a.staff_id);
    const staffAvatar = sid ? avatarByStaffId[sid] : undefined;
    byJob[jid].push({
      id: aid,
      jobId: jid,
      staffId: String(a.staff_id),
      staffName: a.staff_name,
      staffEmail: a.staff_email ?? undefined,
      staffAvatar,
      status: a.status,
      completedAt: a.completed_at ?? undefined,
      checkedInAt: toIso(a.checked_in_at),
      checkedOutAt: toIso(a.checked_out_at),
      workSessions: sessionsByAppId[aid] ?? [],
      ratingScore: a.rating_score != null ? Number(a.rating_score) : undefined,
    });
  });
  res.json({ applications: byJob });
});

/** PATCH /api/jobs/applications/:id/check-in - staff: înregistrează începutul lucrului (per zi, workDate în body; opțional lat, lng pentru geo-fencing) */
router.patch("/applications/:id/check-in", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const appIdRaw = req.params.id;
  const appId = appIdRaw ? Number(appIdRaw) : NaN;
  if (!userId || !appIdRaw || Number.isNaN(appId) || appId < 1) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = req.body ?? {};
  let workDate = typeof body.workDate === "string" ? body.workDate.trim().slice(0, 10) : "";
  if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    const now = new Date();
    workDate = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  }
  const [rows] = await db.query(
    "SELECT a.id, a.staff_id, a.status, a.job_id FROM applications a WHERE a.id = ? AND a.staff_id = ?",
    [appId, userId]
  ) as [Record<string, unknown>[], unknown];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    res.status(404).json({ error: "Aplicație negăsită." });
    return;
  }
  if (String(row.status) !== "accepted") {
    res.status(400).json({ error: "Doar aplicațiile acceptate pot fi check-in." });
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
  const [existing] = await db.query(
    "SELECT id, checked_in_at FROM application_work_sessions WHERE application_id = ? AND work_date = ?",
    [appId, workDate]
  ) as [Record<string, unknown>[], unknown];
  const ex = Array.isArray(existing) ? existing[0] : null;
  if (ex && ex.checked_in_at != null) {
    res.json({ ok: true, alreadyDone: true });
    return;
  }
  if (ex) {
    await db.query("UPDATE application_work_sessions SET checked_in_at = CURRENT_TIMESTAMP WHERE application_id = ? AND work_date = ?", [appId, workDate]);
  } else {
    await db.query(
      "INSERT INTO application_work_sessions (application_id, work_date, checked_in_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
      [appId, workDate]
    );
  }
  res.json({ ok: true });
});

/** PATCH /api/jobs/applications/:id/check-out - staff: înregistrează sfârșitul lucrului (per zi, workDate în body; opțional lat, lng pentru geo) */
router.patch("/applications/:id/check-out", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const appIdRaw = req.params.id;
  const appId = appIdRaw ? Number(appIdRaw) : NaN;
  if (!userId || !appIdRaw || Number.isNaN(appId) || appId < 1) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = req.body ?? {};
  let workDate = typeof body.workDate === "string" ? body.workDate.trim().slice(0, 10) : "";
  if (!workDate || !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    const now = new Date();
    workDate = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  }
  const [rows] = await db.query(
    "SELECT id, staff_id, status, job_id FROM applications WHERE id = ? AND staff_id = ?",
    [appId, userId]
  ) as [Record<string, unknown>[], unknown];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    res.status(404).json({ error: "Aplicație negăsită." });
    return;
  }
  if (String(row.status) !== "accepted") {
    res.status(400).json({ error: "Doar aplicațiile acceptate pot fi check-out." });
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
  const [existing] = await db.query(
    "SELECT id, checked_in_at, checked_out_at FROM application_work_sessions WHERE application_id = ? AND work_date = ?",
    [appId, workDate]
  ) as [Record<string, unknown>[], unknown];
  const ex = Array.isArray(existing) ? existing[0] : null;
  if (!ex) {
    res.status(400).json({ error: "Efectuează mai întâi check-in pentru această zi." });
    return;
  }
  if (ex.checked_in_at == null) {
    res.status(400).json({ error: "Efectuează mai întâi check-in pentru această zi." });
    return;
  }
  if (ex.checked_out_at != null) {
    res.json({ ok: true, alreadyDone: true });
    return;
  }
  await db.query("UPDATE application_work_sessions SET checked_out_at = CURRENT_TIMESTAMP WHERE application_id = ? AND work_date = ?", [appId, workDate]);
  res.json({ ok: true });
});

/** PATCH /api/jobs/applications/:id/complete - customer: marchează aplicația ca finalizată (ora de lucru încheiată) */
router.patch("/applications/:id/complete", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
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
  if (!row) {
    res.status(404).json({ error: "Aplicație negăsită." });
    return;
  }
  if (String(row.status) !== "accepted") {
    res.status(400).json({ error: "Doar aplicațiile acceptate pot fi marcate ca finalizate." });
    return;
  }
  await db.query("UPDATE applications SET completed_at = CURRENT_TIMESTAMP WHERE id = ?", [appId]);
  res.json({ ok: true });
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
    "SELECT a.id, a.job_id, a.staff_id, a.staff_email, a.staff_name, j.user_id, j.job AS job_title FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ? AND j.user_id = ?",
    [appId, userId]
  ) as [Record<string, unknown>[], unknown];
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    res.status(404).json({ error: "Aplicație negăsită." });
    return;
  }
  
  // MIGRATION FIX: Update both status string and status_code enum atomically
  const statusCode = stringToApplicationStatus(status);
  await db.query("UPDATE applications SET status = ?, status_code = ? WHERE id = ?", [status, statusCode, appId]);
  let staffEmail = row.staff_email != null ? String(row.staff_email).trim() : "";
  if (!staffEmail && row.staff_id) {
    const [u] = await db.query("SELECT Email FROM users WHERE Id = ?", [row.staff_id]) as [Record<string, unknown>[], unknown];
    staffEmail = (Array.isArray(u) && u[0] && (u[0].Email ?? u[0].email) != null) ? String((u[0].Email ?? u[0].email)).trim() : "";
  }
  const staffName = String(row.staff_name ?? "").trim() || "Angajat";
  const jobTitle = String(row.job_title ?? "").trim() || "Job";
  if (staffEmail) {
    if (status === "accepted") notifyStaffAccepted(staffEmail, staffName, jobTitle).catch(() => {});
    if (status === "refused") notifyStaffRefused(staffEmail, staffName, jobTitle).catch(() => {});
  }
  res.json({ ok: true });
});

export default router;
