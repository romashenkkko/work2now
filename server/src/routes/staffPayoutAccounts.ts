import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { listMyPayoutAccountsController, upsertMyPayoutAccountController } from "../controllers/staffPayoutAccountsController";

const router = Router();

/** GET /api/payout-accounts — staff: list payout accounts */
router.get("/", authMiddleware, listMyPayoutAccountsController);

/** POST /api/payout-accounts — staff: upsert default payout account (iban | phone) */
router.post("/", authMiddleware, upsertMyPayoutAccountController);

export default router;
