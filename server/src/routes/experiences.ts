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

/**
 * GET /api/experiences - Get all experiences for current employee
 */
router.get("/", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
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
      res.json({ experiences: [] });
      return;
    }

    const employeeProfileId = employeeRows[0].Id;

    // Get all experiences
    const [experiences] = await db.query(
      `SELECT Id, JobCategory, Duration, Description
       FROM experiences
       WHERE EmployeeProfileId = ?
       ORDER BY JobCategory, Duration`,
      [employeeProfileId]
    ) as [{ Id: string; JobCategory: number; Duration: number; Description: string }[], unknown];

    // Map database fields (PascalCase) to frontend format (camelCase)
    const mappedExperiences = Array.isArray(experiences)
      ? experiences.map((exp) => ({
          id: exp.Id,
          jobCategory: exp.JobCategory,
          duration: exp.Duration,
          description: exp.Description || "",
        }))
      : [];

    res.json({ experiences: mappedExperiences });
  } catch (e) {
    const err = e as Error;
    console.error("GET /api/experiences error:", err);
    res.status(500).json({ error: "Eroare la încărcarea experiențelor." });
  }
});

/**
 * POST /api/experiences - Add a new experience
 */
router.post("/", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { jobCategory, duration, description } = req.body ?? {};

  // Validation
  if (typeof jobCategory !== "number" || !Object.values(JobCategory).includes(jobCategory)) {
    res.status(400).json({ error: "Categoria de job invalidă." });
    return;
  }
  if (typeof duration !== "number" || !Object.values(ExperienceDuration).includes(duration)) {
    res.status(400).json({ error: "Durata experienței invalidă." });
    return;
  }

  try {
    // Get employee profile ID for this user
    const [employeeRows] = await db.query(
      `SELECT Id FROM employee_profiles WHERE UserId = ?`,
      [userId]
    ) as [{ Id: string }[], unknown];

    if (!Array.isArray(employeeRows) || employeeRows.length === 0) {
      res.status(403).json({ error: "Nu aveți profil de angajat." });
      return;
    }

    const employeeProfileId = employeeRows[0].Id;

    // Check if experience already exists for this category
    const [existing] = await db.query(
      `SELECT Id FROM experiences WHERE EmployeeProfileId = ? AND JobCategory = ?`,
      [employeeProfileId, jobCategory]
    ) as [{ Id: string }[], unknown];

    if (Array.isArray(existing) && existing.length > 0) {
      res.status(400).json({ error: "Aveți deja experiență pentru această categorie. Actualizați experiența existentă." });
      return;
    }

    // Insert new experience
    const experienceId = randomUUID();
    await db.query(
      `INSERT INTO experiences (Id, EmployeeProfileId, JobCategory, Duration, Description)
       VALUES (?, ?, ?, ?, ?)`,
      [
        experienceId,
        employeeProfileId,
        jobCategory,
        duration,
        String(description || "").trim() || "",
      ]
    );

    res.json({ 
      id: experienceId,
      jobCategory,
      duration,
      description: String(description || "").trim() || "",
    });
  } catch (e) {
    const err = e as Error;
    console.error("POST /api/experiences error:", err);
    res.status(500).json({ error: "Eroare la adăugarea experienței." });
  }
});

/**
 * PATCH /api/experiences/:id - Update an experience
 */
router.patch("/:id", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { id } = req.params;
  const { duration, description } = req.body ?? {};

  // Validation
  if (duration !== undefined) {
    if (typeof duration !== "number" || !Object.values(ExperienceDuration).includes(duration)) {
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
      res.status(403).json({ error: "Nu aveți profil de angajat." });
      return;
    }

    const employeeProfileId = employeeRows[0].Id;

    // Check if experience belongs to this employee
    const [experience] = await db.query(
      `SELECT Id FROM experiences WHERE Id = ? AND EmployeeProfileId = ?`,
      [id, employeeProfileId]
    ) as [{ Id: string }[], unknown];

    if (!Array.isArray(experience) || experience.length === 0) {
      res.status(404).json({ error: "Experiența nu a fost găsită." });
      return;
    }

    // Update experience
    const updates: string[] = [];
    const values: any[] = [];

    if (duration !== undefined) {
      updates.push("Duration = ?");
      values.push(duration);
    }

    if (description !== undefined) {
      updates.push("Description = ?");
      values.push(String(description).trim());
    }

    if (updates.length === 0) {
      res.status(400).json({ error: "Nu s-a specificat niciun câmp de actualizat." });
      return;
    }

    values.push(id);
    await db.query(
      `UPDATE experiences SET ${updates.join(", ")} WHERE Id = ?`,
      values
    );

    res.json({ ok: true, message: "Experiența a fost actualizată cu succes." });
  } catch (e) {
    const err = e as Error;
    console.error("PATCH /api/experiences/:id error:", err);
    res.status(500).json({ error: "Eroare la actualizarea experienței." });
  }
});

/**
 * DELETE /api/experiences/:id - Delete an experience
 */
router.delete("/:id", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { id } = req.params;

  try {
    // Get employee profile ID for this user
    const [employeeRows] = await db.query(
      `SELECT Id FROM employee_profiles WHERE UserId = ?`,
      [userId]
    ) as [{ Id: string }[], unknown];

    if (!Array.isArray(employeeRows) || employeeRows.length === 0) {
      res.status(403).json({ error: "Nu aveți profil de angajat." });
      return;
    }

    const employeeProfileId = employeeRows[0].Id;

    // Check if experience belongs to this employee
    const [experience] = await db.query(
      `SELECT Id FROM experiences WHERE Id = ? AND EmployeeProfileId = ?`,
      [id, employeeProfileId]
    ) as [{ Id: string }[], unknown];

    if (!Array.isArray(experience) || experience.length === 0) {
      res.status(404).json({ error: "Experiența nu a fost găsită." });
      return;
    }

    // Delete experience
    await db.query(`DELETE FROM experiences WHERE Id = ?`, [id]);

    res.json({ ok: true, message: "Experiența a fost ștearsă cu succes." });
  } catch (e) {
    const err = e as Error;
    console.error("DELETE /api/experiences/:id error:", err);
    res.status(500).json({ error: "Eroare la ștergerea experienței." });
  }
});

export default router;

