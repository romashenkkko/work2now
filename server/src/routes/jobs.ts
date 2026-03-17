import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  getJobCategoriesController,
  getRaioaneController,
  listJobsController,
  createJobController,
  deleteJobController,
  setPromotedController,
  getMyApplicationsController,
  getMyApplicationsListController,
  applyToJobController,
  getApplicationsController,
  confirmCompletionController,
  checkInController,
  checkOutController,
  getStatisticsController,
  setApplicationStatusController,
  getAdminStatisticsController,
} from "../controllers/jobsController";

const router = Router();

/** GET /api/jobs/categories - Get all job categories with minimum hourly rates */
router.get("/categories", getJobCategoriesController);

/** GET /api/jobs/raioane - list/search raioane (districts/municipalities) */
router.get("/raioane", getRaioaneController);

/** GET /api/jobs - customer: own jobs; staff/admin: all jobs */
router.get("/", authMiddleware, listJobsController);

/** POST /api/jobs - create job (customer only) */
router.post("/", authMiddleware, createJobController);

/** DELETE /api/jobs/:id - delete job (customer, own jobs only) */
router.delete("/:id", authMiddleware, deleteJobController);

/** PATCH /api/jobs/:id/promote - customer/admin: set job as promoted (booster) or not */
router.patch("/:id/promote", authMiddleware, setPromotedController);

/** GET /api/jobs/my-applications - staff: my application status per job */
router.get("/my-applications", authMiddleware, getMyApplicationsController);

/** GET /api/jobs/my-applications/list - staff: full applications history with job details + sessions + rating */
router.get("/my-applications/list", authMiddleware, getMyApplicationsListController);

/** POST /api/jobs/:id/apply - staff applies to job */
router.post("/:id/apply", authMiddleware, applyToJobController);

/** GET /api/jobs/applications - customer: applications for their jobs */
router.get("/applications", authMiddleware, getApplicationsController);

/** PATCH /api/jobs/applications/:id/confirm-completion - customer: confirm job finished */
router.patch("/applications/:id/confirm-completion", authMiddleware, confirmCompletionController);

/** PATCH /api/jobs/applications/:id/check-in - staff: check-in */
router.patch("/applications/:id/check-in", authMiddleware, checkInController);

/** PATCH /api/jobs/applications/:id/check-out - staff: check-out */
router.patch("/applications/:id/check-out", authMiddleware, checkOutController);

/** GET /api/jobs/statistics - customer: general statistics */
router.get("/statistics", authMiddleware, getStatisticsController);

/** PATCH /api/jobs/applications/:id - customer: accept/refuse application */
router.patch("/applications/:id", authMiddleware, setApplicationStatusController);

/** GET /api/jobs/admin/statistics - admin only: platform statistics */
router.get("/admin/statistics", authMiddleware, getAdminStatisticsController);

export default router;
