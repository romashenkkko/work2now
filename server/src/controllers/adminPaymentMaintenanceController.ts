import type { Request, Response } from "express";
import type { JwtPayload } from "../middleware/auth";
import { ServiceError } from "../services/ServiceError";
import {
  expireStaleReservations,
  findOrphanReservations,
  reconcileJobReservation,
  reconcileReservationByPaynetOrderId,
  replayLastReservationWebhook,
} from "../services/reservationMaintenanceService";

type ReqWithUser = Request & { user?: JwtPayload };

function handleError(res: Response, error: unknown, logLabel: string, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(logLabel, error);
  res.status(500).json({ error: fallbackMessage });
}

export async function listOrphanReservationsController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await findOrphanReservations(userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "GET /api/admin/payments/orphans error:", "Eroare la listarea rezervărilor problematice.");
  }
}

export async function expireStaleReservationsController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await expireStaleReservations(userId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "POST /api/admin/payments/expire-stale error:", "Eroare la expirarea rezervărilor.");
  }
}

export async function reconcileJobReservationController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const jobId = req.params.jobId;
  if (!userId || !jobId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await reconcileJobReservation(userId, jobId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "POST /api/admin/payments/jobs/:jobId/reconcile error:", "Eroare la reconciliere.");
  }
}

export async function reconcileByPaynetOrderIdController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const paynetOrderId = String(req.body?.paynetOrderId ?? req.body?.orderId ?? "").trim();
  if (!paynetOrderId) {
    res.status(400).json({ error: "paynetOrderId este obligatoriu." });
    return;
  }
  try {
    const result = await reconcileReservationByPaynetOrderId(userId, paynetOrderId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "POST /api/admin/payments/reconcile-by-order error:", "Eroare la reconciliere.");
  }
}

export async function replayReservationWebhookController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const reservationId = req.params.reservationId;
  if (!userId || !reservationId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await replayLastReservationWebhook(userId, reservationId);
    res.json(result);
  } catch (error) {
    handleError(res, error, "POST /api/admin/payments/reservations/:id/replay-webhook error:", "Eroare la replay webhook.");
  }
}
