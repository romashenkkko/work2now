import { Router } from "express";
import {
  mockApplicationPaymentSuccessController,
  mockReservationSuccessController,
} from "../controllers/devPaynetController";

const router = Router();

/** Local dev only — router is mounted when PAYNET_MOCK_MODE=true (non-production). */
router.post("/mock-reservation-success/:jobId", mockReservationSuccessController);
router.post("/mock-application-payment-success/:applicationId", mockApplicationPaymentSuccessController);

export default router;
