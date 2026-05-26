import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { uploadJobImage, uploadJobAttachment } from "../middleware/upload";
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
  postUploadJobImageController,
  getJobMediaController,
  postUploadJobAttachmentController,
  getJobAttachmentController,
  publishAndReserveController,
  getJobPaymentReservationController,
  retryJobPaymentReservationController,
} from "../controllers/jobsController";

const router = Router();

/** GET /api/jobs/categories - Get all job categories with minimum hourly rates */
router.get("/categories", getJobCategoriesController);

/** GET /api/jobs/raioane - list/search raioane (districts/municipalities) */
router.get("/raioane", getRaioaneController);

/** Public job image files (UUID filenames; no auth — <img> must load without token) */
router.get("/media/:filename", getJobMediaController);

/** Public job attachment files (same pattern as images; link from job card) */
router.get("/attachments/:filename", getJobAttachmentController);

/** POST /api/jobs/upload-image - customer/business: upload one image for job cover or gallery */
router.post("/upload-image", authMiddleware, (req, res, next) => {
  uploadJobImage(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      res.status(400).json({ error: msg });
      return;
    }
    next();
  });
}, postUploadJobImageController);

/** POST /api/jobs/upload-attachment - customer/business: PDF/Word/Excel/image for job details */
router.post("/upload-attachment", authMiddleware, (req, res, next) => {
  uploadJobAttachment(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      res.status(400).json({ error: msg });
      return;
    }
    next();
  });
}, postUploadJobAttachmentController);

/** GET /api/jobs - customer: own jobs; staff/admin: all jobs */
router.get("/", authMiddleware, listJobsController);

/** POST /api/jobs - create job (customer only) */
router.post("/", authMiddleware, createJobController);

/** POST /api/jobs/:id/publish-and-reserve - customer: Draft job → Paynet reservation (job stays Draft until webhook confirms reserved → Open) */
router.post("/:id/publish-and-reserve", authMiddleware, publishAndReserveController);

/** GET /api/jobs/:id/payment-reservation - customer: reservation + publish status for polling */
router.get("/:id/payment-reservation", authMiddleware, getJobPaymentReservationController);

/** POST /api/jobs/:id/payment-reservation/retry - customer: retry Paynet submit for reserve_pending */
router.post("/:id/payment-reservation/retry", authMiddleware, retryJobPaymentReservationController);

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
