import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import { JwtPayload } from "../middleware/auth";
import { ServiceError } from "../services/ServiceError";
import {
  changePassword,
  getCurrentUser,
  listUsers,
  loginUser,
  logoutUser,
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
import {
  acceptSupportChat,
  closeSupportChat,
  deleteSupportChatForActor,
  bulkSupportChatUpdate,
  deleteSupportChatMacro,
  escalateSupportChat,
  getSupportChatTimeline,
  listMySupportChats,
  listSupportChatMacros,
  listSupportChatTags,
  getSupportChatMetrics,
  listSupportInbox,
  markSupportChatSeen,
  postSupportChatMessage,
  reopenSupportChat,
  requestSupportChat,
  resolveSupportChatReminder,
  reassignSupportChat,
  saveSupportChatMacro,
  setSupportChatPriority,
  setSupportChatReminder,
  setSupportChatTags,
  setSupportChatTyping,
  submitSupportChatCsat,
  assignSupportChat,
} from "../services/supportChatService";
import { subscribeSupportChatEvents } from "../services/supportChatRealtimeService";
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

export async function postLogout(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await logoutUser(req.user?.userId));
  } catch (error) {
    handleError(res, error, "POST /api/auth/logout error:", "Eroare la logout.");
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

export async function postSupportChatRequest(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await requestSupportChat(req.user?.userId, (req.body ?? {}).description));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/request error:", "Eroare la crearea solicitării support.");
  }
}

export async function getMySupportChats(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await listMySupportChats(req.user?.userId));
  } catch (error) {
    handleError(res, error, "GET /api/auth/support/chat/my error:", "Eroare la încărcarea chatului.");
  }
}

export async function getSupportChatInbox(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await listSupportInbox(req.user?.userId));
  } catch (error) {
    handleError(res, error, "GET /api/auth/support/chat/inbox error:", "Eroare la încărcarea inbox-ului support.");
  }
}

export async function getSupportChatMetricsController(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await getSupportChatMetrics(req.user?.userId));
  } catch (error) {
    handleError(res, error, "GET /api/auth/support/chat/metrics error:", "Eroare la încărcarea metricilor de support.");
  }
}

export async function postSupportChatAccept(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await acceptSupportChat(req.user?.userId, req.params.id));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/accept error:", "Eroare la acceptarea chatului.");
  }
}

export async function postSupportChatMessageController(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await postSupportChatMessage(req.user?.userId, req.params.id, (req.body ?? {}).message));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/message error:", "Eroare la trimiterea mesajului.");
  }
}

export async function postSupportChatTyping(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await setSupportChatTyping(req.user?.userId, req.params.id, (req.body ?? {}).isTyping));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/typing error:", "Eroare la actualizarea statusului typing.");
  }
}

export async function postSupportChatSeen(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await markSupportChatSeen(req.user?.userId, req.params.id));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/seen error:", "Eroare la marcarea mesajelor ca văzute.");
  }
}

export async function postSupportChatClose(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await closeSupportChat(req.user?.userId, req.params.id));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/close error:", "Eroare la închiderea chatului.");
  }
}

export async function postSupportChatDelete(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await deleteSupportChatForActor(req.user?.userId, req.params.id));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/delete error:", "Eroare la ștergerea chatului.");
  }
}

export async function postSupportChatPriority(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await setSupportChatPriority(req.user?.userId, req.params.id, (req.body ?? {}).priority));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/priority error:", "Eroare la setarea priorității.");
  }
}

export async function postSupportChatAssign(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await assignSupportChat(req.user?.userId, req.params.id, (req.body ?? {}).userId));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/assign error:", "Eroare la asignarea chatului.");
  }
}

export async function postSupportChatReassign(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await reassignSupportChat(req.user?.userId, req.params.id, (req.body ?? {}).userId, (req.body ?? {}).reason));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/reassign error:", "Eroare la reasignarea chatului.");
  }
}

export async function postSupportChatReopen(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await reopenSupportChat(req.user?.userId, req.params.id, (req.body ?? {}).reason));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/reopen error:", "Eroare la redeschiderea chatului.");
  }
}

export async function postSupportChatTags(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await setSupportChatTags(req.user?.userId, req.params.id, (req.body ?? {}).tags));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/tags error:", "Eroare la actualizarea tagurilor.");
  }
}

export async function getSupportChatTagsController(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await listSupportChatTags(req.user?.userId));
  } catch (error) {
    handleError(res, error, "GET /api/auth/support/chat/tags error:", "Eroare la încărcarea tagurilor.");
  }
}

export async function getSupportChatMacrosController(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await listSupportChatMacros(req.user?.userId));
  } catch (error) {
    handleError(res, error, "GET /api/auth/support/chat/macros error:", "Eroare la încărcarea macro-urilor.");
  }
}

export async function postSupportChatMacros(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await saveSupportChatMacro(req.user?.userId, req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/macros error:", "Eroare la salvarea macro-ului.");
  }
}

export async function deleteSupportChatMacros(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await deleteSupportChatMacro(req.user?.userId, req.params.id));
  } catch (error) {
    handleError(res, error, "DELETE /api/auth/support/chat/macros/:id error:", "Eroare la ștergerea macro-ului.");
  }
}

export async function postSupportChatReminder(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await setSupportChatReminder(req.user?.userId, req.params.id, (req.body ?? {}).dueAt, (req.body ?? {}).note));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/reminder error:", "Eroare la setarea reminder-ului.");
  }
}

export async function postSupportChatReminderResolve(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await resolveSupportChatReminder(req.user?.userId, req.params.id));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/reminders/:id/resolve error:", "Eroare la rezolvarea reminder-ului.");
  }
}

export async function postSupportChatEscalate(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await escalateSupportChat(req.user?.userId, req.params.id, (req.body ?? {}).level, (req.body ?? {}).note));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/escalate error:", "Eroare la escaladare.");
  }
}

export async function postSupportChatCsat(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await submitSupportChatCsat(req.user?.userId, req.params.id, (req.body ?? {}).rating, (req.body ?? {}).comment));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/:id/csat error:", "Eroare la trimiterea CSAT.");
  }
}

export async function getSupportChatTimelineController(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await getSupportChatTimeline(req.user?.userId, req.params.id));
  } catch (error) {
    handleError(res, error, "GET /api/auth/support/chat/:id/timeline error:", "Eroare la încărcarea timeline-ului.");
  }
}

export async function postSupportChatBulk(req: ReqWithUser, res: Response): Promise<void> {
  try {
    res.json(await bulkSupportChatUpdate(req.user?.userId, req.body ?? {}));
  } catch (error) {
    handleError(res, error, "POST /api/auth/support/chat/bulk error:", "Eroare la bulk update.");
  }
}

export async function getSupportChatStream(req: ReqWithUser, res: Response): Promise<void> {
  let userId = String(req.user?.userId ?? "").trim();
  if (!userId) {
    const rawToken = typeof req.query.token === "string" ? req.query.token : "";
    if (rawToken) {
      try {
        const secret = process.env.JWT_SECRET || "default-secret-change-me";
        const decoded = jwt.verify(rawToken, secret) as JwtPayload;
        userId = String(decoded.userId ?? "").trim();
      } catch {
        userId = "";
      }
    }
  }
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  subscribeSupportChatEvents(userId, res);
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
