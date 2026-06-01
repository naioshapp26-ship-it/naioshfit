/**
 * Files & Reports Routes - Epic D Implementation
 * Handles file uploads, management, and progress reports
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db } from './db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, desc, or, gte, lte, sql, type SQL, between, inArray } from 'drizzle-orm';
import {
  uploadedFiles,
  reports,
  progressSnapshots,
  users,
  dailyStats,
  weeklyStats,
  meals,
  workouts,
  workoutSessions,
  supplementEffectivenessRatings,
  supplementSideEffects,
  insertUploadedFileSchema,
  insertReportSchema,
  insertProgressSnapshotSchema,
  type User,
} from "@shared/schema";
import { isPlatformAdminRole } from "@shared/roleAccess";
import * as schema from "@shared/schema";
import { z } from "zod";
import OpenAI from "openai";
import { getAiFeatureConfig, getAiSettingsForRequest } from "./aiSettings";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { buildScopeFromRequest, consumeCredits, getOrCreateAccountWithBalance } from "./services/creditBilling";
import { getInsufficientCreditsMessage, getRequestLanguage } from "./utils/i18n";

// Authentication middleware
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Not authenticated" });
};

// Role-based access control helpers
const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User;
    const hasAllowedRole = !!user && (
      allowedRoles.includes(user.role) ||
      (allowedRoles.includes('admin') && isPlatformAdminRole(user.role))
    );
    if (!hasAllowedRole) {
      return res.status(403).json({ 
        message: `Access denied. Required role: ${allowedRoles.join(', ')}` 
      });
    }
    next();
  };
};

const requireAdmin = requireRole(['admin']);
const requireAdminOrCoach = requireRole(['admin', 'coach']);

const resolveDb = (req: Request) => {
  const tenantPool = (req as any)?.tenantPool;
  if (tenantPool) {
    return drizzle(tenantPool, { schema });
  }
  return db;
};

/**
 * Check if user can access another user's data
 */
async function canAccessUser(viewer: User, targetUserId: number, database: any): Promise<boolean> {
  // Admins can access anyone
  if (isPlatformAdminRole(viewer.role)) return true;
  
  // Users can always access their own files
  if (viewer.id === targetUserId) return true;
  
  // Coaches can access their trainees
  if (viewer.role === 'coach') {
    const targetUser = await database.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });
    return targetUser?.coachId === viewer.id;
  }
  
  // Gyms can access their members
  if (viewer.role === 'gym') {
    const targetUser = await database.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });
    if (targetUser?.gymId === viewer.id) return true;
  }
  
  return false;
}

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  progress_photo: 50 * 1024 * 1024, // 50MB
  image: 50 * 1024 * 1024, // 50MB
  medical_report: 20 * 1024 * 1024, // 20MB
  pdf: 20 * 1024 * 1024, // 20MB
  excel: 10 * 1024 * 1024, // 10MB
  video: 200 * 1024 * 1024, // 200MB
  other: 10 * 1024 * 1024, // 10MB
};

// Allowed MIME types
const ALLOWED_MIME_TYPES = {
  progress_photo: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  medical_report: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
  pdf: ['application/pdf'],
  excel: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
  other: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
};

export const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch (error) {
  console.error('[FILES] Failed to create uploads directory:', error);
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${sanitized || 'upload'}`);
  },
});

const uploadMiddleware = multer({
  storage: uploadStorage,
  limits: { fileSize: FILE_SIZE_LIMITS.video },
});

const getRequestBaseUrl = (req: Request) => {
  const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const proto = forwardedProto || req.protocol || "https";
  const host = req.get("host") || "localhost";
  return `${proto}://${host}`;
};

const removeTempFile = async (filepath?: string) => {
  if (!filepath) return;
  try {
    await fs.promises.unlink(filepath);
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      console.error('[FILES] Failed to remove temporary upload:', error);
    }
  }
};

