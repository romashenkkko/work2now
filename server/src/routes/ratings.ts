import { Router, Request, Response } from "express";
import db from "../db";
import { authMiddleware, JwtPayload } from "../middleware/auth";

type ReqWithUser = Request & { user?: JwtPayload };

const router = Router();

/** POST /api/ratings - customer sau staff trimite review (1-5 stele) pentru o aplicație finalizată */
router.post("/", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const b = req.body ?? {};
  const applicationId = b.applicationId != null ? String(b.applicationId) : null;
  let score = b.score != null ? Number(b.score) : NaN;
  const comment = typeof b.comment === "string" ? b.comment.trim().slice(0, 2000) : null;
  const photoUrl = typeof b.photoUrl === "string" && b.photoUrl.trim() ? b.photoUrl.trim().slice(0, 2000) : null;
  if (!userId || !applicationId || applicationId.trim() === "") {
    res.status(400).json({ error: "applicationId este obligatoriu." });
    return;
  }
  if (!Number.isFinite(score) || score < 0.5 || score > 5) {
    res.status(400).json({ error: "Score trebuie să fie între 0.5 și 5 (stele sau jumătate de stea)." });
    return;
  }
  score = Math.round(score * 2) / 2;
  const [roleRows] = await db.query(
    `SELECT CASE
       WHEN u.Role = 3 THEN 'admin'
       WHEN bp.UserId IS NOT NULL THEN 'customer'
       WHEN ep.UserId IS NOT NULL THEN 'staff'
       WHEN u.Role = 2 THEN 'customer'
       ELSE 'staff'
     END AS resolved_role
     FROM users u
     LEFT JOIN employee_profiles ep ON u.Id = ep.UserId
     LEFT JOIN business_profiles bp ON u.Id = bp.UserId
     WHERE u.Id = ?`,
    [userId]
  ) as [Record<string, unknown>[], unknown];
  const roleRow = Array.isArray(roleRows) ? roleRows[0] : null;
  const role = roleRow && typeof roleRow === "object" && roleRow !== null ? String((roleRow as { resolved_role?: unknown }).resolved_role ?? "").toLowerCase() : "";
  if (role !== "customer" && role !== "staff") {
    res.status(403).json({ error: "Doar customer sau staff poate lăsa un review." });
    return;
  }
  const [appRows] = await db.query(
    "SELECT a.id, a.staff_id, a.completed_at, j.user_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?",
    [applicationId]
  ) as [Record<string, unknown>[], unknown];
  const app = Array.isArray(appRows) && appRows[0] ? appRows[0] : null;
  if (!app || !app.completed_at) {
    res.status(404).json({ error: "Aplicație negăsită sau lucrul nu e finalizat." });
    return;
  }
  const userIdStr = String(userId).trim();
  const customerIdRaw = app.user_id;
  const staffIdRaw = app.staff_id;
  const customerIdStr = customerIdRaw != null ? String(customerIdRaw).trim() : "";
  const staffIdStr = staffIdRaw != null ? String(staffIdRaw).trim() : "";
  const currentUserMatchesCustomer = customerIdStr === userIdStr || (Number(customerIdStr) === Number(userIdStr) && Number.isFinite(Number(customerIdStr)));
  const currentUserMatchesStaff = staffIdStr === userIdStr || (Number(staffIdStr) === Number(userIdStr) && Number.isFinite(Number(staffIdStr)));
  let raterId: string;
  let ratedId: number | string;
  if (role === "customer") {
    if (!customerIdStr || !currentUserMatchesCustomer) {
      res.status(403).json({ error: "Poți evalua doar aplicațiile la joburile tale." });
      return;
    }
    raterId = userIdStr;
    ratedId = staffIdRaw != null ? (Number.isFinite(Number(staffIdRaw)) ? Number(staffIdRaw) : staffIdStr) : 0;
  } else {
    if (!staffIdStr || !currentUserMatchesStaff) {
      res.status(403).json({ error: "Poți evalua doar joburile la care ai lucrat." });
      return;
    }
    raterId = userIdStr;
    ratedId = customerIdRaw != null ? (Number.isFinite(Number(customerIdRaw)) ? Number(customerIdRaw) : customerIdStr) : 0;
  }
  const [existing] = await db.query(
    "SELECT id FROM ratings WHERE application_id = ? AND rater_id = ?",
    [applicationId, raterId]
  ) as [Record<string, unknown>[], unknown];
  if (Array.isArray(existing) && existing.length > 0) {
    res.status(400).json({ error: "Ai evaluat deja această oră de lucru." });
    return;
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const raterIdForDb = String(raterId);
    const ratedIdForDb = String(ratedId);
    await conn.query(
      "INSERT INTO ratings (application_id, rater_id, rated_id, score, comment, photo_url) VALUES (?, ?, ?, ?, ?, ?)",
      [applicationId, raterIdForDb, ratedIdForDb, score, comment || null, photoUrl || null]
    );
    await conn.commit();
    res.status(201).json({ ok: true });
  } catch (error) {
    await conn.rollback();
    console.error("Rating creation error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Eroare la crearea evaluării." });
    }
  } finally {
    conn.release();
  }
});

