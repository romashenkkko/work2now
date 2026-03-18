import { Request, Response } from "express";
import { JwtPayload } from "../middleware/auth";
import { ServiceError } from "../services/ServiceError";
import {
  checkNeedsOnboarding,
  createExperience,
  deleteExperience,
  listCurrentUserExperiences,
  listUserExperiences,
  saveOnboardingExperiences,
  updateExperience,
} from "../services/experiencesService";

type ReqWithUser = Request & { user?: JwtPayload };

function handleError(res: Response, error: unknown, logLabel: string, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(logLabel, error);
  res.status(500).json({ error: fallbackMessage });
}

export async function getOnboardingStatus(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await checkNeedsOnboarding(req.user?.userId));
  } catch (error) {
    handleError(res, error, "GET /api/experiences/check-onboarding error:", "Eroare la verificarea onboarding-ului.");
  }
}

export async function postOnboardingExperiences(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await saveOnboardingExperiences(req.user?.userId, req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/experiences/onboarding error:", "Eroare la salvarea experiențelor.");
  }
}

export async function getMyExperiences(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await listCurrentUserExperiences(req.user?.userId));
  } catch (error) {
    handleError(res, error, "GET /api/experiences error:", "Eroare la încărcarea experiențelor.");
  }
}

export async function getUserExperiences(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await listUserExperiences(req.params.userId));
  } catch (error) {
    handleError(res, error, "GET /api/experiences/user/:userId error:", "Eroare la încărcarea profilului.");
  }
}

export async function postExperience(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await createExperience(req.user?.userId, req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/experiences error:", "Eroare la adăugarea experienței.");
  }
}

export async function patchExperience(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await updateExperience(req.user?.userId, req.params.id, req.body ?? {}));
  } catch (error) {
    handleError(res, error, "PATCH /api/experiences/:id error:", "Eroare la actualizarea experienței.");
  }
}

export async function removeExperience(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await deleteExperience(req.user?.userId, req.params.id));
  } catch (error) {
    handleError(res, error, "DELETE /api/experiences/:id error:", "Eroare la ștergerea experienței.");
  }
}