export default function setupFilesReportsRoutes(app: Express) {
  
  // ============================================================================
  // D1: FILE MANAGEMENT (إدارة الملفات)
  // ============================================================================
  app.post('/api/files/upload', isAuthenticated, uploadMiddleware.single('file'), async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "File is required" });
      }

      const fileType = (req.body.fileType as string) || 'other';
      if (!(fileType in FILE_SIZE_LIMITS)) {
        await removeTempFile(file.path);
        return res.status(400).json({ message: "Invalid file type" });
      }

      const targetUserId = req.body.userId ? parseInt(req.body.userId, 10) : user.id;
      if (!Number.isFinite(targetUserId)) {
        await removeTempFile(file.path);
        return res.status(400).json({ message: "Invalid user" });
      }

      const hasAccess = await canAccessUser(user, targetUserId, database);
      if (!hasAccess) {
        await removeTempFile(file.path);
        return res.status(403).json({ message: "Access denied" });
      }

      const maxSize = FILE_SIZE_LIMITS[fileType as keyof typeof FILE_SIZE_LIMITS] || FILE_SIZE_LIMITS.other;
      if (file.size > maxSize) {
        await removeTempFile(file.path);
        return res.status(400).json({ message: `File size exceeds limit for ${fileType}` });
      }

      const allowedTypes = ALLOWED_MIME_TYPES[fileType as keyof typeof ALLOWED_MIME_TYPES] || [];
      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        await removeTempFile(file.path);
        return res.status(400).json({ message: `Invalid MIME type for ${fileType}` });
      }

      const visibility = (req.body.visibility as string) || 'private';
      if (!['private', 'coach_visible', 'admin_visible'].includes(visibility)) {
        await removeTempFile(file.path);
        return res.status(400).json({ message: "Invalid visibility" });
      }

      const parseTags = (value: unknown) => {
        if (typeof value !== 'string' || !value.trim()) return null;
        try {
          const asJson = JSON.parse(value);
          if (Array.isArray(asJson)) {
            return asJson.map((tag) => String(tag).trim()).filter(Boolean);
          }
        } catch {}
        return value
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
      };

      const tags = parseTags(req.body.tags);
      const description = typeof req.body.description === 'string' ? req.body.description : undefined;
      const descriptionAr = typeof req.body.descriptionAr === 'string' ? req.body.descriptionAr : undefined;

      const absoluteUrl = new URL(`/uploads/${file.filename}`, getRequestBaseUrl(req)).toString();

      const payload = insertUploadedFileSchema.parse({
        userId: targetUserId,
        fileType,
        fileName: file.originalname,
        fileUrl: absoluteUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        visibility,
        tags,
        description,
        descriptionAr,
        virusScanStatus: 'pending',
        coachId: (user.role === 'coach' || (user.role === 'admin' || user.role === 'super_admin')) ? user.id : undefined,
      });

      const [created] = await database.insert(uploadedFiles)
        .values(payload)
        .returning();

      if (user?.role === 'user') {
        try {
          const scope = buildScopeFromRequest(req);
          await getOrCreateAccountWithBalance(scope, user.id);

          const consumeResult = await consumeCredits(scope, {
            userId: user.id,
            actionKey: 'files_upload',
          });

          if ('insufficient' in consumeResult) {
            await database.delete(uploadedFiles).where(eq(uploadedFiles.id, created.id));
            await removeTempFile(file.path);
            const language = getRequestLanguage(req);
            return res.status(402).json({ message: getInsufficientCreditsMessage(language), balance: consumeResult.balance });
          }
        } catch (creditError) {
          await database.delete(uploadedFiles).where(eq(uploadedFiles.id, created.id));
          await removeTempFile(file.path);
          console.error('Error consuming credits for file upload:', creditError);
          return res.status(500).json({ message: 'Failed to consume credits' });
        }
      }

      return res.status(201).json({ file: created });
    } catch (error: any) {
      await removeTempFile(req.file?.path);
      console.error('Error uploading file:', error);
      return res.status(500).json({ message: "Failed to upload file", error: error.message });
    }
  });
  
  /**
   * GET /api/files
   * Get user's uploaded files
   * Access: User (themselves), Coach (their trainees), Admin
   */
  app.get('/api/files', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const { userId, fileType, visibility } = req.query;
      
      let targetUserId = userId ? parseInt(userId as string) : null;
      let conditions: SQL[] = [];
      
      if (targetUserId) {
        // Specific user requested
        const hasAccess = await canAccessUser(user, targetUserId, database);
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
        conditions.push(eq(uploadedFiles.userId, targetUserId));
      } else {
        // No specific user requested
        if (user.role === 'coach') {
          // Show all files for coach's trainees
          const trainees = await database.query.users.findMany({
            where: eq(users.coachId, user.id),
            columns: { id: true },
          });
          const traineeIds = trainees.map(t => t.id);
          if (traineeIds.length === 0) {
            return res.json({ files: [] });
          }
          conditions.push(inArray(uploadedFiles.userId, traineeIds));
        } else {
          // Default to own files
          targetUserId = user.id;
          conditions.push(eq(uploadedFiles.userId, targetUserId));
        }
      }
      
      if (fileType) {
        conditions.push(eq(uploadedFiles.fileType, fileType as string));
      }
      
      // Apply visibility filters based on role
      if (user.role === 'user') {
        // Users see all their own files
      } else if (user.role === 'coach') {
        // Coaches see coach_visible and admin_visible files
        conditions.push(
          or(
            eq(uploadedFiles.visibility, 'coach_visible'),
            eq(uploadedFiles.visibility, 'admin_visible')
          )!
        );
      }
      // Admins see all
      
      if (visibility && (user.role === 'admin' || user.role === 'super_admin')) {
        conditions.push(eq(uploadedFiles.visibility, visibility as string));
      }
      
      const files = await database.query.uploadedFiles.findMany({
        where: and(...conditions),
        orderBy: desc(uploadedFiles.uploadDate),
        limit: 100,
      });

      // When a coach/admin views files, include uploader info for clarity
      if ((user.role === 'coach' || (user.role === 'admin' || user.role === 'super_admin')) && files.length > 0) {
        const userIds = [...new Set(files.map(f => f.userId))];
        const uploaders = await database.query.users.findMany({
          where: inArray(users.id, userIds),
          columns: { id: true, firstName: true, lastName: true },
        });
        const uploaderMap = new Map(uploaders.map(u => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
        const filesWithUploader = files.map(f => ({
          ...f,
          uploaderName: uploaderMap.get(f.userId) || 'Unknown user',
        }));
        return res.json({ files: filesWithUploader });
      }
      
      res.json({ files });
    } catch (error: any) {
      console.error('Error fetching files:', error);
      res.status(500).json({ message: "Failed to fetch files", error: error.message });
    }
  });
  
  /**
   * POST /api/files
   * Upload a new file (metadata only - actual upload handled by client to storage)
   * Access: User (for themselves), Coach (for trainees), Admin
   */
  app.post('/api/files', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const fileData = insertUploadedFileSchema.parse(req.body);
      
      // Check access
      if ((user.role !== 'admin' && user.role !== 'super_admin') && user.role !== 'coach' && fileData.userId !== user.id) {
        return res.status(403).json({ message: "You can only upload files for yourself" });
      }
      
      if (user.role === 'coach') {
        const hasAccess = await canAccessUser(user, fileData.userId, database);
        if (!hasAccess) {
          return res.status(403).json({ message: "You can only upload files for your trainees" });
        }
      }
      
      // Validate file size
      const maxSize = FILE_SIZE_LIMITS[fileData.fileType as keyof typeof FILE_SIZE_LIMITS] || FILE_SIZE_LIMITS.other;
      if (fileData.fileSize > maxSize) {
        return res.status(400).json({ 
          message: `File size exceeds limit of ${maxSize / (1024 * 1024)}MB for ${fileData.fileType}` 
        });
      }
      
      // Validate MIME type
      const allowedTypes = ALLOWED_MIME_TYPES[fileData.fileType as keyof typeof ALLOWED_MIME_TYPES] || [];
      if (allowedTypes.length > 0 && !allowedTypes.includes(fileData.mimeType)) {
        return res.status(400).json({ 
          message: `Invalid file type. Allowed types for ${fileData.fileType}: ${allowedTypes.join(', ')}` 
        });
      }
      
      // Set coach ID if coach is uploading
      if (user.role === 'coach' || (user.role === 'admin' || user.role === 'super_admin')) {
        fileData.coachId = user.id;
      }
      
      const [newFile] = await database.insert(uploadedFiles)
        .values(fileData)
        .returning();

      if (user?.role === 'user') {
        try {
          const scope = buildScopeFromRequest(req);
          await getOrCreateAccountWithBalance(scope, user.id);

          const consumeResult = await consumeCredits(scope, {
            userId: user.id,
            actionKey: 'files_upload',
          });

          if ('insufficient' in consumeResult) {
            await database.delete(uploadedFiles).where(eq(uploadedFiles.id, newFile.id));
            const language = getRequestLanguage(req);
            return res.status(402).json({ message: getInsufficientCreditsMessage(language), balance: consumeResult.balance });
          }
        } catch (creditError) {
          await database.delete(uploadedFiles).where(eq(uploadedFiles.id, newFile.id));
          console.error('Error consuming credits for file upload:', creditError);
          return res.status(500).json({ message: 'Failed to consume credits' });
        }
      }
      
      res.status(201).json(newFile);
    } catch (error: any) {
      console.error('Error uploading file:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to upload file", error: error.message });
    }
  });
  
  /**
   * GET /api/files/:id
   * Get file details
   * Access: User (their own), Coach (trainee files with visibility), Admin
   */
  app.get('/api/files/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const fileId = parseInt(req.params.id);
      
      const file = await database.query.uploadedFiles.findFirst({
        where: eq(uploadedFiles.id, fileId),
      });
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check access
      const hasAccess = await canAccessUser(user, file.userId, database);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check visibility for coaches
      if (user.role === 'coach' && user.id !== file.userId) {
        if (file.visibility === 'private') {
          return res.status(403).json({ message: "This file is private" });
        }
      }
      
      res.json(file);
    } catch (error: any) {
      console.error('Error fetching file:', error);
      res.status(500).json({ message: "Failed to fetch file", error: error.message });
    }
  });
  
  /**
   * PUT /api/files/:id
   * Update file metadata
   * Access: User (their own), Coach (trainee files), Admin
   */
  app.put('/api/files/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const fileId = parseInt(req.params.id);
      
      const file = await database.query.uploadedFiles.findFirst({
        where: eq(uploadedFiles.id, fileId),
      });
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check access
      if ((user.role !== 'admin' && user.role !== 'super_admin') && file.userId !== user.id) {
        const hasAccess = await canAccessUser(user, file.userId, database);
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const updateData = insertUploadedFileSchema.partial().parse(req.body);
      
      const [updated] = await database.update(uploadedFiles)
        .set(updateData)
        .where(eq(uploadedFiles.id, fileId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating file:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update file", error: error.message });
    }
  });
  
  /**
   * DELETE /api/files/:id
   * Delete file
   * Access: User (their own), Coach (trainee files), Admin
   */
  app.delete('/api/files/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const fileId = parseInt(req.params.id);
      
      const file = await database.query.uploadedFiles.findFirst({
        where: eq(uploadedFiles.id, fileId),
      });
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // Check access
      if ((user.role !== 'admin' && user.role !== 'super_admin') && file.userId !== user.id) {
        const hasAccess = await canAccessUser(user, file.userId, database);
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      await database.delete(uploadedFiles)
        .where(eq(uploadedFiles.id, fileId));
      
      res.json({ message: "File deleted successfully" });
    } catch (error: any) {
      console.error('Error deleting file:', error);
      res.status(500).json({ message: "Failed to delete file", error: error.message });
    }
  });
  
  // ============================================================================
  // D2: PROGRESS SNAPSHOTS (Weight & Measurements)
  // ============================================================================
  
  /**
   * GET /api/progress-snapshots
   * Get progress snapshots for a user
   * Access: User (themselves), Coach (their trainees), Admin
   */
  app.get('/api/progress-snapshots', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const { userId, startDate, endDate } = req.query;
      
      const targetUserId = userId ? parseInt(userId as string) : user.id;
      
      // Check access
      const hasAccess = await canAccessUser(user, targetUserId, database);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      let conditions: SQL[] = [eq(progressSnapshots.userId, targetUserId)];
      
      if (startDate) {
        conditions.push(gte(progressSnapshots.recordDate, new Date(startDate as string)));
      }
      
      if (endDate) {
        conditions.push(lte(progressSnapshots.recordDate, new Date(endDate as string)));
      }
      
      const snapshots = await database.query.progressSnapshots.findMany({
        where: and(...conditions),
        orderBy: desc(progressSnapshots.recordDate),
      });
      
      res.json({ snapshots });
    } catch (error: any) {
      console.error('Error fetching progress snapshots:', error);
      res.status(500).json({ message: "Failed to fetch snapshots", error: error.message });
    }
  });
  
  /**
   * POST /api/progress-snapshots
   * Create progress snapshot
   * Access: User (for themselves), Coach (for trainees), Admin
   */
  app.post('/api/progress-snapshots', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const snapshotData = insertProgressSnapshotSchema.parse(req.body);
      
      // Check access
      if ((user.role !== 'admin' && user.role !== 'super_admin') && user.role !== 'coach' && snapshotData.userId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (user.role === 'coach') {
        const hasAccess = await canAccessUser(user, snapshotData.userId, database);
        if (!hasAccess) {
          return res.status(403).json({ message: "You can only create snapshots for your trainees" });
        }
      }
      
      // Convert recordDate to Date if string
      if (typeof snapshotData.recordDate === 'string') {
        snapshotData.recordDate = new Date(snapshotData.recordDate);
      }
      
      const [newSnapshot] = await database.insert(progressSnapshots)
        .values(snapshotData)
        .returning();
      
      res.status(201).json(newSnapshot);
    } catch (error: any) {
      console.error('Error creating snapshot:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create snapshot", error: error.message });
    }
  });
  
  // ============================================================================
  // D2: REPORTS (Weekly/Monthly/Custom)
  // ============================================================================
  
  /**
   * GET /api/reports
   * Get user's reports
   * Access: User (themselves), Coach (their trainees), Admin
   */
  app.get('/api/reports', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const { userId, reportType } = req.query;
      
      const targetUserId = userId ? parseInt(userId as string) : user.id;
      
      // Check access
      const hasAccess = await canAccessUser(user, targetUserId, database);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      let conditions: SQL[] = [eq(reports.userId, targetUserId)];
      
      if (reportType) {
        conditions.push(eq(reports.reportType, reportType as string));
      }
      
      const userReports = await database.query.reports.findMany({
        where: and(...conditions),
        orderBy: desc(reports.createdAt),
        limit: 50,
      });
      
      res.json({ reports: userReports });
    } catch (error: any) {
      console.error('Error fetching reports:', error);
      res.status(500).json({ message: "Failed to fetch reports", error: error.message });
    }
  });
  
  /**
   * POST /api/reports/generate
   * Generate a new report for a user
   * Access: User (for themselves), Coach (for trainees), Admin
   */
  app.post('/api/reports/generate', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const { userId, reportType, periodStart, periodEnd } = req.body;
      
      const targetUserId = userId || user.id;
      
      // Check access
      if ((user.role !== 'admin' && user.role !== 'super_admin') && user.role !== 'coach' && targetUserId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (user.role === 'coach') {
        const hasAccess = await canAccessUser(user, targetUserId, database);
        if (!hasAccess) {
          return res.status(403).json({ message: "You can only generate reports for your trainees" });
        }
      }
      
      const startDate = new Date(periodStart);
      const endDate = new Date(periodEnd);
      
      // Gather report data from various sources
      const reportData: any = {
        period: { start: startDate, end: endDate },
        generated: new Date(),
        generatedBy: user.id,
      };
      
      // 1. Weight & Measurements (from progress_snapshots)
      const progressData = await database.query.progressSnapshots.findMany({
        where: and(
          eq(progressSnapshots.userId, targetUserId),
          between(progressSnapshots.recordDate, startDate, endDate)
        ),
        orderBy: progressSnapshots.recordDate,
      });
      
      reportData.progress = {
        snapshots: progressData,
        weightChange: progressData.length >= 2 
          ? (progressData[progressData.length - 1].weight || 0) - (progressData[0].weight || 0)
          : null,
      };
      
      // 2. Daily/Weekly Stats
      const stats = await database.query.dailyStats.findMany({
        where: and(
          eq(dailyStats.userId, targetUserId),
          between(dailyStats.date, startDate, endDate)
        ),
        orderBy: dailyStats.date,
      });
      
      reportData.stats = {
        dailyStats: stats,
        totals: {
          workouts: stats.reduce((sum, s) => sum + (s.workoutsCompleted || 0), 0),
          calories: stats.reduce((sum, s) => sum + (s.calories || 0), 0) / (stats.length || 1),
          protein: stats.reduce((sum, s) => sum + (s.protein || 0), 0) / (stats.length || 1),
        },
      };
      
      // 3. Workout data
      const workoutData = await database.query.workoutSessions.findMany({
        where: and(
          eq(workoutSessions.userId, targetUserId),
          between(workoutSessions.completedAt, startDate, endDate)
        ),
        limit: 100,
      });
      
      reportData.workouts = {
        count: workoutData.length,
        types: workoutData.reduce((acc: any, w) => {
          acc[w.workoutType || 'other'] = (acc[w.workoutType || 'other'] || 0) + 1;
          return acc;
        }, {}),
      };
      
      // 4. Meal data
      const mealData = await database.query.meals.findMany({
        where: and(
          eq(meals.userId, targetUserId),
          between(meals.date, startDate, endDate)
        ),
        limit: 100,
      });
      
      reportData.nutrition = {
        mealsLogged: mealData.length,
        averageCalories: mealData.reduce((sum, m) => sum + (m.calories || 0), 0) / (mealData.length || 1),
      };
      
      // 5. Supplement adherence
      const supplementRatings = await database.query.supplementEffectivenessRatings.findMany({
        where: and(
          eq(supplementEffectivenessRatings.userId, targetUserId),
          between(supplementEffectivenessRatings.createdAt, startDate, endDate)
        ),
      });
      
      reportData.supplements = {
        ratingsCount: supplementRatings.length,
        averageRating: supplementRatings.length > 0
          ? supplementRatings.reduce((sum, r) => sum + r.rating, 0) / supplementRatings.length
          : null,
      };
      
      // 6. Side effects
      const sideEffects = await database.query.supplementSideEffects.findMany({
        where: and(
          eq(supplementSideEffects.userId, targetUserId),
          between(supplementSideEffects.createdAt, startDate, endDate)
        ),
      });
      
      reportData.sideEffects = {
        count: sideEffects.length,
        bySeverity: sideEffects.reduce((acc: any, se) => {
          acc[se.severity] = (acc[se.severity] || 0) + 1;
          return acc;
        }, {}),
      };
      
      // Create report record
      const [newReport] = await database.insert(reports).values({
        userId: targetUserId,
        reportType: reportType || 'custom',
        periodStart: startDate,
        periodEnd: endDate,
        generatedBy: user.id,
        reportData,
      }).returning();
      
      res.status(201).json(newReport);
    } catch (error: any) {
      console.error('Error generating report:', error);
      res.status(500).json({ message: "Failed to generate report", error: error.message });
    }
  });
  
  /**
   * GET /api/reports/:id
   * Get specific report
   * Access: User (their own), Coach (trainee reports), Admin
   */
  app.get('/api/reports/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const reportId = parseInt(req.params.id);
      
      const report = await database.query.reports.findFirst({
        where: eq(reports.id, reportId),
      });
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Check access
      const hasAccess = await canAccessUser(user, report.userId, database);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(report);
    } catch (error: any) {
      console.error('Error fetching report:', error);
      res.status(500).json({ message: "Failed to fetch report", error: error.message });
    }
  });
  
  /**
   * GET /api/coach/reports/comparison
   * Compare progress across multiple trainees
   * Access: Coach, Admin
   */
  app.get('/api/coach/reports/comparison', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const { startDate, endDate, metric } = req.query;
      
      // Get coach's trainees
      let traineeIds: number[] = [];
      
      if (user.role === 'coach') {
        const trainees = await database.query.users.findMany({
          where: eq(users.coachId, user.id),
          columns: { id: true, firstName: true, lastName: true },
        });
        traineeIds = trainees.map(t => t.id);
      } else if ((user.role === 'admin' || user.role === 'super_admin')) {
        // Admin can see all users - limit to reasonable number
        const allUsers = await database.query.users.findMany({
          where: eq(users.role, 'user'),
          columns: { id: true, firstName: true, lastName: true },
          limit: 50,
        });
        traineeIds = allUsers.map(u => u.id);
      }
      
      if (traineeIds.length === 0) {
        return res.json({ comparison: [] });
      }
      
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      // Gather comparison data per trainee
      const comparison = await Promise.all(
        traineeIds.map(async (traineeId) => {
          const trainee = await database.query.users.findFirst({
            where: eq(users.id, traineeId),
            columns: { id: true, firstName: true, lastName: true },
          });
          
          const progressData = await database.query.progressSnapshots.findMany({
            where: and(
              eq(progressSnapshots.userId, traineeId),
              between(progressSnapshots.recordDate, start, end)
            ),
            orderBy: progressSnapshots.recordDate,
          });
          
          const stats = await database.query.dailyStats.findMany({
            where: and(
              eq(dailyStats.userId, traineeId),
              between(dailyStats.date, start, end)
            ),
          });
          
          return {
            trainee,
            metrics: {
              weightChange: progressData.length >= 2 
                ? (progressData[progressData.length - 1].weight || 0) - (progressData[0].weight || 0)
                : null,
              workoutsCompleted: stats.reduce((sum, s) => sum + (s.workoutsCompleted || 0), 0),
              avgCalories: stats.length > 0
                ? stats.reduce((sum, s) => sum + (s.calories || 0), 0) / stats.length
                : null,
            },
          };
        })
      );
      
      res.json({ comparison, period: { start, end } });
    } catch (error: any) {
      console.error('Error generating comparison:', error);
      res.status(500).json({ message: "Failed to generate comparison", error: error.message });
    }
  });

  /**
   * POST /api/reports/generate-ai
   * Generate a comprehensive AI-powered report for a user
   * Access: User (for themselves), Coach (for trainees), Admin
   */
  app.post('/api/reports/generate-ai', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const database = resolveDb(req);
      const { userId, periodDays = 30, language = 'en' } = req.body;
      
      const targetUserId = userId || user.id;
      
      // Check access
      if ((user.role !== 'admin' && user.role !== 'super_admin') && user.role !== 'coach' && targetUserId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (user.role === 'coach') {
        const hasAccess = await canAccessUser(user, targetUserId, database);
        if (!hasAccess) {
          return res.status(403).json({ message: "You can only generate reports for your trainees" });
        }
      }

      // Get target user details
      const targetUser = await database.query.users.findFirst({
        where: eq(users.id, targetUserId),
      });

      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const endDate = new Date();
      const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
      
      // Gather comprehensive data from various sources
      const reportData: any = {
        period: { start: startDate, end: endDate },
        generated: new Date(),
        generatedBy: user.id,
        user: {
          id: targetUser.id,
          name: `${targetUser.firstName} ${targetUser.lastName}`,
          age: targetUser.age,
          gender: targetUser.gender,
          height: targetUser.height,
          weight: targetUser.weight,
          goalWeight: targetUser.goalWeight,
          fitnessGoal: targetUser.fitnessGoal,
          trainingLevel: targetUser.trainingLevel,
        },
      };
      
      // 1. Progress data (weight & measurements)
      const progressData = await database.query.progressSnapshots.findMany({
        where: and(
          eq(progressSnapshots.userId, targetUserId),
          between(progressSnapshots.recordDate, startDate, endDate)
        ),
        orderBy: progressSnapshots.recordDate,
      });
      
      reportData.progress = {
        snapshots: progressData,
        weightChange: progressData.length >= 2 
          ? (progressData[progressData.length - 1].weight || 0) - (progressData[0].weight || 0)
          : null,
        totalMeasurements: progressData.length,
      };

      // 2. Daily/Weekly stats
      const stats = await database.query.dailyStats.findMany({
        where: and(
          eq(dailyStats.userId, targetUserId),
          between(dailyStats.date, startDate, endDate)
        ),
        orderBy: dailyStats.date,
        limit: 100,
      });
      
      reportData.stats = {
        dailyStats: stats,
        totals: {
          workoutsCompleted: stats.reduce((sum, s) => sum + (s.workoutsCompleted || 0), 0),
          totalCalories: stats.reduce((sum, s) => sum + (s.calories || 0), 0),
          averageCalories: stats.length > 0 
            ? stats.reduce((sum, s) => sum + (s.calories || 0), 0) / stats.length
            : 0,
          totalProtein: stats.reduce((sum, s) => sum + (s.protein || 0), 0),
          averageProtein: stats.length > 0
            ? stats.reduce((sum, s) => sum + (s.protein || 0), 0) / stats.length
            : 0,
        },
      };

      // 3. Workout data
      const workoutData = await database.query.workoutSessions.findMany({
        where: and(
          eq(workoutSessions.userId, targetUserId),
          between(workoutSessions.completedAt, startDate, endDate)
        ),
        limit: 100,
      });
      
      reportData.workouts = {
        count: workoutData.length,
        types: workoutData.reduce((acc: any, w) => {
          acc[w.workoutType || 'other'] = (acc[w.workoutType || 'other'] || 0) + 1;
          return acc;
        }, {}),
        details: workoutData.map(w => ({
          date: w.completedAt,
          type: w.workoutType,
          exercises: w.exercises,
        })),
      };

      // 4. Meal data
      const mealData = await database.query.meals.findMany({
        where: and(
          eq(meals.userId, targetUserId),
          between(meals.date, startDate, endDate)
        ),
        limit: 100,
      });
      
      reportData.nutrition = {
        mealsLogged: mealData.length,
        averageCalories: mealData.length > 0 
          ? mealData.reduce((sum, m) => sum + (m.calories || 0), 0) / mealData.length
          : 0,
        totalCalories: mealData.reduce((sum, m) => sum + (m.calories || 0), 0),
        meals: mealData.map(m => ({
          date: m.createdAt,
          mealType: m.mealType,
          calories: m.calories,
          protein: m.protein,
        })),
      };

      // 5. Supplement data
      const supplementRatings = await database.query.supplementEffectivenessRatings.findMany({
        where: and(
          eq(supplementEffectivenessRatings.userId, targetUserId),
          between(supplementEffectivenessRatings.createdAt, startDate, endDate)
        ),
      });
      
      reportData.supplements = {
        ratingsCount: supplementRatings.length,
        averageRating: supplementRatings.length > 0
          ? supplementRatings.reduce((sum, r) => sum + r.rating, 0) / supplementRatings.length
          : null,
      };

      // 6. Side effects
      const sideEffects = await database.query.supplementSideEffects.findMany({
        where: and(
          eq(supplementSideEffects.userId, targetUserId),
          between(supplementSideEffects.createdAt, startDate, endDate)
        ),
      });
      
      reportData.sideEffects = {
        count: sideEffects.length,
        bySeverity: sideEffects.reduce((acc: any, se) => {
          acc[se.severity] = (acc[se.severity] || 0) + 1;
          return acc;
        }, {}),
      };

      // Generate AI analysis if AI chat is configured
      let aiAnalysis = null;
      const aiSettings = await getAiSettingsForRequest(req);
      const chatConfig = getAiFeatureConfig(aiSettings, 'chat');
      if (chatConfig?.apiKey) {
        try {
          const openai = new OpenAI({ apiKey: chatConfig.apiKey });
          
          const languageInstruction = language === 'ar' 
            ? 'IMPORTANT: Generate the ENTIRE report in Arabic language only. All sections, headings, and content must be in Arabic.'
            : 'Generate the report in English language.';
          
          const prompt = `${languageInstruction}

You are a professional fitness coach and nutritionist. Generate a comprehensive, personalized progress report for a client based on the following data:

USER PROFILE:
- Name: ${reportData.user.name}
- Age: ${reportData.user.age || 'N/A'}
- Gender: ${reportData.user.gender || 'N/A'}
- Height: ${reportData.user.height || 'N/A'} cm
- Current Weight: ${reportData.user.weight || 'N/A'} kg
- Goal Weight: ${reportData.user.goalWeight || 'N/A'} kg
- Fitness Goal: ${reportData.user.fitnessGoal || 'N/A'}
- Training Level: ${reportData.user.trainingLevel || 'N/A'}

PERIOD: Last ${periodDays} days

PROGRESS DATA:
- Weight Change: ${reportData.progress.weightChange !== null ? reportData.progress.weightChange.toFixed(2) + ' kg' : 'No data'}
- Total Progress Measurements: ${reportData.progress.totalMeasurements}

ACTIVITY DATA:
- Workouts Completed: ${reportData.workouts.count}
- Workout Types: ${JSON.stringify(reportData.workouts.types)}
- Meals Logged: ${reportData.nutrition.mealsLogged}
- Average Daily Calories: ${reportData.stats.totals.averageCalories.toFixed(0)} kcal
- Average Daily Protein: ${reportData.stats.totals.averageProtein.toFixed(0)}g

SUPPLEMENTS:
- Effectiveness Ratings: ${reportData.supplements.ratingsCount}
- Average Rating: ${reportData.supplements.averageRating !== null ? reportData.supplements.averageRating.toFixed(1) + '/5' : 'N/A'}
- Side Effects Reported: ${reportData.sideEffects.count}

Please provide a comprehensive report with the following sections:

1. **Executive Summary**: Brief overview of the period's progress (2-3 sentences)

2. **Progress Analysis**: 
   - Analyze weight changes and body composition trends
   - Assess if they're on track with their goals
   - Highlight key achievements or concerns

3. **Activity & Training Assessment**:
   - Evaluate workout frequency and consistency
   - Comment on workout variety and types
   - Recommendations for training adjustments

4. **Nutrition Analysis**:
   - Assess meal logging consistency
   - Evaluate caloric and protein intake relative to goals
   - Identify potential gaps or areas for improvement

5. **Supplement & Health Monitoring**:
   - Review supplement effectiveness and adherence
   - Address any side effects concerns
   - Recommendations for supplement adjustments

6. **Key Recommendations**:
   - Top 3-5 specific, actionable recommendations for the next period
   - Short-term goals (next 2 weeks)
   - Long-term considerations

7. **Motivational Message**: 
   - Personalized encouragement based on their progress
   - Acknowledge their efforts and commitment

Format the report in a professional, encouraging, and constructive tone. Use markdown formatting for better readability.`;

          const completion = await openai.chat.completions.create({
            model: chatConfig.model || "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: language === 'ar'
                  ? "أنت مدرب لياقة بدنية وخبير تغذية محترف. قم بإنشاء تقارير تقدم شخصية مفصلة تكون ثاقبة ومحفزة. يجب كتابة جميع المحتوى باللغة العربية فقط."
                  : "You are an expert fitness coach and nutritionist who creates detailed, personalized progress reports that are both insightful and motivating."
              },
              {
                role: "user",
                content: prompt
              }
            ],
          });

          aiAnalysis = completion.choices[0]?.message?.content || null;
          reportData.aiAnalysis = aiAnalysis;
        } catch (aiError: any) {
          console.error('Error generating AI analysis:', aiError);
          reportData.aiAnalysisError = aiError.message;
        }
      }
      
      // Create report record
      const [newReport] = await database.insert(reports).values({
        userId: targetUserId,
        reportType: 'custom',
        periodStart: startDate,
        periodEnd: endDate,
        generatedBy: user.id,
        reportData,
      }).returning();
      
      res.status(201).json(newReport);
    } catch (error: any) {
      console.error('Error generating AI report:', error);
      res.status(500).json({ message: "Failed to generate AI report", error: error.message });
    }
  });
}
