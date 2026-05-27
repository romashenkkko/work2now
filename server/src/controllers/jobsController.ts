import path from "path";
import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import type { JwtPayload } from "../middleware/auth";
import { ServiceError } from "../services/ServiceError";
import {
  getJobCategories,
  getRaioane,
  listJobs,
  createJob,
  deleteJob,
  setPromoted,
  getMyApplications,
  getMyApplicationsList,
  applyToJob,
  getApplications,
  confirmCompletion,
  checkIn,
  checkOut,
  getStatistics,
  setApplicationStatus,
  getAdminStatistics,
  getResolvedRoleAndCustomerLike,
} from "../services/jobsService";
import { notifyCustomerNewApplication, notifyStaffAccepted, notifyStaffRefused } from "../email";

type ReqWithUser = Request & { user?: JwtPayload };

function handleError(res: Response, error: unknown, logLabel: string, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(logLabel, error);
  const isDev = process.env.NODE_ENV !== "production";
  const body: { error: string; detail?: string; code?: string } = { error: fallbackMessage };
  if (isDev && error instanceof Error) {
    body.detail = error.message;
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" || typeof code === "number") body.code = String(code);
  }
  res.status(500).json(body);
}

function getUserId(req: ReqWithUser): string | null {
  return req.user?.userId ?? null;
}

export async function getJobCategoriesController(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await getJobCategories());
  } catch (error) {
    handleError(res, error, "GET /api/jobs/categories error:", "Eroare la încărcarea categoriilor de job.");
  }
}

export async function getRaioaneController(req: Request, res: Response): Promise<void> {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    res.json(await getRaioane(search));
  } catch (error) {
    handleError(res, error, "GET /api/jobs/raioane error:", "Eroare la încărcarea raioanelor.");
  }
}

export async function listJobsController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    res.json(await listJobs(userId));
  } catch (error) {
    handleError(res, error, "GET /api/jobs error:", "Eroare la încărcarea joburilor.");
  }
}

export async function createJobController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const created = await createJob(userId, req.body ?? {});
    res.status(201).json(created);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("POST /api/jobs prisma:", error.code, error.message);
      const col =
        typeof error.meta?.column_name === "string" ? error.meta.column_name : "";
      if (error.code === "P2022" || /unknown column|doesn't exist/i.test(String(error.message))) {
        res.status(500).json({
          error:
            col === "attachment_urls" || /attachment_urls/i.test(String(error.message))
              ? "Lipsește coloana attachment_urls. Din folderul server: 1) npm run db:add-attachment-urls  2) npm run prisma:resolve-attachment-migration  3) repornește API-ul. Verifică că .env din server indică aceeași bază ca în phpMyAdmin (DB_NAME / DATABASE_URL). migrate deploy trebuie rulat din folderul server; dacă l-ai rulat din alt loc, migrarea putea merge pe altă schemă."
              : "Baza de date nu corespunde cu versiunea aplicației. În folderul server: npx prisma migrate deploy",
        });
        return;
      }
    }
    handleError(res, error, "POST /api/jobs error:", "Eroare la crearea jobului.");
  }
}

export async function deleteJobController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const jobId = req.params.id;
  if (!userId || !jobId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await deleteJob(userId, jobId);
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error, "DELETE /api/jobs/:id error:", "Eroare la ștergerea jobului.");
  }
}

export async function setPromotedController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const jobId = req.params.id;
  const promoted = req.body?.promoted === true;
  if (!userId || !jobId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await setPromoted(userId, jobId, promoted);
    res.json({ ok: true, promoted });
  } catch (error) {
    handleError(res, error, "PATCH /api/jobs/:id/promote error:", "Eroare la setarea promovării.");
  }
}

export async function getMyApplicationsController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    res.json(await getMyApplications(userId));
  } catch (error) {
    handleError(res, error, "GET /api/jobs/my-applications error:", "Eroare la încărcarea aplicațiilor.");
  }
}

export async function getMyApplicationsListController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    res.json(await getMyApplicationsList(userId));
  } catch (error) {
    handleError(res, error, "GET /api/jobs/my-applications/list error:", "Eroare la încărcarea listei.");
  }
}

export async function applyToJobController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const jobId = req.params.id;
  if (!userId || !jobId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await applyToJob(userId, jobId);
    if (result.customerEmail) {
      notifyCustomerNewApplication(result.customerEmail, result.staffName, result.jobTitle).catch(() => {});
    }
    res.status(201).json({ ok: true });
  } catch (error) {
    handleError(res, error, "POST /api/jobs/:id/apply error:", "Eroare la aplicarea la job.");
  }
}

export async function getApplicationsController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    res.json(await getApplications(userId));
  } catch (error) {
    handleError(res, error, "GET /api/jobs/applications error:", "Eroare la încărcarea aplicațiilor.");
  }
}

export async function confirmCompletionController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const appId = req.params.id;
  if (!userId || !appId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    await confirmCompletion(userId, appId);
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error, "PATCH /api/jobs/applications/:id/confirm-completion error:", "Eroare la confirmare.");
  }
}

