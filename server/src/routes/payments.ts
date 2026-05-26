import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getApplicationPaymentController, paynetWebhookController, startApplicationPaymentController } from "../controllers/paymentsController";

const router = Router();

/** POST /api/payments/applications/:applicationId/start - customer: start post-completion payment */
router.post("/applications/:applicationId/start", authMiddleware, startApplicationPaymentController);

/** GET /api/payments/applications/:applicationId - customer/staff: read current payment state */
router.get("/applications/:applicationId", authMiddleware, getApplicationPaymentController);

/** POST /api/payments/paynet/webhook - Paynet server-server callback */
router.post("/paynet/webhook", paynetWebhookController);

export default router;