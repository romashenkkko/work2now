import { Router, Request, Response } from "express";
import db from "../db";
import { authMiddleware, JwtPayload } from "../middleware/auth";
import { randomUUID } from "crypto";

const router = Router();

type ReqWithUser = Request & { user?: JwtPayload };

/**
 * GET /api/branches - Get all branches for the current business user
 */
router.get("/", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // Get business profile ID for this user
    const [businessRows] = await db.query(
      `SELECT Id FROM business_profiles WHERE UserId = ?`,
      [userId]
    ) as [{ Id: string }[], unknown];

    if (!Array.isArray(businessRows) || businessRows.length === 0) {
      res.json({ branches: [] });
      return;
    }

    const businessProfileId = businessRows[0].Id;

    // Get all branches for this business profile
    const [branches] = await db.query(
      `SELECT Id, Name, Address, City, Country, PhoneNumber, IsActive, CreatedAt
       FROM branches
       WHERE BusinessProfileId = ?
       ORDER BY CreatedAt DESC`,
      [businessProfileId]
    ) as [{ Id: string; Name: string; Address: string; City: string; Country: string; PhoneNumber: string; IsActive: number; CreatedAt: Date }[], unknown];

    const branchesList = Array.isArray(branches)
      ? branches.map((b) => ({
          id: b.Id,
          name: b.Name,
          address: b.Address,
          city: b.City,
          country: b.Country,
          phoneNumber: b.PhoneNumber,
          isActive: Boolean(b.IsActive),
          createdAt: b.CreatedAt instanceof Date ? b.CreatedAt.toISOString() : String(b.CreatedAt),
        }))
      : [];

    res.json({ branches: branchesList });
  } catch (e) {
    const err = e as Error;
    console.error("GET /api/branches error:", err);
    res.status(500).json({ error: "Eroare la încărcarea filialelor." });
  }
});

/**
 * POST /api/branches - Create a new branch
 */
