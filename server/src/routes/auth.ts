import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getMe,
  getUsers,
  patchMe,
  postChangePassword,
  postLogin,
  postRegister,
  postSendOtp,
  postSetUserBooster,
  postSetUserStatus,
  postValidateRegistration,
  postVerifyOtp,
} from "../controllers/authController";
import { ensureDefaultAdmin } from "../services/authService";

const router = Router();

router.post("/validate-registration", postValidateRegistration);
router.post("/register", postRegister);
router.post("/login", postLogin);
router.post("/change-password", authMiddleware, postChangePassword);
router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, patchMe);
router.get("/users", authMiddleware, getUsers);
router.post("/users/set-status", authMiddleware, postSetUserStatus);
router.post("/users/set-booster", authMiddleware, postSetUserBooster);
router.post("/send-otp", postSendOtp);
router.post("/verify-otp", postVerifyOtp);

export { ensureDefaultAdmin };
export default router;