/** GET /api/ratings/me - recenziile date și primite (customer + staff) */
router.get("/me", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [roleRows] = await db.query(
    `SELECT CASE
       WHEN u.Role = 3 THEN 'admin'
       WHEN bp.UserId IS NOT NULL THEN 'customer'
       WHEN ep.UserId IS NOT NULL THEN 'staff'
       WHEN u.Role = 2 THEN 'customer'
       ELSE 'staff'
     END AS resolved_role
     FROM users u
     LEFT JOIN employee_profiles ep ON u.Id = ep.UserId
     LEFT JOIN business_profiles bp ON u.Id = bp.UserId
     WHERE u.Id = ?`,
    [userId]
  ) as [Record<string, unknown>[], unknown];
  const role = (Array.isArray(roleRows) && roleRows[0] && typeof roleRows[0] === "object" && roleRows[0] !== null)
    ? String((roleRows[0] as { resolved_role?: unknown }).resolved_role ?? "").toLowerCase()
    : "";
  if (role !== "customer" && role !== "staff") {
    res.json({ given: [], received: [] });
    return;
  }
  const toIso = (v: unknown): string | undefined => {
    if (v == null) return undefined;
    if (v instanceof Date) return v.toISOString();
    const s = String(v);
    return s.trim() || undefined;
  };
  const mapRow = (row: Record<string, unknown>) => ({
    id: String(row.id),
    applicationId: String(row.application_id),
    jobTitle: row.job_title != null ? String(row.job_title) : undefined,
    otherPartyName: row.other_name != null ? String(row.other_name) : undefined,
    score: Number(row.score) || 0,
    comment: typeof row.comment === "string" && row.comment.trim() ? row.comment.trim() : undefined,
    photoUrl: typeof row.photo_url === "string" && row.photo_url.trim() ? row.photo_url.trim() : undefined,
    createdAt: toIso(row.created_at),
  });
  const [givenRows] = await db.query(
    `SELECT r.id, r.application_id, r.score, r.comment, r.photo_url, r.created_at,
            j.job AS job_title,
            COALESCE(bp.CompanyName, TRIM(CONCAT(ep.Name, ' ', ep.Surname)), a.staff_name, u.Email) AS other_name
     FROM ratings r
     JOIN applications a ON a.id = r.application_id
     JOIN jobs j ON j.id = a.job_id
     LEFT JOIN users u ON u.Id = r.rated_id
     LEFT JOIN business_profiles bp ON bp.UserId = u.Id
     LEFT JOIN employee_profiles ep ON ep.UserId = u.Id
     WHERE r.rater_id = ?
     ORDER BY r.created_at DESC`,
    [userId]
  ) as [Record<string, unknown>[], unknown];
  const [receivedRows] = await db.query(
    `SELECT r.id, r.application_id, r.score, r.comment, r.photo_url, r.created_at,
            j.job AS job_title,
            COALESCE(bp.CompanyName, TRIM(CONCAT(ep.Name, ' ', ep.Surname)), a.staff_name, u.Email) AS other_name
     FROM ratings r
     JOIN applications a ON a.id = r.application_id
     JOIN jobs j ON j.id = a.job_id
     LEFT JOIN users u ON u.Id = r.rater_id
     LEFT JOIN business_profiles bp ON bp.UserId = u.Id
     LEFT JOIN employee_profiles ep ON ep.UserId = u.Id
     WHERE r.rated_id = ?
     ORDER BY r.created_at DESC`,
    [userId]
  ) as [Record<string, unknown>[], unknown];
  const given = (Array.isArray(givenRows) ? givenRows : []).map(mapRow);
  const received = (Array.isArray(receivedRows) ? receivedRows : []).map(mapRow);
  res.json({ given, received });
});

/** GET /api/ratings/user/:userId - scor mediu și număr evaluări pentru un user (rated) */
router.get("/user/:userId", async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.params.userId;
  if (!userId) {
    res.status(400).json({ error: "userId lipsă." });
    return;
  }
  const [rows] = await db.query(
    "SELECT COUNT(*) AS count, COALESCE(AVG(score), 0) AS average FROM ratings WHERE rated_id = ?",
    [userId]
  ) as [Record<string, unknown>[], unknown];
  const r = Array.isArray(rows) ? rows[0] : null;
  const count = r ? Number(r.count) || 0 : 0;
  const average = r ? Number(Number(r.average).toFixed(2)) : 0;
  res.json({ average, count });
});

export default router;
