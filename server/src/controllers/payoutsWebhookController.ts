import type { Request, Response } from "express";
import { ServiceError } from "../services/ServiceError";
import { applyPayoutWebhook } from "../services/payoutAutomationService";

type ReqWithRaw = Request & { rawBody?: string };

export async function postPayoutWebhookController(req: ReqWithRaw, res: Response): Promise<void> {
  const provider = String(req.params.provider ?? "").trim();
  if (!provider) {
    res.status(400).json({ error: "Provider lipsă." });
    return;
  }

  const rawBody =
    typeof req.rawBody === "string" && req.rawBody.length > 0 ? req.rawBody : JSON.stringify(req.body ?? {});

  try {
    const result = await applyPayoutWebhook(provider, req.headers as Record<string, string | string[] | undefined>, rawBody);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ServiceError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error("POST /api/payouts/webhook error:", error);
    res.status(500).json({ error: "Eroare la procesarea webhook-ului." });
  }
}