export async function checkInController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const appIdRaw = req.params.id;
  const appId = appIdRaw ? Number(appIdRaw) : NaN;
  if (!userId || !appIdRaw || Number.isNaN(appId) || appId < 1) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await checkIn(userId, appId, req.body ?? {});
    res.json(result.alreadyDone ? { ok: true, alreadyDone: true } : { ok: true });
  } catch (error) {
    handleError(res, error, "PATCH /api/jobs/applications/:id/check-in error:", "Eroare la check-in.");
  }
}

export async function checkOutController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const appIdRaw = req.params.id;
  const appId = appIdRaw ? Number(appIdRaw) : NaN;
  if (!userId || !appIdRaw || Number.isNaN(appId) || appId < 1) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await checkOut(userId, appId, req.body ?? {});
    res.json(result.alreadyDone ? { ok: true, alreadyDone: true } : { ok: true });
  } catch (error) {
    handleError(res, error, "PATCH /api/jobs/applications/:id/check-out error:", "Eroare la check-out.");
  }
}

export async function getStatisticsController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    res.json(await getStatistics(userId));
  } catch (error) {
    handleError(res, error, "GET /api/jobs/statistics error:", "Eroare la statistici.");
  }
}

export async function setApplicationStatusController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const appId = req.params.id;
  const status = String((req.body ?? {}).status ?? "").toLowerCase();
  if (!userId || !appId || (status !== "accepted" && status !== "refused")) {
    res.status(400).json({ error: "Status invalid (accepted sau refused)." });
    return;
  }
  try {
    const result = await setApplicationStatus(userId, appId, status as "accepted" | "refused");
    if (result.staffEmail && status === "accepted") {
      notifyStaffAccepted(result.staffEmail, result.staffName, result.jobDetails).catch(() => {});
    }
    if (result.staffEmail && status === "refused") {
      notifyStaffRefused(result.staffEmail, result.staffName, result.jobTitle).catch(() => {});
    }
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error, "PATCH /api/jobs/applications/:id error:", "Eroare la actualizarea aplicației.");
  }
}

export async function getAdminStatisticsController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    res.json(await getAdminStatistics(userId));
  } catch (error) {
    handleError(res, error, "GET /api/jobs/admin/statistics error:", "Eroare la încărcarea statisticilor admin.");
  }
}

const JOB_IMAGES_DIR = path.join(__dirname, "../../uploads/job-images");
const JOB_ATTACHMENTS_DIR = path.join(__dirname, "../../uploads/job-attachments");

type ReqWithUploadedFile = ReqWithUser & { file?: Express.Multer.File };

export async function postUploadJobImageController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { customerLike } = await getResolvedRoleAndCustomerLike(userId);
    if (!customerLike) {
      res.status(403).json({ error: "Doar angajatorii pot încărca imagini." });
      return;
    }
    const file = (req as ReqWithUploadedFile).file;
    if (!file?.filename) {
      res.status(400).json({ error: "Lipsește imaginea." });
      return;
    }
    res.status(201).json({ url: `/api/jobs/media/${file.filename}` });
  } catch (error) {
    handleError(res, error, "POST /api/jobs/upload-image error:", "Eroare la încărcarea imaginii.");
  }
}

export function getJobMediaController(req: Request, res: Response): void {
  const raw = req.params.filename ?? "";
  const base = path.basename(raw);
  if (base !== raw || !/^[a-zA-Z0-9._-]+\.(jpe?g|png|webp)$/i.test(base)) {
    res.status(400).end();
    return;
  }
  const resolvedDir = path.resolve(JOB_IMAGES_DIR);
  const full = path.resolve(JOB_IMAGES_DIR, base);
  if (!full.startsWith(resolvedDir + path.sep)) {
    res.status(400).end();
    return;
  }
  res.sendFile(full, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
}

export async function postUploadJobAttachmentController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const { customerLike } = await getResolvedRoleAndCustomerLike(userId);
    if (!customerLike) {
      res.status(403).json({ error: "Doar angajatorii pot încărca documente." });
      return;
    }
    const file = (req as ReqWithUploadedFile).file;
    if (!file?.filename) {
      res.status(400).json({ error: "Lipsește fișierul." });
      return;
    }
    const originalName =
      typeof file.originalname === "string" && file.originalname.trim() ? file.originalname.trim().slice(0, 200) : file.filename;
    res.status(201).json({
      url: `/api/jobs/attachments/${file.filename}`,
      originalName,
    });
  } catch (error) {
    handleError(res, error, "POST /api/jobs/upload-attachment error:", "Eroare la încărcarea documentului.");
  }
}

export function getJobAttachmentController(req: Request, res: Response): void {
  const raw = req.params.filename ?? "";
  const base = path.basename(raw);
  if (base !== raw || !/^[a-zA-Z0-9._-]+\.(pdf|doc|docx|png|jpe?g|xls|xlsx)$/i.test(base)) {
    res.status(400).end();
    return;
  }
  const resolvedDir = path.resolve(JOB_ATTACHMENTS_DIR);
  const full = path.resolve(JOB_ATTACHMENTS_DIR, base);
  if (!full.startsWith(resolvedDir + path.sep)) {
    res.status(400).end();
    return;
  }
  res.sendFile(full, (err) => {
    if (err && !res.headersSent) res.status(404).end();
  });
}

