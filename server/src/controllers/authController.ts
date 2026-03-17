import { Request, Response } from "express";
import { JwtPayload } from "../middleware/auth";
import { ServiceError } from "../services/ServiceError";
import {
  changePassword,
  getCurrentUser,
  listUsers,
  loginUser,
  registerUser,
  sendOtpCode,
  setUserBooster,
  setUserStatus,
  updateCurrentUser,
  validateRegistration,
  verifyOtpCode,
} from "../services/authService";

type ReqWithUser = Request & { user?: JwtPayload };

function handleError(res: Response, error: unknown, logLabel: string, fallbackMessage: string) {
  if (error instanceof ServiceError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(logLabel, error);
  res.status(500).json({ error: fallbackMessage });
}

export async function postValidateRegistration(req: Request, res: Response): Promise<void> {
  try {
    res.status(200).json(await validateRegistration(req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/auth/validate-registration error:", "Eroare la validare. Verifica ca backend-ul ruleaza.");
  }
}

export async function postRegister(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await registerUser(req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/auth/register error:", "Eroare la inregistrare.");
  }
}

export async function postLogin(req: Request, res: Response): Promise<void> {
  try {
    res.json(await loginUser(req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/auth/login error:", "Email sau parola incorecta.");
  }
}

export async function postChangePassword(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await changePassword(req.user?.userId, req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/auth/change-password error:", "Eroare la schimbarea parolei.");
  }
}

export async function getMe(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await getCurrentUser(req.user?.userId));
  } catch (error) {
    handleError(res, error, "GET /api/auth/me error:", "Eroare server.");
  }
}

export async function patchMe(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await updateCurrentUser(req.user?.userId, req.body ?? {}));
  } catch (error) {
    handleError(res, error, "PATCH /api/auth/me error:", "Eroare server.");
  }
}

export async function getUsers(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await listUsers(req.user?.userId));
  } catch (error) {
    handleError(res, error, "GET /api/auth/users error:", "Eroare la încărcarea utilizatorilor.");
  }
}

export async function postSetUserStatus(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await setUserStatus(req.user?.userId, req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/auth/users/set-status error:", "Eroare la actualizarea statusului.");
  }
}

export async function postSetUserBooster(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await setUserBooster(req.user?.userId, req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/auth/users/set-booster error:", "Eroare la setarea booster.");
  }
}

export async function postSendOtp(req: Request, res: Response): Promise<void> {
  try {
    res.json(await sendOtpCode(req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/auth/send-otp error:", "Eroare la trimiterea codului OTP.");
  }
}

export async function postVerifyOtp(req: Request, res: Response): Promise<void> {
  try {
    res.json(await verifyOtpCode(req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/auth/verify-otp error:", "Eroare la verificarea codului OTP.");
  }
}
