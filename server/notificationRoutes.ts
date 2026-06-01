/**
 * Notifications & Reminders Routes - Epic C Implementation
 * Handles smart alerts, reminders, motivational messages, and achievements
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db } from './db';
import { eq, and, desc, or, gte, lte, sql, type SQL, isNull } from 'drizzle-orm';
import {
  notifications,
  reminderSettings,
  motivationalTemplates,
  achievements,
  missedWorkouts,
  supplementReminders,
  userPointsAndStreaks,
  workouts,
  users,
  insertNotificationSchema,
  insertReminderSettingSchema,
  insertMotivationalTemplateSchema,
  insertAchievementSchema,
  insertMissedWorkoutSchema,
  type User,
} from "@shared/schema";
import { isPlatformAdminRole } from "@shared/roleAccess";
import { z } from "zod";

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

/**
 * Check if user can access another user's data
 */
async function canAccessUser(viewer: User, targetUserId: number): Promise<boolean> {
  if (isPlatformAdminRole(viewer.role)) return true;
  
  if (viewer.role === 'coach') {
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });
    return targetUser?.coachId === viewer.id;
  }
  
  if (viewer.role === 'gym') {
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });
    if (targetUser?.gymId === viewer.id) return true;
  }
  
  return viewer.id === targetUserId;
}

