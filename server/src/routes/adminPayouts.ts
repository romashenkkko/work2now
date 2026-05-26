import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getAdminPayoutDetailController,
  listAdminPayoutsController,
  markDisputedController,
  markFailedController,
  markPaidController,
} from "../controllers/adminPayoutsController";
import {
  expireStaleReservationsController,
  listOrphanReservationsController,
  reconcileByPaynetOrderIdController,
  reconcileJobReservationController,
  replayReservationWebhookController,
} from "../controllers/adminPaymentMaintenanceController";

const router = Router();

/** GET /api/admin/payments/orphans — stuck / mismatched reservations */
router.get("/payments/orphans", authMiddleware, listOrphanReservationsController);

/** POST /api/admin/payments/expire-stale */
router.post("/payments/expire-stale", authMiddleware, expireStaleReservationsController);

/** POST /api/admin/payments/reconcile-by-order — body: { paynetOrderId } */
router.post("/payments/reconcile-by-order", authMiddleware, reconcileByPaynetOrderIdController);

/** POST /api/admin/payments/jobs/:jobId/reconcile */
router.post("/payments/jobs/:jobId/reconcile", authMiddleware, reconcileJobReservationController);

/** POST /api/admin/payments/reservations/:reservationId/replay-webhook */
router.post(
  "/payments/reservations/:reservationId/replay-webhook",
  authMiddleware,
  replayReservationWebhookController
);

/** GET /api/admin/payouts?status=payout_pending */
router.get("/payouts", authMiddleware, listAdminPayoutsController);

/** GET /api/admin/payouts/:payoutId */
router.get("/payouts/:payoutId", authMiddleware, getAdminPayoutDetailController);

/** POST /api/admin/payouts/:payoutId/mark-paid */
router.post("/payouts/:payoutId/mark-paid", authMiddleware, markPaidController);

/** POST /api/admin/payouts/:payoutId/mark-failed */
router.post("/payouts/:payoutId/mark-failed", authMiddleware, markFailedController);

/** POST /api/admin/payouts/:payoutId/mark-disputed */
router.post("/payouts/:payoutId/mark-disputed", authMiddleware, markDisputedController);

export default router;

