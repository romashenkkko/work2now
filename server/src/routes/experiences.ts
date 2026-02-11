import { Router, Request, Response } from "express";
import db from "../db";
import { authMiddleware, JwtPayload } from "../middleware/auth";
import { randomUUID } from "crypto";
import { JobCategory, ExperienceDuration } from "../enums";

const router = Router();

type ReqWithUser = Request & { user?: JwtPayload };

/**
 * GET /api/experiences/check-onboarding - Check if employee needs onboarding
 */
router.get("/check-onboarding", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // Get employee profile ID for this user
    const [employeeRows] = await db.query(
      `SELECT Id FROM employee_profiles WHERE UserId = ?`,
      [userId]
    ) as [{ Id: string }[], unknown];

    if (!Array.isArray(employeeRows) || employeeRows.length === 0) {
      // Not an employee, no onboarding needed
      res.json({ needsOnboarding: false });
      return;
    }

    const employeeProfileId = employeeRows[0].Id;

    // Check if employee has any experiences
    const [experiences] = await db.query(
      `SELECT Id FROM experiences WHERE EmployeeProfileId = ? LIMIT 1`,
      [employeeProfileId]
    ) as [{ Id: string }[], unknown];

    const hasExperiences = Array.isArray(experiences) && experiences.length > 0;
    res.json({ needsOnboarding: !hasExperiences });
  } catch (e) {
    const err = e as Error;
    console.error("GET /api/experiences/check-onboarding error:", err);
    res.status(500).json({ error: "Eroare la verificarea onboarding-ului." });
  }
});

/**
 * POST /api/experiences/onboarding - Save experiences from onboarding
 */
router.post("/onboarding", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { experiences } = req.body ?? {};

  // Validation
  if (!Array.isArray(experiences) || experiences.length === 0) {
    res.status(400).json({ error: "Trebuie să selectați cel puțin o categorie de job." });
    return;
  }

  // Validate each experience
  for (const exp of experiences) {
    if (typeof exp.jobCategory !== "number" || !Object.values(JobCategory).includes(exp.jobCategory)) {
      res.status(400).json({ error: "Categoria de job invalidă." });
      return;
    }
    if (typeof exp.duration !== "number" || !Object.values(ExperienceDuration).includes(exp.duration)) {
      res.status(400).json({ error: "Durata experienței invalidă." });
      return;
    }
  }

  try {
    // Get employee profile ID for this user
    const [employeeRows] = await db.query(
      `SELECT Id FROM employee_profiles WHERE UserId = ?`,
      [userId]
    ) as [{ Id: string }[], unknown];

    if (!Array.isArray(employeeRows) || employeeRows.length === 0) {
      res.status(403).json({ error: "Nu aveți profil de angajat. Doar angajații pot completa onboarding-ul." });
      return;
    }

    const employeeProfileId = employeeRows[0].Id;

    // Insert experiences in a transaction
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      for (const exp of experiences) {
        const experienceId = randomUUID();
        await conn.query(
          `INSERT INTO experiences (Id, EmployeeProfileId, JobCategory, Duration, Description)
           VALUES (?, ?, ?, ?, ?)`,
          [
            experienceId,
            employeeProfileId,
            exp.jobCategory,
            exp.duration,
            "Added during onboarding",
          ]
        );
      }

      await conn.commit();
      res.json({ ok: true, message: "Experiențele au fost salvate cu succes." });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    const err = e as Error;
    console.error("POST /api/experiences/onboarding error:", err);
    res.status(500).json({ error: "Eroare la salvarea experiențelor." });
  }
});

export default router;

