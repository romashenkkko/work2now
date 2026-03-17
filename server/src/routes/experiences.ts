import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getMyExperiences,
  getOnboardingStatus,
  getUserExperiences,
  patchExperience,
  postExperience,
  postOnboardingExperiences,
  removeExperience,
} from "../controllers/experiencesController";

const router = Router();
router.get("/check-onboarding", authMiddleware, getOnboardingStatus);
router.post("/onboarding", authMiddleware, postOnboardingExperiences);
router.get("/", authMiddleware, getMyExperiences);
router.get("/user/:userId", authMiddleware, getUserExperiences);
router.post("/", authMiddleware, postExperience);
router.patch("/:id", authMiddleware, patchExperience);
router.delete("/:id", authMiddleware, removeExperience);

export default router;

