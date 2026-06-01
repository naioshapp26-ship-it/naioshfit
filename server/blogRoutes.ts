import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import type { User } from "@shared/schema";
import { isPlatformAdminRole } from "@shared/roleAccess";
import { uploadsDir } from "./filesReportsRoutes";

const router = Router();

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: "Not authenticated" });
};

const requireAdminOrCoach = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as User | undefined;
  if (!user || !(user.role === "coach" || isPlatformAdminRole(user.role))) {
    return res.status(403).json({ message: "Access denied" });
  }
  return next();
};

const blogUploadsDir = path.join(uploadsDir, "blog");
try {
  fs.mkdirSync(blogUploadsDir, { recursive: true });
} catch (error) {
  console.error("[BLOG] Failed to create blog uploads directory:", error);
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, blogUploadsDir),
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${sanitized || "blog-image"}`);
  },
});

const imageUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    return cb(null, true);
  },
});

router.post(
  "/blog/uploads",
  isAuthenticated,
  requireAdminOrCoach,
  imageUpload.single("file"),
  (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const absoluteUrl = new URL(`/uploads/blog/${file.filename}`, `${req.protocol}://${req.get("host")}`).toString();
    return res.json({ url: absoluteUrl });
  }
);

export default router;
