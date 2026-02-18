import { Router, Request, Response } from "express";
import db from "../db";
import { authMiddleware, JwtPayload } from "../middleware/auth";

type ReqWithUser = Request & { user?: JwtPayload };

const router = Router();

/** POST /api/ratings - customer trimite rating (1-5 stele) pentru o aplicație finalizată; o singură evaluare per aplicație */
router.post("/", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  const b = req.body ?? {};
  const applicationId = b.applicationId != null ? String(b.applicationId) : null;
  const score = b.score != null ? Number(b.score) : NaN;
  if (!userId || !applicationId || !Number.isInteger(score) || score < 1 || score > 5) {
    res.status(400).json({ error: "applicationId și score (1-5) sunt obligatorii." });
    return;
  }
  const [roleRows] = await db.query("SELECT role FROM users WHERE id = ?", [userId]) as [Record<string, unknown>[], unknown];
  const role = (Array.isArray(roleRows) ? roleRows[0] : null) as { role: string } | null;
  if (role?.role !== "customer") {
    res.status(403).json({ error: "Doar customerul poate evalua." });
    return;
  }
  const [appRows] = await db.query(
    "SELECT a.id, a.staff_id, a.completed_at, j.user_id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ?",
    [applicationId]
  ) as [Record<string, unknown>[], unknown];
  const app = Array.isArray(appRows) && appRows[0] ? appRows[0] : null;
  if (!app || String(app.user_id) !== userId) {
    res.status(404).json({ error: "Aplicație negăsită." });
    return;
  }
  if (!app.completed_at) {
    res.status(400).json({ error: "Evaluarea este disponibilă doar după finalizarea orei de lucru." });
    return;
  }
  const [existing] = await db.query("SELECT id FROM ratings WHERE application_id = ?", [applicationId]) as [Record<string, unknown>[], unknown];
  if (Array.isArray(existing) && existing.length > 0) {
    res.status(400).json({ error: "Această oră de lucru a fost deja evaluată." });
    return;
  }
  
  // Insert rating (rater_id and rated_id are already GUIDs)
  try {
    await db.query(
      "INSERT INTO ratings (application_id, rater_id, rated_id, score) VALUES (?, ?, ?, ?)",
      [applicationId, userId, String(app.staff_id), score]
    );
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Rating creation error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Eroare la crearea evaluării." });
    }
  }
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
