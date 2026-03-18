import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient";

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
      const dbUser = await prisma.users.findUnique({
        where: { Id: decoded.userId },
        select: { IsActive: true, LastActiveAt: true },
      });
      const isActive = dbUser?.IsActive ?? true;
      if (!isActive) {
        res.status(403).json({ error: "Contul dumneavoastră a fost blocat din cauza încălcării regulilor.", code: "ACCOUNT_BLOCKED" });
        return;
      }
      const now = Date.now();
      const last = lastActiveUpdates.get(decoded.userId) ?? 0;
      if (now - last >= THROTTLE_MS) {
        lastActiveUpdates.set(decoded.userId, now);
        prisma.users
          .update({
            where: { Id: decoded.userId },
            data: { LastActiveAt: new Date() },
          })
          .catch(() => {});
      }
    } catch (_) {
      /* Dacă tabelul nu are IsActive/LastActiveAt sau DB e indisponibil, permitem accesul */
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
