import type { Request, Response } from "express";
import type { JwtPayload } from "../middleware/auth";
import { ServiceError } from "../services/ServiceError";
import { getApplicationPayment, startApplicationPayment } from "../services/paymentsService";
import { processPaynetWebhook } from "../services/paynetService";

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

function getIdempotencyKey(req: Request): string {
  const headerKey = req.header("Idempotency-Key") ?? req.header("idempotency-key");
  if (headerKey?.trim()) return headerKey.trim();
  const body = req.body ?? {};
  const bodyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : typeof body.idempotency_key === "string" ? body.idempotency_key : "";
  return bodyKey.trim();
}

export async function startApplicationPaymentController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const applicationId = req.params.applicationId;
  const idempotencyKey = getIdempotencyKey(req);

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!applicationId) {
    res.status(400).json({ error: "Application ID lipsă." });
    return;
  }

  try {
    const result = await startApplicationPayment(userId, applicationId, idempotencyKey);
    res.status(result.created ? 201 : 200).json(result.response);
  } catch (error) {
    handleError(res, error, "POST /api/payments/applications/:applicationId/start error:", "Eroare la pornirea plății.");
  }
}

export async function getApplicationPaymentController(req: ReqWithUser, res: Response): Promise<void> {
  const userId = getUserId(req);
  const applicationId = req.params.applicationId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!applicationId) {
    res.status(400).json({ error: "Application ID lipsă." });
    return;
  }

  try {
    const response = await getApplicationPayment(userId, applicationId);
    res.status(200).json(response);
  } catch (error) {
    handleError(res, error, "GET /api/payments/applications/:applicationId error:", "Eroare la citirea stării plății.");
  }
}

export async function paynetWebhookController(req: Request, res: Response): Promise<void> {
  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? "";
  try {
    const result = await processPaynetWebhook({
      headers: req.headers as Record<string, string | string[] | undefined>,
      rawBody,
    });
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, "POST /api/payments/paynet/webhook error:", "Eroare la procesarea webhook-ului Paynet.");
  }
}