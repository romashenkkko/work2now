import type { Request, Response } from "express";
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
} from "../services/jobsService";
import { notifyCustomerNewApplication, notifyStaffAccepted, notifyStaffRefused } from "../email";

type ReqWithUser = Request & { user?: JwtPayload };

function handleError(res: Response, error: unknown, logLabel: string, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(logLabel, error);
  res.status(500).json({ error: fallbackMessage });
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

