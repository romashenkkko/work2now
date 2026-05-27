import dotenv from "dotenv";
import fs from "fs";
import path from "path";

/**
 * Load environment variables early and deterministically.
 *
 * IMPORTANT for ESM:
 * - Static imports are evaluated before module body.
 * - Prisma client can be imported before `index.ts` runs `dotenv.config()`.
 * So we keep env loading in its own module and import it from any entrypoint
 * that needs env (especially `prismaClient.ts`).
 */
export function ensureEnvLoaded() {
  // Avoid re-loading (and avoid overwriting env set by the system).
  if ((globalThis as any).__WORK2NOW_ENV_LOADED__) return;
  (globalThis as any).__WORK2NOW_ENV_LOADED__ = true;

  const possiblePaths = [
    path.resolve(__dirname, "../.env"), // server/.env (canonical)
    path.resolve(process.cwd(), "server", ".env"), // npm run dev from repo root
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../.env"), // dist layout fallback
  ];

  const loaded = new Set<string>();
  for (const p of possiblePaths) {
    const resolved = path.normalize(p);
    if (loaded.has(resolved) || !fs.existsSync(resolved)) continue;
    loaded.add(resolved);
    dotenv.config({ path: resolved });
  }

  // Prisma uses DATABASE_URL. The rest of the app mostly uses DB_*.
  // If DATABASE_URL is missing, derive it from DB_* to keep configs consistent.
  if (!process.env.DATABASE_URL) {
    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || "3306";
    const user = process.env.DB_USER || "root";
    const password = process.env.DB_PASSWORD || "";
    const dbName = process.env.DB_NAME || "time2go";

    const auth = password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}` : encodeURIComponent(user);
    process.env.DATABASE_URL = `mysql://${auth}@${host}:${port}/${dbName}`;
  }
}

// Side-effect import style: simply importing this module ensures env is ready.
ensureEnvLoaded();


