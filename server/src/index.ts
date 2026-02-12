import "dotenv/config";
// Asigură fallback în memorie (auth) când rulezi cu npm run dev
if (typeof process.env.NODE_ENV === "undefined" || process.env.NODE_ENV === "") {
  process.env.NODE_ENV = "development";
}
import "express-async-errors";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";
import authRoutes, { ensureDefaultAdmin } from "./routes/auth";
import jobsRoutes from "./routes/jobs";
import ratingsRoutes from "./routes/ratings";
import branchesRoutes from "./routes/branches";
import experiencesRoutes from "./routes/experiences";
import db, { initDatabase } from "./db";
import { sendTestEmail } from "./email";

const app = express();
const PORT = process.env.PORT || 5600;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.post("/api/test-email", async (req, res) => {
  const to = typeof req.body?.to === "string" ? req.body.to.trim() : "";
  const result = await sendTestEmail(to || "vasilepopovici262@gmail.com");
  if (result.ok) res.json({ ok: true, message: "Email de test trimis." });
  else res.status(400).json({ ok: false, error: result.error });
});

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    const err = e as Error;
    console.error("Health check failed:", err.message);
    res.status(503).json({
      ok: false,
      error: "Baza de date indisponibila.",
      detail: process.env.NODE_ENV !== "production" ? err.message : undefined,
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/ratings", ratingsRoutes);
app.use("/api/branches", branchesRoutes);
app.use("/api/experiences", experiencesRoutes);

// Răspuns JSON la orice eroare neprinsă (evită HTML 500)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  const isDbError =
    (err as NodeJS.ErrnoException).code === "ECONNREFUSED" ||
    (err as NodeJS.ErrnoException).code === "ER_ACCESS_DENIED_ERROR" ||
    (err as NodeJS.ErrnoException).code === "ER_BAD_DB_ERROR" ||
    (err as NodeJS.ErrnoException).code === "ENOTFOUND" ||
    String((err as NodeJS.ErrnoException).code || "").startsWith("ER_");
  const status = isDbError ? 503 : 500;
  const message =
    isDbError
      ? "Baza de date indisponibila. Porneste MySQL (XAMPP) si verifica .env (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME)."
      : process.env.NODE_ENV !== "production"
        ? err.message
        : "Eroare server.";
  res.status(status).json({ error: message });
});

// In production: serve React build
const clientBuild = path.join(__dirname, "../../client/dist");
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return;
    res.sendFile(path.join(clientBuild, "index.html"));
  });
}

const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  try {
    await initDatabase();
  } catch (e) {
    const err = e as Error;
    console.error("[DB] initDatabase failed:", err.message);
    if (err.message.includes("Schema invalid") || err.message.includes("missing")) {
      console.error("[DB] Schema mismatch detected. To reset the database:");
      console.error("[DB]   1. Set DB_FORCE_RESET=1 in .env (or ensure NODE_ENV != 'production')");
      console.error("[DB]   2. Or manually drop and recreate the database");
      console.error("[DB] Server will continue but database operations may fail.");
    } else {
      console.error("[DB] Database connection failed. Check MySQL is running and .env settings.");
    }
    // Continue anyway - memory fallback will be used
  }
  await ensureDefaultAdmin().catch((e) => console.error("Seed admin:", e));
  app.listen(Number(PORT), HOST, () => {
    console.log(`Time2Go API: http://localhost:${PORT}`);
    if (HOST === "0.0.0.0") {
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        const iface = nets[name];
        if (!iface) continue;
        for (const net of iface) {
          if (net.family === "IPv4" && !net.internal) {
            console.log(`  Din rețea: http://${net.address}:${PORT}`);
          }
        }
      }
    }
  });
}

start().catch((e) => {
  console.error("Pornire server:", e);
  process.exit(1);
});
