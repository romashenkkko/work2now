import type { Request, Response } from "express";
import { isPaynetMockMode } from "../config/paynetConfig";
import { ServiceError } from "../services/ServiceError";
import {
  mockConfirmApplicationPaymentSuccess,
  mockConfirmReservationSuccess,
} from "../services/paynetMockService";

function handleError(res: Response, error: unknown, logLabel: string): void {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(logLabel, error);
  res.status(500).json({ error: "Eroare mock Paynet." });
}

function ensureMockRoute(_req: Request, res: Response): boolean {
  if (!isPaynetMockMode()) {
    res.status(404).json({ error: "Paynet mock mode is not enabled." });
    return false;
  }
  return true;
}

/** POST /api/dev/paynet/mock-reservation-success/:jobId */
export async function mockReservationSuccessController(req: Request, res: Response): Promise<void> {
  if (!ensureMockRoute(req, res)) return;

  const jobId = Number.parseInt(String(req.params.jobId ?? ""), 10);
  if (!Number.isInteger(jobId) || jobId < 1) {
    res.status(400).json({ error: "Invalid job id." });
    return;
  }

  try {
    const result = await mockConfirmReservationSuccess(jobId);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, "[Paynet MOCK] mock-reservation-success error:");
  }
}

/** POST /api/dev/paynet/mock-application-payment-success/:applicationId */
export async function mockApplicationPaymentSuccessController(req: Request, res: Response): Promise<void> {
  if (!ensureMockRoute(req, res)) return;

  const applicationId = Number.parseInt(String(req.params.applicationId ?? ""), 10);
  if (!Number.isInteger(applicationId) || applicationId < 1) {
    res.status(400).json({ error: "Invalid application id." });
    return;
  }

  try {
    const result = await mockConfirmApplicationPaymentSuccess(applicationId);
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error, "[Paynet MOCK] mock-application-payment-success error:");
  }
}
