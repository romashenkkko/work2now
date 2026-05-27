import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getMe,
  getUsers,
  patchMe,
  postChangePassword,
  postLogin,
  getGoogleAuth,
  getGoogleAuthCallback,
  getGoogleRegisterPrefill,
  postLogout,
  postRegister,
  postSendOtp,
  postSetUserBooster,
  postSetUserStatus,
  postValidateRegistration,
  postVerifyOtp,
  getSupportLogs,
  getSupportUsers,
  postSupportUsers,
  patchSupportUsers,
  deleteSupportUsers,
  postSupportChatRequest,
  postSupportChatWithFriend,
  getMySupportChats,
  getSupportChatInbox,
  getSupportChatMetricsController,
  postSupportChatAccept,
  postSupportChatClose,
  postSupportChatDelete,
  postSupportChatPriority,
  postSupportChatAssign,
  postSupportChatReassign,
  postSupportChatReopen,
  postSupportChatTags,
  getSupportChatTagsController,
  getSupportChatMacrosController,
  postSupportChatMacros,
  deleteSupportChatMacros,
  postSupportChatReminder,
  postSupportChatReminderResolve,
  postSupportChatEscalate,
  postSupportChatCsat,
  getSupportChatTimelineController,
  postSupportChatBulk,
  postSupportChatVoiceSignal,
  postSupportChatSeen,
  postSupportChatMessageController,
  deleteSupportChatMessageController,
  postSupportChatTyping,
  getSupportChatStream,
  postUploadCv,
  deleteCv,
  getCv,
  getFriendSearch,
  getFriends,
  getFriendRequestsIncoming,
  postFriendAdd,
  postFriendRequestAccept,
  deleteFriendRequestDecline,
  deleteFriendById,
} from "../controllers/authController";
import { ensureDefaultAdmin } from "../services/authService";

const router = Router();

router.post("/validate-registration", postValidateRegistration);
router.post("/register", postRegister);
router.post("/login", postLogin);
router.get("/google", getGoogleAuth);
router.get("/google/callback", getGoogleAuthCallback);
router.get("/google/register-prefill", getGoogleRegisterPrefill);
router.post("/logout", authMiddleware, postLogout);
router.post("/change-password", authMiddleware, postChangePassword);
router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, patchMe);
router.get("/users", authMiddleware, getUsers);
router.post("/users/set-status", authMiddleware, postSetUserStatus);
router.post("/users/set-booster", authMiddleware, postSetUserBooster);
router.post("/send-otp", postSendOtp);
router.post("/verify-otp", postVerifyOtp);
router.get("/support/logs", authMiddleware, getSupportLogs);
router.get("/support/users", authMiddleware, getSupportUsers);
router.post("/support/users", authMiddleware, postSupportUsers);
router.patch("/support/users/:id", authMiddleware, patchSupportUsers);
router.delete("/support/users/:id", authMiddleware, deleteSupportUsers);
router.post("/support/chat/request", authMiddleware, postSupportChatRequest);
router.post("/support/chat/with-friend", authMiddleware, postSupportChatWithFriend);
router.get("/support/chat/my", authMiddleware, getMySupportChats);
router.get("/support/chat/inbox", authMiddleware, getSupportChatInbox);
router.get("/support/chat/metrics", authMiddleware, getSupportChatMetricsController);
router.get("/support/chat/stream", getSupportChatStream);
router.post("/support/chat/:id/accept", authMiddleware, postSupportChatAccept);
router.post("/support/chat/:id/message", authMiddleware, postSupportChatMessageController);
router.delete("/support/chat/:id/messages/:messageId", authMiddleware, deleteSupportChatMessageController);
router.post("/support/chat/:id/typing", authMiddleware, postSupportChatTyping);
router.post("/support/chat/:id/seen", authMiddleware, postSupportChatSeen);
router.post("/support/chat/:id/close", authMiddleware, postSupportChatClose);
router.post("/support/chat/:id/delete", authMiddleware, postSupportChatDelete);
router.post("/support/chat/:id/priority", authMiddleware, postSupportChatPriority);
router.post("/support/chat/:id/assign", authMiddleware, postSupportChatAssign);
router.post("/support/chat/:id/reassign", authMiddleware, postSupportChatReassign);
router.post("/support/chat/:id/reopen", authMiddleware, postSupportChatReopen);
router.post("/support/chat/:id/tags", authMiddleware, postSupportChatTags);
router.get("/support/chat/tags", authMiddleware, getSupportChatTagsController);
router.get("/support/chat/macros", authMiddleware, getSupportChatMacrosController);
router.post("/support/chat/macros", authMiddleware, postSupportChatMacros);
router.delete("/support/chat/macros/:id", authMiddleware, deleteSupportChatMacros);
router.post("/support/chat/:id/reminder", authMiddleware, postSupportChatReminder);
router.post("/support/chat/reminders/:id/resolve", authMiddleware, postSupportChatReminderResolve);
router.post("/support/chat/:id/escalate", authMiddleware, postSupportChatEscalate);
router.post("/support/chat/:id/csat", authMiddleware, postSupportChatCsat);
router.get("/support/chat/:id/timeline", authMiddleware, getSupportChatTimelineController);
router.post("/support/chat/bulk", authMiddleware, postSupportChatBulk);
router.post("/support/chat/:id/voice-signal", authMiddleware, postSupportChatVoiceSignal);

router.post("/cv/upload", authMiddleware, postUploadCv);
router.delete("/cv", authMiddleware, deleteCv);
router.get("/cv/:userId", getCv);

router.get("/friends/requests", authMiddleware, getFriendRequestsIncoming);
router.post("/friends/requests/:fromUserId/accept", authMiddleware, postFriendRequestAccept);
router.delete("/friends/requests/:fromUserId", authMiddleware, deleteFriendRequestDecline);
router.get("/friends/search", authMiddleware, getFriendSearch);
router.get("/friends", authMiddleware, getFriends);
router.post("/friends", authMiddleware, postFriendAdd);
router.delete("/friends/:targetUserId", authMiddleware, deleteFriendById);

export { ensureDefaultAdmin };
export default router;
