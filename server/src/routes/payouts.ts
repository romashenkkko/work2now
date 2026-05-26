import { Router } from "express";
import { postPayoutWebhookController } from "../controllers/payoutsWebhookController";

const router = Router();

/** POST /api/payouts/webhook/:provider — provider payout callbacks (no auth; signature verified) */
router.post("/webhook/:provider", postPayoutWebhookController);

export default router;