router.post("/", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { name, address, city, country, phoneNumber } = req.body ?? {};

  // Validation
  if (!name || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Numele filialei este obligatoriu." });
    return;
  }
  if (!address || typeof address !== "string" || !address.trim()) {
    res.status(400).json({ error: "Adresa este obligatorie." });
    return;
  }
  if (!city || typeof city !== "string" || !city.trim()) {
    res.status(400).json({ error: "Orașul este obligatoriu." });
    return;
  }
  if (!phoneNumber || typeof phoneNumber !== "string" || !phoneNumber.trim()) {
    res.status(400).json({ error: "Numărul de telefon este obligatoriu." });
    return;
  }

  try {
    // Get business profile ID for this user
    const [businessRows] = await db.query(
      `SELECT Id FROM business_profiles WHERE UserId = ?`,
      [userId]
    ) as [{ Id: string }[], unknown];

    if (!Array.isArray(businessRows) || businessRows.length === 0) {
      res.status(403).json({ error: "Nu aveți profil de business. Doar utilizatorii cu profil de business pot crea filiale." });
      return;
    }

    const businessProfileId = businessRows[0].Id;
    const branchId = randomUUID();

    await db.query(
      `INSERT INTO branches (Id, BusinessProfileId, Name, Address, City, Country, PhoneNumber, IsActive, CreatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        branchId,
        businessProfileId,
        name.trim(),
        address.trim(),
        city.trim(),
        (country && typeof country === "string" ? country.trim() : "Moldova") || "Moldova",
        phoneNumber.trim(),
      ]
    );

    res.status(201).json({
      id: branchId,
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      country: (country && typeof country === "string" ? country.trim() : "Moldova") || "Moldova",
      phoneNumber: phoneNumber.trim(),
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    const err = e as Error;
    console.error("POST /api/branches error:", err);
    res.status(500).json({ error: "Eroare la crearea filialei." });
  }
});

/**
 * PATCH /api/branches/:id - Update a branch
 */
router.patch("/:id", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const branchId = req.params.id;
  const { name, address, city, country, phoneNumber, isActive } = req.body ?? {};

  try {
    // Verify the branch belongs to this user's business profile
    const [verifyRows] = await db.query(
      `SELECT b.Id
       FROM branches b
       INNER JOIN business_profiles bp ON b.BusinessProfileId = bp.Id
       WHERE b.Id = ? AND bp.UserId = ?`,
      [branchId, userId]
    ) as [{ Id: string }[], unknown];

    if (!Array.isArray(verifyRows) || verifyRows.length === 0) {
      res.status(404).json({ error: "Filiala nu a fost găsită sau nu aveți permisiunea să o modificați." });
      return;
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: unknown[] = [];

    if (name !== undefined && typeof name === "string") {
      if (!name.trim()) {
        res.status(400).json({ error: "Numele filialei nu poate fi gol." });
        return;
      }
      updates.push("Name = ?");
      values.push(name.trim());
    }
    if (address !== undefined && typeof address === "string") {
      if (!address.trim()) {
        res.status(400).json({ error: "Adresa nu poate fi goală." });
        return;
      }
      updates.push("Address = ?");
      values.push(address.trim());
    }
    if (city !== undefined && typeof city === "string") {
      if (!city.trim()) {
        res.status(400).json({ error: "Orașul nu poate fi gol." });
        return;
      }
      updates.push("City = ?");
      values.push(city.trim());
    }
    if (country !== undefined && typeof country === "string") {
      updates.push("Country = ?");
      values.push(country.trim() || "Moldova");
    }
    if (phoneNumber !== undefined && typeof phoneNumber === "string") {
      if (!phoneNumber.trim()) {
        res.status(400).json({ error: "Numărul de telefon nu poate fi gol." });
        return;
      }
      updates.push("PhoneNumber = ?");
      values.push(phoneNumber.trim());
    }
    if (isActive !== undefined) {
      updates.push("IsActive = ?");
      values.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: "Nu ați specificat câmpuri de actualizat." });
      return;
    }

    values.push(branchId);

    await db.query(`UPDATE branches SET ${updates.join(", ")} WHERE Id = ?`, values);

    // Fetch updated branch
    const [updatedRows] = await db.query(
      `SELECT Id, Name, Address, City, Country, PhoneNumber, IsActive, CreatedAt
       FROM branches
       WHERE Id = ?`,
      [branchId]
    ) as [{ Id: string; Name: string; Address: string; City: string; Country: string; PhoneNumber: string; IsActive: number; CreatedAt: Date }[], unknown];

    const branch = Array.isArray(updatedRows) && updatedRows[0] ? updatedRows[0] : null;
    if (branch) {
      res.json({
        id: branch.Id,
        name: branch.Name,
        address: branch.Address,
        city: branch.City,
        country: branch.Country,
        phoneNumber: branch.PhoneNumber,
        isActive: Boolean(branch.IsActive),
        createdAt: branch.CreatedAt instanceof Date ? branch.CreatedAt.toISOString() : String(branch.CreatedAt),
      });
    } else {
      res.json({ message: "Filiala a fost actualizată." });
    }
  } catch (e) {
    const err = e as Error;
    console.error("PATCH /api/branches/:id error:", err);
    res.status(500).json({ error: "Eroare la actualizarea filialei." });
  }
});

/**
 * DELETE /api/branches/:id - Delete a branch
 */
router.delete("/:id", authMiddleware, async (req: ReqWithUser, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const branchId = req.params.id;

  try {
    // Verify the branch belongs to this user's business profile
    const [verifyRows] = await db.query(
      `SELECT b.Id
       FROM branches b
       INNER JOIN business_profiles bp ON b.BusinessProfileId = bp.Id
       WHERE b.Id = ? AND bp.UserId = ?`,
      [branchId, userId]
    ) as [{ Id: string }[], unknown];

    if (!Array.isArray(verifyRows) || verifyRows.length === 0) {
      res.status(404).json({ error: "Filiala nu a fost găsită sau nu aveți permisiunea să o ștergeți." });
      return;
    }

    await db.query(`DELETE FROM branches WHERE Id = ?`, [branchId]);

    res.json({ ok: true, message: "Filiala a fost ștearsă cu succes." });
  } catch (e) {
    const err = e as Error;
    console.error("DELETE /api/branches/:id error:", err);
    res.status(500).json({ error: "Eroare la ștergerea filialei." });
  }
});

export default router;

