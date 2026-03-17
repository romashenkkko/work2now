import { Request, Response } from "express";
import { JwtPayload } from "../middleware/auth";
import { ServiceError } from "../services/ServiceError";
import {
  createRating,
  getMyRatings,
  getRatingProfile,
  getReceivedRatings,
  getUserRatingSummary,
} from "../services/ratingsService";

type ReqWithUser = Request & { user?: JwtPayload };

function handleError(res: Response, error: unknown, logLabel: string, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(logLabel, error);
  res.status(500).json({ error: fallbackMessage });
}

export async function postRating(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.status(201).json(await createRating(req.user?.userId, req.body ?? {}));
  } catch (error) {
    handleError(res, error, "Rating creation error:", "Eroare la crearea evaluării.");
  }
}

export async function getMeRatings(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await getMyRatings(req.user?.userId));
  } catch (error) {
    handleError(res, error, "GET /api/ratings/me error:", "Eroare la încărcarea evaluărilor.");
  }
}

export async function getUserRating(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await getUserRatingSummary(req.params.userId));
  } catch (error) {
    handleError(res, error, "GET /api/ratings/user/:userId error:", "Eroare la încărcarea ratingului.");
  }
}

export async function getReceivedUserRatings(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await getReceivedRatings(req.params.userId));
  } catch (error) {
    handleError(res, error, "GET /api/ratings/received/:userId error:", "Eroare la încărcarea recenziilor.");
  }
}

export async function getUserRatingProfile(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await getRatingProfile(req.params.userId));
  } catch (error) {
    handleError(res, error, "GET /api/ratings/profile/:userId error:", "Eroare la încărcarea profilului de rating.");
  }
}

