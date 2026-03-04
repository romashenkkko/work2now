import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import db from "../db";

export interface JwtPayload {
  userId: string; // GUID in new schema
  email: string;
}

/** Throttle: actualizăm LastActiveAt cel mult la 1 minut per user */
const lastActiveUpdates = new Map<string, number>();
const THROTTLE_MS = 60_000;

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET || "default-secret-change-me";
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    (req as Request & { user?: JwtPayload }).user = decoded;
    try {
      const [rows] = await db.query(
        "SELECT COALESCE(IsActive, 1) AS IsActive FROM users WHERE Id = ? LIMIT 1",
        [decoded.userId]
      ) as [{ IsActive: number }[], unknown];
      const active = Array.isArray(rows) && rows[0] ? Number(rows[0].IsActive) : 1;
      if (active === 0) {
        res.status(403).json({ error: "Contul dumneavoastră a fost blocat din cauza încălcării regulilor.", code: "ACCOUNT_BLOCKED" });
        return;
      }
      const now = Date.now();
      const last = lastActiveUpdates.get(decoded.userId) ?? 0;
      if (now - last >= THROTTLE_MS) {
        lastActiveUpdates.set(decoded.userId, now);
        db.query("UPDATE users SET LastActiveAt = NOW() WHERE Id = ?", [decoded.userId]).catch(() => {});
      }
    } catch (_) {
      /* Dacă tabelul nu are IsActive/LastActiveAt sau DB e indisponibil, permitem accesul */
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