export default function setupNotificationRoutes(app: Express) {
  
  // ============================================================================
  // NOTIFICATIONS - Unified System
  // ============================================================================
  
  /**
   * GET /api/notifications
   * Get user's notifications
   * Access: User (themselves), Admin, Coach (their trainees)
   */
  app.get('/api/notifications', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { type, status, unreadOnly } = req.query;
      
      let conditions: SQL[] = [eq(notifications.userId, user.id)];
      
      if (type) {
        conditions.push(eq(notifications.type, type as string));
      }
      
      if (status) {
        conditions.push(eq(notifications.status, status as string));
      }
      
      if (unreadOnly === 'true') {
        conditions.push(isNull(notifications.readAt));
      }
      
      const userNotifications = await db.query.notifications.findMany({
        where: and(...conditions),
        orderBy: desc(notifications.createdAt),
        limit: 100,
      });
      
      res.json({ notifications: userNotifications });
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: "Failed to fetch notifications", error: error.message });
    }
  });
  
  /**
   * POST /api/notifications
   * Create a notification (Admin/Coach only)
   * Access: Admin, Coach
   */
  app.post('/api/notifications', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const user = req.user as User;
      const notificationData = insertNotificationSchema.parse(req.body);
      
      // Check if coach can send to this user
      if (user.role === 'coach') {
        const hasAccess = await canAccessUser(user, notificationData.userId);
        if (!hasAccess) {
          return res.status(403).json({ message: "You can only send notifications to your trainees" });
        }
      }
      
      // Convert scheduledFor to Date if string
      if (notificationData.scheduledFor && typeof notificationData.scheduledFor === 'string') {
        notificationData.scheduledFor = new Date(notificationData.scheduledFor);
      }
      
      const [newNotification] = await db.insert(notifications)
        .values(notificationData)
        .returning();
      
      res.status(201).json(newNotification);
    } catch (error: any) {
      console.error('Error creating notification:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create notification", error: error.message });
    }
  });
  
  /**
   * PUT /api/notifications/:id/read
   * Mark notification as read
   * Access: User (their own)
   */
  app.put('/api/notifications/:id/read', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const notificationId = parseInt(req.params.id);
      
      const notification = await db.query.notifications.findFirst({
        where: eq(notifications.id, notificationId),
      });
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      if (notification.userId !== user.id && (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const [updated] = await db.update(notifications)
        .set({
          status: 'read',
          readAt: new Date(),
        })
        .where(eq(notifications.id, notificationId))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ message: "Failed to update notification", error: error.message });
    }
  });
  
  /**
   * DELETE /api/notifications/:id
   * Dismiss/delete notification
   * Access: User (their own)
   */
  app.delete('/api/notifications/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const notificationId = parseInt(req.params.id);
      
      const notification = await db.query.notifications.findFirst({
        where: eq(notifications.id, notificationId),
      });
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      if (notification.userId !== user.id && (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await db.update(notifications)
        .set({ status: 'dismissed' })
        .where(eq(notifications.id, notificationId));
      
      res.json({ message: "Notification dismissed" });
    } catch (error: any) {
      console.error('Error dismissing notification:', error);
      res.status(500).json({ message: "Failed to dismiss notification", error: error.message });
    }
  });
  
  // ============================================================================
  // C1, C2, C3, C4: REMINDER SETTINGS
  // ============================================================================
  
  /**
   * GET /api/reminder-settings
   * Get user's reminder settings
   * Access: User (themselves)
   */
  app.get('/api/reminder-settings', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      const settings = await db.query.reminderSettings.findMany({
        where: eq(reminderSettings.userId, user.id),
        orderBy: desc(reminderSettings.reminderType),
      });
      
      res.json({ settings });
    } catch (error: any) {
      console.error('Error fetching reminder settings:', error);
      res.status(500).json({ message: "Failed to fetch settings", error: error.message });
    }
  });
  
  /**
   * POST /api/reminder-settings
   * Create or update reminder settings
   * Access: User (themselves)
   */
  app.post('/api/reminder-settings', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const settingData = insertReminderSettingSchema.parse(req.body);
      
      // Force userId to current user
      settingData.userId = user.id;
      
      // Check if setting already exists
      const existing = await db.query.reminderSettings.findFirst({
        where: and(
          eq(reminderSettings.userId, user.id),
          eq(reminderSettings.reminderType, settingData.reminderType)
        ),
      });
      
      let result;
      if (existing) {
        // Update existing
        [result] = await db.update(reminderSettings)
          .set({
            ...settingData,
            updatedAt: new Date(),
          })
          .where(eq(reminderSettings.id, existing.id))
          .returning();
      } else {
        // Create new
        [result] = await db.insert(reminderSettings)
          .values(settingData)
          .returning();
      }
      
      res.status(existing ? 200 : 201).json(result);
    } catch (error: any) {
      console.error('Error saving reminder settings:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save settings", error: error.message });
    }
  });
  
  // ============================================================================
  // C5: MOTIVATIONAL MESSAGES
  // ============================================================================
  
  /**
   * GET /api/motivational-templates
   * Get motivational message templates
   * Access: Admin, Coach
   */
  app.get('/api/motivational-templates', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const { trigger, activeOnly } = req.query;
      
      let conditions: SQL[] = [];
      
      if (trigger) {
        conditions.push(eq(motivationalTemplates.trigger, trigger as string));
      }
      
      if (activeOnly === 'true') {
        conditions.push(eq(motivationalTemplates.isActive, true));
      }
      
      const templates = await db.query.motivationalTemplates.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(motivationalTemplates.priority), desc(motivationalTemplates.createdAt)],
      });
      
      res.json({ templates });
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ message: "Failed to fetch templates", error: error.message });
    }
  });
  
  /**
   * POST /api/motivational-templates
   * Create motivational template
   * Access: Admin only
   */
  app.post('/api/motivational-templates', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const user = req.user as User;
      const templateData = insertMotivationalTemplateSchema.parse(req.body);
      
      templateData.createdBy = user.id;
      
      const [newTemplate] = await db.insert(motivationalTemplates)
        .values(templateData)
        .returning();
      
      res.status(201).json(newTemplate);
    } catch (error: any) {
      console.error('Error creating template:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create template", error: error.message });
    }
  });
  
  /**
   * PUT /api/motivational-templates/:id
   * Update motivational template
   * Access: Admin only
   */
  app.put('/api/motivational-templates/:id', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const templateId = parseInt(req.params.id);
      const updateData = insertMotivationalTemplateSchema.partial().parse(req.body);
      
      updateData.updatedAt = new Date();
      
      const [updated] = await db.update(motivationalTemplates)
        .set(updateData)
        .where(eq(motivationalTemplates.id, templateId))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      console.error('Error updating template:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update template", error: error.message });
    }
  });
  
  // ============================================================================
  // C6: ACHIEVEMENTS
  // ============================================================================
  
  /**
   * GET /api/achievements
   * Get user's achievements
   * Access: User (themselves), Coach (their trainees), Admin
   */
  app.get('/api/achievements', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { userId, type } = req.query;
      
      const targetUserId = userId ? parseInt(userId as string) : user.id;
      
      // Check access
      const hasAccess = await canAccessUser(user, targetUserId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      let conditions: SQL[] = [eq(achievements.userId, targetUserId)];
      
      if (type) {
        conditions.push(eq(achievements.achievementType, type as string));
      }
      
      const userAchievements = await db.query.achievements.findMany({
        where: and(...conditions),
        orderBy: desc(achievements.achievedAt),
      });
      
      res.json({ achievements: userAchievements });
    } catch (error: any) {
      console.error('Error fetching achievements:', error);
      res.status(500).json({ message: "Failed to fetch achievements", error: error.message });
    }
  });
  
  /**
   * POST /api/achievements
   * Create/record achievement (System/Admin use)
   * Access: Admin
   */
  app.post('/api/achievements', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const achievementData = insertAchievementSchema.parse(req.body);
      
      const [newAchievement] = await db.insert(achievements)
        .values(achievementData)
        .returning();
      
      // Create notification for achievement
      await db.insert(notifications).values({
        userId: achievementData.userId,
        type: 'achievement',
        title: achievementData.title,
        titleAr: achievementData.titleAr,
        message: achievementData.description || `Congratulations! You've earned: ${achievementData.title}`,
        messageAr: achievementData.descriptionAr || `تهانينا! لقد حصلت على: ${achievementData.titleAr || achievementData.title}`,
        status: 'pending',
        relatedEntityType: 'achievement',
        relatedEntityId: newAchievement.id,
      });
      
      // Mark notification as sent
      await db.update(achievements)
        .set({ notificationSent: true })
        .where(eq(achievements.id, newAchievement.id));
      
      res.status(201).json(newAchievement);
    } catch (error: any) {
      console.error('Error creating achievement:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create achievement", error: error.message });
    }
  });
  
  /**
   * POST /api/achievements/check
   * Check and award achievements for a user (background task endpoint)
   * Access: Admin
   */
  app.post('/api/achievements/check', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "userId is required" });
      }
      
      const newAchievements: any[] = [];
      
      // Check workout streak achievement
      const streakData = await db.query.userPointsAndStreaks.findFirst({
        where: eq(userPointsAndStreaks.userId, userId),
      });
      
      if (streakData) {
        const milestones = [7, 14, 30, 60, 90, 180, 365];
        for (const milestone of milestones) {
          if (streakData.currentStreak >= milestone) {
            // Check if already awarded
            const existing = await db.query.achievements.findFirst({
              where: and(
                eq(achievements.userId, userId),
                eq(achievements.achievementType, 'workout_streak'),
                eq(achievements.value, milestone)
              ),
            });
            
            if (!existing) {
              const [achievement] = await db.insert(achievements).values({
                userId,
                achievementType: 'workout_streak',
                title: `${milestone}-Day Workout Streak!`,
                titleAr: `${milestone} يوم متتالية من التمارين!`,
                description: `Completed workouts for ${milestone} consecutive days`,
                descriptionAr: `أكملت التمارين لمدة ${milestone} يوم متتالية`,
                value: milestone,
              }).returning();
              
              newAchievements.push(achievement);
              
              // Create notification
              await db.insert(notifications).values({
                userId,
                type: 'achievement',
                title: achievement.title,
                titleAr: achievement.titleAr,
                message: achievement.description || '',
                messageAr: achievement.descriptionAr || '',
                status: 'pending',
                relatedEntityType: 'achievement',
                relatedEntityId: achievement.id,
              });
            }
          }
        }
      }
      
      res.json({ 
        message: `Checked achievements for user ${userId}`,
        newAchievements,
        count: newAchievements.length,
      });
    } catch (error: any) {
      console.error('Error checking achievements:', error);
      res.status(500).json({ message: "Failed to check achievements", error: error.message });
    }
  });
  
  // ============================================================================
  // C2: MISSED WORKOUTS
  // ============================================================================
  
  /**
   * GET /api/missed-workouts
   * Get missed workouts for a user
   * Access: User (themselves), Coach (their trainees), Admin
   */
  app.get('/api/missed-workouts', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const { userId } = req.query;
      
      const targetUserId = userId ? parseInt(userId as string) : user.id;
      
      // Check access
      const hasAccess = await canAccessUser(user, targetUserId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const missed = await db.query.missedWorkouts.findMany({
        where: eq(missedWorkouts.userId, targetUserId),
        orderBy: desc(missedWorkouts.scheduledDate),
        limit: 50,
      });
      
      res.json({ missedWorkouts: missed });
    } catch (error: any) {
      console.error('Error fetching missed workouts:', error);
      res.status(500).json({ message: "Failed to fetch missed workouts", error: error.message });
    }
  });
  
  /**
   * POST /api/missed-workouts
   * Record a missed workout (System/Admin use)
   * Access: Admin
   */
  app.post('/api/missed-workouts', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const missedData = insertMissedWorkoutSchema.parse(req.body);
      
      // Convert scheduledDate to Date if string
      if (typeof missedData.scheduledDate === 'string') {
        missedData.scheduledDate = new Date(missedData.scheduledDate);
      }
      
      const [missed] = await db.insert(missedWorkouts)
        .values(missedData)
        .returning();
      
      // Get user and coach info
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, missedData.userId),
      });
      
      if (targetUser) {
        // Send motivational notification to user
        await db.insert(notifications).values({
          userId: missedData.userId,
          type: 'workout',
          title: "Don't Give Up!",
          titleAr: "لا تستسلم!",
          message: "We noticed you missed a workout. Remember, consistency is key! Let's get back on track.",
          messageAr: "لاحظنا أنك فوت تمرينًا. تذكر، الاستمرارية هي المفتاح! لنعد إلى المسار الصحيح.",
          status: 'pending',
          relatedEntityType: 'missed_workout',
          relatedEntityId: missed.id,
        });
        
        // Optionally notify coach if configured
        if (targetUser.coachId) {
          await db.insert(notifications).values({
            userId: targetUser.coachId,
            type: 'workout',
            title: `Trainee Missed Workout`,
            titleAr: `المتدرب فات تمرينًا`,
            message: `${targetUser.firstName} ${targetUser.lastName} missed a scheduled workout.`,
            messageAr: `${targetUser.firstName} ${targetUser.lastName} فات تمرينًا مجدولاً.`,
            status: 'pending',
            relatedEntityType: 'missed_workout',
            relatedEntityId: missed.id,
          });
          
          await db.update(missedWorkouts)
            .set({ coachNotified: true })
            .where(eq(missedWorkouts.id, missed.id));
        }
        
        await db.update(missedWorkouts)
          .set({ notificationSent: true })
          .where(eq(missedWorkouts.id, missed.id));
      }
      
      res.status(201).json(missed);
    } catch (error: any) {
      console.error('Error recording missed workout:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to record missed workout", error: error.message });
    }
  });
}
