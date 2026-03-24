import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";

const UPLOADS_DIR = path.join(__dirname, "../../uploads/cv");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const ALLOWED_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export const uploadCv = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and Word (.doc, .docx) files are allowed."));
    }
  },
}).single("cv");

// --- Imagini job (copertă + galerie) ---
const JOB_IMAGES_DIR = path.join(__dirname, "../../uploads/job-images");
if (!fs.existsSync(JOB_IMAGES_DIR)) {
  fs.mkdirSync(JOB_IMAGES_DIR, { recursive: true });
}

const jobImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, JOB_IMAGES_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    cb(null, `${randomUUID()}${safeExt}`);
  },
});

const JOB_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"];
const JOB_IMAGE_MAX = 5 * 1024 * 1024; // 5 MB

export const uploadJobImage = multer({
  storage: jobImageStorage,
  limits: { fileSize: JOB_IMAGE_MAX },
  fileFilter: (_req, file, cb) => {
    if (JOB_IMAGE_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Doar imagini JPEG, PNG sau WebP."));
    }
  },
}).single("image");
