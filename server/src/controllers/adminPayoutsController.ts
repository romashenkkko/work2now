import type { Request, Response } from "express";
import type { JwtPayload } from "../middleware/auth";
import { ServiceError } from "../services/ServiceError";
import {
  getAdminPayoutDetail,
  listAdminPayouts,
  markPayoutDisputed,
  markPayoutFailed,
  markPayoutPaid,
} from "../services/adminPayoutsService";

type ReqWithUser = Request & { user?: JwtPayload };

function getUserId(req: ReqWithUser): string | null {
  return req.user?.userId ?? null;
}

function handleError(res: Response, error: unknown, logLabel: string, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(logLabel, error);
  res.status(500).json({ error: fallbackMessage });
}

export async function listAdminPayoutsController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const rawStatus = req.query.status;
    const status = typeof rawStatus === "string" ? rawStatus : undefined;
    const result = await listAdminPayouts(userId, status);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, "GET /api/admin/payouts error:", "Eroare la listarea plăților.");
  }
}

export async function getAdminPayoutDetailController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const payoutId = req.params.payoutId;
  if (!userId || !payoutId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const result = await getAdminPayoutDetail(userId, payoutId);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, "GET /api/admin/payouts/:payoutId error:", "Eroare la citirea payout-ului.");
  }
}

function readAdminNote(body: unknown): unknown {
  if (!body || typeof body !== "object") return undefined;
  const b = body as any;
  return b.note ?? b.adminNote ?? b.reason ?? undefined;
}

export async function markPaidController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const payoutId = req.params.payoutId;
  if (!userId || !payoutId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payout = await markPayoutPaid(userId, payoutId, readAdminNote(req.body));
    res.status(200).json({ ok: true, payout });
  } catch (error) {
    handleError(res, error, "POST /api/admin/payouts/:payoutId/mark-paid error:", "Eroare la marcarea ca plătit.");
  }
}

export async function markFailedController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const payoutId = req.params.payoutId;
  if (!userId || !payoutId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payout = await markPayoutFailed(userId, payoutId, readAdminNote(req.body));
    res.status(200).json({ ok: true, payout });
  } catch (error) {
    handleError(res, error, "POST /api/admin/payouts/:payoutId/mark-failed error:", "Eroare la marcarea ca eșuat.");
  }
}

export async function markDisputedController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const payoutId = req.params.payoutId;
  if (!userId || !payoutId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payout = await markPayoutDisputed(userId, payoutId, readAdminNote(req.body));
    res.status(200).json({ ok: true, payout });
  } catch (error) {
    handleError(res, error, "POST /api/admin/payouts/:payoutId/mark-disputed error:", "Eroare la marcarea ca disputat.");
  }
}

