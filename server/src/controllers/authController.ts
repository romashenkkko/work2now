import { Request, Response } from "express";
import path from "path";
import fs from "fs";
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
  supportCreateUser,
  supportDeactivateUser,
  supportListUsers,
  supportUpdateUser,
  uploadCvForUser,
  deleteCvForUser,
  getCvForUser,
} from "../services/authService";
import { listActivityLogsForSupport } from "../services/activityLogService";
import { uploadCv } from "../middleware/upload";

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

export async function getSupportLogs(req: ReqWithUser, res: Response): Promise<void> {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    res.json(await listActivityLogsForSupport(req.user?.userId, limit, offset));
  } catch (error) {
    handleError(res, error, "GET /api/auth/support/logs error:", "Eroare la încărcarea logurilor.");
  }
}

export async function getSupportUsers(req: ReqWithUser, res: Response): Promise<void> {
  try {
    const role = String(req.query.role ?? "");
    res.json(await supportListUsers(req.user?.userId, role as any));
  } catch (error) {
    handleError(res, error, "GET /api/auth/support/users error:", "Eroare la încărcarea utilizatorilor support.");
  }
}

export async function postSupportUsers(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await supportCreateUser(req.user?.userId, req.body ?? ({} as any)));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/users error:", "Eroare la crearea utilizatorului.");
  }
}

export async function patchSupportUsers(req: ReqWithUser, res: Response): Promise<void> {
  try {
    const id = req.params.id;
    res.json(await supportUpdateUser(req.user?.userId, id, req.body ?? ({} as any)));
  } catch (error) {
    handleError(res, error, "PATCH /api/auth/support/users/:id error:", "Eroare la actualizarea utilizatorului.");
  }
}

export async function deleteSupportUsers(req: ReqWithUser, res: Response): Promise<void> {
  try {
    const id = req.params.id;
    res.json(await supportDeactivateUser(req.user?.userId, id));
  } catch (error) {
    handleError(res, error, "DELETE /api/auth/support/users/:id error:", "Eroare la dezactivarea utilizatorului.");
  }
}

export async function postUploadCv(req: ReqWithUser, res: Response): Promise<void> {
  uploadCv(req, res, async (err) => {
    if (err) {
      res.status(400).json({ error: err.message || "Upload failed." });
      return;
    }
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded." });
        return;
      }
      const result = await uploadCvForUser(req.user?.userId, req.file.filename, req.file.originalname);
      res.json(result);
    } catch (error) {
      handleError(res, error, "POST /api/auth/cv/upload error:", "Eroare la încărcarea CV-ului.");
    }
  });
}

export async function deleteCv(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await deleteCvForUser(req.user?.userId));
  } catch (error) {
    handleError(res, error, "DELETE /api/auth/cv error:", "Eroare la ștergerea CV-ului.");
  }
}

export async function getCv(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const cv = await getCvForUser(userId);
    if (!cv.cvFileUrl) {
      res.status(404).json({ error: "CV not found." });
      return;
    }
    const filePath = path.join(__dirname, "../../uploads/cv", cv.cvFileUrl);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "CV file not found on disk." });
      return;
    }
    const ext = path.extname(cv.cvFileUrl).toLowerCase();
    const contentType =
      ext === ".pdf" ? "application/pdf" :
      ext === ".docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
      ext === ".doc" ? "application/msword" : "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(cv.cvOriginalName || "cv" + ext)}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    handleError(res, error, "GET /api/auth/cv/:userId error:", "Eroare la descărcarea CV-ului.");
  }
}
