import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getMeRatings,
  getReceivedUserRatings,
  getUserRating,
  getUserRatingProfile,
  postRating,
} from "../controllers/ratingsController";

const router = Router();

router.post("/", authMiddleware, postRating);
router.get("/me", authMiddleware, getMeRatings);
router.get("/user/:userId", getUserRating);
router.get("/received/:userId", getReceivedUserRatings);
router.get("/profile/:userId", getUserRatingProfile);

export default router;

