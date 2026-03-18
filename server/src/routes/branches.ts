import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getBranches,
  patchBranch,
  postBranch,
  removeBranch,
} from "../controllers/branchesController";

const router = Router();
router.get("/", authMiddleware, getBranches);
router.post("/", authMiddleware, postBranch);
router.patch("/:id", authMiddleware, patchBranch);
router.delete("/:id", authMiddleware, removeBranch);

export default router;

