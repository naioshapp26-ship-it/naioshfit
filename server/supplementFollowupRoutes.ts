/**
 * Supplements Follow-up Routes - Epic B Implementation
 * Handles reminders, side effects logging, and effectiveness ratings
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db } from './db';
import { eq, and, desc, or, gte, lte, sql, type SQL } from 'drizzle-orm';
import {
  supplementReminders,
  supplementSideEffects,
  supplementEffectivenessRatings,
  supplementRecommendations,
  supplements,
  users,
  insertSupplementReminderSchema,
  insertSupplementSideEffectSchema,
  insertSupplementEffectivenessRatingSchema,
  type User,
} from "@shared/schema";
import { isPlatformAdminRole } from "@shared/roleAccess";
import { z } from "zod";

// Authentication middleware check
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

export default function setupSupplementFollowupRoutes(app: Express) {
  
  // ============================================================================
  // B1: SUPPLEMENT REMINDERS (تذكير بالمكملات)
  // ============================================================================
  
  /**
   * GET /api/supplement-reminders/user/:userId
   * Get supplement reminders for a user
   * Access: Admin, Coach (their trainees), User (themselves)
   */
  app.get('/api/supplement-reminders/user/:userId', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const targetUserId = parseInt(req.params.userId);
      
      const hasAccess = await canAccessUser(user, targetUserId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const reminders = await db.query.supplementReminders.findMany({
        where: eq(supplementReminders.userId, targetUserId),
        orderBy: desc(supplementReminders.createdAt),
      });
      
      // Fetch related recommendation and supplement data
      const enrichedReminders = await Promise.all(
        reminders.map(async (reminder) => {
          const [recommendation] = await Promise.all([
            db.query.supplementRecommendations.findFirst({
              where: eq(supplementRecommendations.id, reminder.recommendationId),
            }),
          ]);
          
          let supplement = null;
          if (recommendation) {
            supplement = await db.query.supplements.findFirst({
              where: eq(supplements.id, recommendation.supplementId),
            });
          }
          
          return {
            ...reminder,
            recommendation: recommendation ? { ...recommendation, supplement } : null,
          };
        })
      );
      
      res.json({ reminders: enrichedReminders });
    } catch (error: any) {
      console.error('Error fetching reminders:', error);
      res.status(500).json({ message: "Failed to fetch reminders", error: error.message });
    }
  });
  
  /**
   * POST /api/supplement-reminders
   * Create or update supplement reminder settings
   * Access: User (for themselves)
   */
  app.post('/api/supplement-reminders', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const reminderData = insertSupplementReminderSchema.parse(req.body);
      
      // Verify user can only set reminders for themselves (unless admin)
      if ((user.role !== 'admin' && user.role !== 'super_admin') && reminderData.userId !== user.id) {
        return res.status(403).json({ message: "You can only set reminders for yourself" });
      }
      
      // Verify recommendation exists and belongs to user
      const recommendation = await db.query.supplementRecommendations.findFirst({
        where: eq(supplementRecommendations.id, reminderData.recommendationId),
      });
      
      if (!recommendation || recommendation.userId !== reminderData.userId) {
        return res.status(404).json({ message: "Recommendation not found or doesn't belong to user" });
      }
      
      // Check if reminder already exists
      const existingReminder = await db.query.supplementReminders.findFirst({
        where: and(
          eq(supplementReminders.userId, reminderData.userId),
          eq(supplementReminders.recommendationId, reminderData.recommendationId)
        ),
      });
      
      let result;
      if (existingReminder) {
        // Update existing reminder
        [result] = await db.update(supplementReminders)
          .set({
            ...reminderData,
            updatedAt: new Date(),
          })
          .where(eq(supplementReminders.id, existingReminder.id))
          .returning();
      } else {
        // Create new reminder
        [result] = await db.insert(supplementReminders)
          .values(reminderData)
          .returning();
      }
      
      res.status(existingReminder ? 200 : 201).json(result);
    } catch (error: any) {
      console.error('Error creating/updating reminder:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save reminder", error: error.message });
    }
  });
  
  /**
   * PUT /api/supplement-reminders/:id
   * Update reminder settings
   * Access: User (their own), Admin
   */
  app.put('/api/supplement-reminders/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const reminderId = parseInt(req.params.id);
      
      const existingReminder = await db.query.supplementReminders.findFirst({
        where: eq(supplementReminders.id, reminderId),
      });
      
      if (!existingReminder) {
        return res.status(404).json({ message: "Reminder not found" });
      }
      
      // Check permissions
      if ((user.role !== 'admin' && user.role !== 'super_admin') && existingReminder.userId !== user.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updateData = insertSupplementReminderSchema.partial().parse(req.body);
      updateData.updatedAt = new Date();
      
      const [updatedReminder] = await db.update(supplementReminders)
        .set(updateData)
        .where(eq(supplementReminders.id, reminderId))
        .returning();
      
      res.json(updatedReminder);
    } catch (error: any) {
      console.error('Error updating reminder:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update reminder", error: error.message });
    }
  });
  
  // ============================================================================
  // B2: SIDE EFFECTS LOGGING (تسجيل الأعراض الجانبية)
  // ============================================================================
  
  /**
   * GET /api/supplement-side-effects/user/:userId
   * Get side effects logged by a user
   * Access: Admin, Coach (their trainees), User (themselves)
   */
  app.get('/api/supplement-side-effects/user/:userId', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const targetUserId = parseInt(req.params.userId);
      
      const hasAccess = await canAccessUser(user, targetUserId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { severity, status } = req.query;
      
      let conditions: SQL[] = [eq(supplementSideEffects.userId, targetUserId)];
      
      if (severity) {
        conditions.push(eq(supplementSideEffects.severity, severity as string));
      }
      
      if (status) {
        conditions.push(eq(supplementSideEffects.status, status as string));
      }
      
      const sideEffects = await db.query.supplementSideEffects.findMany({
        where: and(...conditions),
        orderBy: desc(supplementSideEffects.occurredAt),
      });
      
      // Fetch related data
      const enrichedSideEffects = await Promise.all(
        sideEffects.map(async (effect) => {
          const [recommendation, supplement] = await Promise.all([
            db.query.supplementRecommendations.findFirst({
              where: eq(supplementRecommendations.id, effect.recommendationId),
            }),
            effect.supplementId
              ? db.query.supplements.findFirst({
                  where: eq(supplements.id, effect.supplementId),
                })
              : Promise.resolve(null),
          ]);
          
          return {
            ...effect,
            recommendation,
            supplement,
          };
        })
      );
      
      res.json({ sideEffects: enrichedSideEffects });
    } catch (error: any) {
      console.error('Error fetching side effects:', error);
      res.status(500).json({ message: "Failed to fetch side effects", error: error.message });
    }
  });
  
  /**
   * POST /api/supplement-side-effects
   * Log a side effect
   * Access: User (for themselves)
   */
  app.post('/api/supplement-side-effects', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const sideEffectData = insertSupplementSideEffectSchema.parse(req.body);
      
      // Verify user can only log for themselves (unless admin)
      if ((user.role !== 'admin' && user.role !== 'super_admin') && sideEffectData.userId !== user.id) {
        return res.status(403).json({ message: "You can only log side effects for yourself" });
      }
      
      // Verify recommendation exists
      const recommendation = await db.query.supplementRecommendations.findFirst({
        where: eq(supplementRecommendations.id, sideEffectData.recommendationId),
      });
      
      if (!recommendation || recommendation.userId !== sideEffectData.userId) {
        return res.status(404).json({ message: "Recommendation not found or doesn't belong to user" });
      }
      
      // Set supplement ID from recommendation if not provided
      if (!sideEffectData.supplementId) {
        sideEffectData.supplementId = recommendation.supplementId;
      }
      
      // Convert occurredAt to Date if it's a string
      if (typeof sideEffectData.occurredAt === 'string') {
        sideEffectData.occurredAt = new Date(sideEffectData.occurredAt);
      }
      
      const [newSideEffect] = await db.insert(supplementSideEffects)
        .values(sideEffectData)
        .returning();
      
      // If severity is severe or critical, auto-escalate to coach
      if ((sideEffectData.severity === 'severe' || sideEffectData.severity === 'critical') && recommendation.coachId) {
        await db.update(supplementSideEffects)
          .set({
            status: 'escalated',
            escalatedTo: recommendation.coachId,
            escalatedAt: new Date(),
          })
          .where(eq(supplementSideEffects.id, newSideEffect.id));
      }
      
      res.status(201).json(newSideEffect);
    } catch (error: any) {
      console.error('Error logging side effect:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to log side effect", error: error.message });
    }
  });
  
  /**
   * PUT /api/supplement-side-effects/:id
   * Update side effect (resolve, add notes, etc.)
   * Access: User (their own), Coach (their trainees), Admin
   */
  app.put('/api/supplement-side-effects/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const sideEffectId = parseInt(req.params.id);
      
      const existingSideEffect = await db.query.supplementSideEffects.findFirst({
        where: eq(supplementSideEffects.id, sideEffectId),
      });
      
      if (!existingSideEffect) {
        return res.status(404).json({ message: "Side effect not found" });
      }
      
      // Check permissions
      const hasAccess = await canAccessUser(user, existingSideEffect.userId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updateData = insertSupplementSideEffectSchema.partial().parse(req.body);
      
      // If marking as resolved, set resolvedAt
      if (updateData.status === 'resolved' && !updateData.resolvedAt) {
        updateData.resolvedAt = new Date();
      }
      
      const [updatedSideEffect] = await db.update(supplementSideEffects)
        .set(updateData)
        .where(eq(supplementSideEffects.id, sideEffectId))
        .returning();
      
      res.json(updatedSideEffect);
    } catch (error: any) {
      console.error('Error updating side effect:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update side effect", error: error.message });
    }
  });
  
  /**
   * GET /api/coach/supplement-side-effects
   * Get side effects for coach's trainees (aggregated view)
   * Access: Coach, Admin
   */
  app.get('/api/coach/supplement-side-effects', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const user = req.user as User;
      const { severity, status } = req.query;
      
      let conditions: SQL[] = [];
      
      // If coach, filter to their trainees
      if (user.role === 'coach') {
        const trainees = await db.query.users.findMany({
          where: eq(users.coachId, user.id),
          columns: { id: true },
        });
        
        const traineeIds = trainees.map(t => t.id);
        if (traineeIds.length === 0) {
          return res.json({ sideEffects: [] });
        }
        
        conditions.push(
          sql`${supplementSideEffects.userId} IN (${sql.join(traineeIds.map(id => sql`${id}`), sql`, `)})`
        );
      }
      
      if (severity) {
        conditions.push(eq(supplementSideEffects.severity, severity as string));
      }
      
      if (status) {
        conditions.push(eq(supplementSideEffects.status, status as string));
      }
      
      const sideEffects = await db.query.supplementSideEffects.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: desc(supplementSideEffects.occurredAt),
      });
      
      // Enrich with user and supplement data
      const enrichedSideEffects = await Promise.all(
        sideEffects.map(async (effect) => {
          const [trainee, supplement] = await Promise.all([
            db.query.users.findFirst({
              where: eq(users.id, effect.userId),
              columns: {
                id: true,
                firstName: true,
                lastName: true,
              },
            }),
            effect.supplementId
              ? db.query.supplements.findFirst({
                  where: eq(supplements.id, effect.supplementId),
                })
              : Promise.resolve(null),
          ]);
          
          return {
            ...effect,
            user: trainee,
            supplement,
          };
        })
      );
      
      res.json({ sideEffects: enrichedSideEffects });
    } catch (error: any) {
      console.error('Error fetching coach side effects:', error);
      res.status(500).json({ message: "Failed to fetch side effects", error: error.message });
    }
  });
  
  // ============================================================================
  // B3: EFFECTIVENESS RATING (تقييم الفاعلية)
  // ============================================================================
  
  /**
   * GET /api/supplement-effectiveness/user/:userId
   * Get effectiveness ratings for a user
   * Access: Admin, Coach (their trainees), User (themselves)
   */
  app.get('/api/supplement-effectiveness/user/:userId', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const targetUserId = parseInt(req.params.userId);
      
      const hasAccess = await canAccessUser(user, targetUserId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const ratings = await db.query.supplementEffectivenessRatings.findMany({
        where: eq(supplementEffectivenessRatings.userId, targetUserId),
        orderBy: desc(supplementEffectivenessRatings.createdAt),
      });
      
      // Fetch related data
      const enrichedRatings = await Promise.all(
        ratings.map(async (rating) => {
          const [recommendation, supplement] = await Promise.all([
            db.query.supplementRecommendations.findFirst({
              where: eq(supplementRecommendations.id, rating.recommendationId),
            }),
            rating.supplementId
              ? db.query.supplements.findFirst({
                  where: eq(supplements.id, rating.supplementId),
                })
              : Promise.resolve(null),
          ]);
          
          return {
            ...rating,
            recommendation,
            supplement,
          };
        })
      );
      
      res.json({ ratings: enrichedRatings });
    } catch (error: any) {
      console.error('Error fetching effectiveness ratings:', error);
      res.status(500).json({ message: "Failed to fetch ratings", error: error.message });
    }
  });
  
  /**
   * POST /api/supplement-effectiveness
   * Submit an effectiveness rating
   * Access: User (for themselves)
   */
  app.post('/api/supplement-effectiveness', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const ratingData = insertSupplementEffectivenessRatingSchema.parse(req.body);
      
      // Verify user can only rate for themselves (unless admin)
      if ((user.role !== 'admin' && user.role !== 'super_admin') && ratingData.userId !== user.id) {
        return res.status(403).json({ message: "You can only rate for yourself" });
      }
      
      // Verify recommendation exists
      const recommendation = await db.query.supplementRecommendations.findFirst({
        where: eq(supplementRecommendations.id, ratingData.recommendationId),
      });
      
      if (!recommendation || recommendation.userId !== ratingData.userId) {
        return res.status(404).json({ message: "Recommendation not found or doesn't belong to user" });
      }
      
      // Set supplement ID from recommendation if not provided
      if (!ratingData.supplementId) {
        ratingData.supplementId = recommendation.supplementId;
      }
      
      // Convert date strings to Date objects if needed
      if (ratingData.ratingPeriodStart && typeof ratingData.ratingPeriodStart === 'string') {
        ratingData.ratingPeriodStart = new Date(ratingData.ratingPeriodStart);
      }
      if (ratingData.ratingPeriodEnd && typeof ratingData.ratingPeriodEnd === 'string') {
        ratingData.ratingPeriodEnd = new Date(ratingData.ratingPeriodEnd);
      }
      
      const [newRating] = await db.insert(supplementEffectivenessRatings)
        .values(ratingData)
        .returning();
      
      res.status(201).json(newRating);
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to submit rating", error: error.message });
    }
  });
  
  /**
   * GET /api/coach/supplement-effectiveness/summary
   * Get effectiveness summary for coach's trainees
   * Access: Coach, Admin
   */
  app.get('/api/coach/supplement-effectiveness/summary', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const user = req.user as User;
      const { supplementId } = req.query;
      
      let conditions: SQL[] = [];
      
      // If coach, filter to their trainees
      if (user.role === 'coach') {
        const trainees = await db.query.users.findMany({
          where: eq(users.coachId, user.id),
          columns: { id: true },
        });
        
        const traineeIds = trainees.map(t => t.id);
        if (traineeIds.length === 0) {
          return res.json({ summary: {}, ratings: [] });
        }
        
        conditions.push(
          sql`${supplementEffectivenessRatings.userId} IN (${sql.join(traineeIds.map(id => sql`${id}`), sql`, `)})`
        );
      }
      
      if (supplementId) {
        conditions.push(eq(supplementEffectivenessRatings.supplementId, parseInt(supplementId as string)));
      }
      
      const ratings = await db.query.supplementEffectivenessRatings.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: desc(supplementEffectivenessRatings.createdAt),
      });
      
      // Calculate summary statistics
      const summary = {
        totalRatings: ratings.length,
        averageRating: ratings.length > 0 
          ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(2)
          : 0,
        ratingDistribution: {
          1: ratings.filter(r => r.rating === 1).length,
          2: ratings.filter(r => r.rating === 2).length,
          3: ratings.filter(r => r.rating === 3).length,
          4: ratings.filter(r => r.rating === 4).length,
          5: ratings.filter(r => r.rating === 5).length,
        },
      };
      
      // Enrich ratings with user and supplement data
      const enrichedRatings = await Promise.all(
        ratings.map(async (rating) => {
          const [trainee, supplement] = await Promise.all([
            db.query.users.findFirst({
              where: eq(users.id, rating.userId),
              columns: {
                id: true,
                firstName: true,
                lastName: true,
              },
            }),
            rating.supplementId
              ? db.query.supplements.findFirst({
                  where: eq(supplements.id, rating.supplementId),
                })
              : Promise.resolve(null),
          ]);
          
          return {
            ...rating,
            user: trainee,
            supplement,
          };
        })
      );
      
      res.json({ 
        summary,
        ratings: enrichedRatings,
      });
    } catch (error: any) {
      console.error('Error fetching effectiveness summary:', error);
      res.status(500).json({ message: "Failed to fetch summary", error: error.message });
    }
  });
}
