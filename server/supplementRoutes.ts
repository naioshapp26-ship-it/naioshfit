import type { Express, Request, Response, NextFunction } from "express";
import { db } from './db';
import { eq, and, desc, or, like, ilike, inArray, sql, type SQL } from 'drizzle-orm';
import {
  supplements,
  supplementRecommendations,
  supplementInteractions,
  userSupplementWarnings,
  insertSupplementSchema,
  insertSupplementRecommendationSchema,
  insertSupplementInteractionSchema,
  insertUserSupplementWarningSchema,
  users,
  type Supplement,
  type SupplementRecommendation,
  type User,
} from "@shared/schema";
import { isPlatformAdminRole } from "@shared/roleAccess";
import { z } from "zod";
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';
import { getCentralPool } from './saas/centralDb';
import { getTenantPool } from './saas/dbManager';

// Helper: Resolve tenant database if in tenant context
const resolveTenantDb = async (req: Request) => {
  // First check if pool is already attached to request (by middleware)
  let tenantPool = (req as any).tenantPool as any;

  // Session fallback: derive pool from user's tenantId stored in session
  if (!tenantPool) {
    const tenantId = (req as any).user?.tenantId || (req.session as any)?.user?.tenantId;
    if (tenantId) {
      try {
        const centralPool = getCentralPool();
        const result = await centralPool.query('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
        const tenant = result.rows[0];
        if (tenant) {
          tenantPool = await getTenantPool(tenant);
          (req as any).tenantPool = tenantPool;
          (req as any).tenant = tenant;
        }
      } catch (err) {
        console.error('[SUPPLEMENTS] Failed to resolve tenant pool from session:', err);
      }
    }
  }

  if (!tenantPool) return null;
  return drizzle(tenantPool, { schema });
};

/**
 * Ensure supplement exists in tenant database (copy from central if needed)
 * This is necessary because supplement_recommendations has a foreign key to supplements
 */
async function ensureSupplementInTenantDb(supplementId: number, tenantDb: any): Promise<void> {
  // Check if supplement already exists in tenant database
  const existingInTenant = await tenantDb.query.supplements.findFirst({
    where: eq(supplements.id, supplementId),
  });
  
  if (existingInTenant) {
    return; // Already exists
  }
  
  // Fetch from central database
  const centralSupplement = await db.query.supplements.findFirst({
    where: eq(supplements.id, supplementId),
  });
  
  if (!centralSupplement) {
    throw new Error(`Supplement ${supplementId} not found in central database`);
  }
  
  // Copy to tenant database
  await tenantDb.insert(supplements).values(centralSupplement).onConflictDoNothing();
  console.log(`[SUPPLEMENTS] Synced supplement ${supplementId} to tenant database`);
}

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

const requireAdmin = requireRole(['admin']);
const requireAdminOrCoach = requireRole(['admin', 'coach']);
const requireAdminOrCoachOrGym = requireRole(['admin', 'coach', 'gym']);

/**
 * Check if user can access another user's data based on role and relationships
 */
async function canAccessUser(viewer: User, targetUserId: number, dbInstance: any = db): Promise<boolean> {
  if (isPlatformAdminRole(viewer.role)) return true;
  
  if (viewer.role === 'coach') {
    const targetUser = await dbInstance.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });
    return targetUser?.coachId === viewer.id;
  }
  
  if (viewer.role === 'gym') {
    const targetUser = await dbInstance.query.users.findFirst({
      where: eq(users.id, targetUserId),
    });
    // Gym can access their own coaches and users under those coaches
    if (targetUser?.gymId === viewer.id) return true;
    if (targetUser?.role === 'coach' && targetUser?.coachId === viewer.id) return true;
  }
  
  return viewer.id === targetUserId;
}

/**
 * Detect supplement warnings and interactions for a user
 * @param userId - User ID in tenant database
 * @param supplementId - Supplement ID in central database
 * @param recommendationId - Recommendation ID
 * @param tenantDb - Tenant database instance (for users and recommendations)
 * @param centralDb - Central database instance (for supplements and interactions)
 */
async function detectSupplementWarnings(
  userId: number,
  supplementId: number,
  recommendationId: number,
  tenantDb: any = db,
  centralDb: any = db
): Promise<Array<{ severity: string; message: string; interactionId?: number; reason: string }>> {
  const warnings: Array<{ severity: string; message: string; interactionId?: number; reason: string }> = [];
  
  // Get user data (from tenant database)
  const user = await tenantDb.query.users.findFirst({
    where: eq(users.id, userId),
  });
  
  if (!user) return warnings;
  
  // Get supplement data (from central database - supplements are shared)
  const supplement = await centralDb.query.supplements.findFirst({
    where: eq(supplements.id, supplementId),
  });
  
  if (!supplement) return warnings;
  
  // Get all interactions for this supplement (from central database)
  const interactions = await centralDb.query.supplementInteractions.findMany({
    where: eq(supplementInteractions.supplementId, supplementId),
  });
  
  // Check medical history
  if (user.medicalHistory && user.medicalHistoryDetails) {
    const medicalDetails = user.medicalHistoryDetails.toLowerCase();
    
    interactions.forEach(interaction => {
      if (interaction.interactionType === 'medical_condition') {
        const condition = interaction.interactsWith.toLowerCase();
        if (medicalDetails.includes(condition)) {
          warnings.push({
            severity: interaction.severity,
            message: `${supplement.name} may interact with medical condition: ${interaction.interactsWith}. ${interaction.description}`,
            interactionId: interaction.id,
            reason: `Medical history contains: ${interaction.interactsWith}`,
          });
        }
      }
    });
  }
  
  // Check allergies
  if (user.hasAllergies && user.allergyDetails) {
    const allergyDetails = user.allergyDetails.toLowerCase();
    
    interactions.forEach(interaction => {
      if (interaction.interactionType === 'allergy') {
        const allergen = interaction.interactsWith.toLowerCase();
        if (allergyDetails.includes(allergen)) {
          warnings.push({
            severity: interaction.severity,
            message: `${supplement.name} may cause allergic reaction: ${interaction.description}`,
            interactionId: interaction.id,
            reason: `Allergy to: ${interaction.interactsWith}`,
          });
        }
      }
    });
  }
  
  // Check if supplement ingredients match user allergies
  if (supplement.ingredients && user.hasAllergies && user.allergyDetails) {
    const ingredients = supplement.ingredients.toLowerCase();
    const allergyDetails = user.allergyDetails.toLowerCase();
    const commonAllergens = ['whey', 'dairy', 'soy', 'gluten', 'nuts', 'eggs', 'shellfish'];
    
    commonAllergens.forEach(allergen => {
      if (ingredients.includes(allergen) && allergyDetails.includes(allergen)) {
        warnings.push({
          severity: 'severe',
          message: `${supplement.name} contains ${allergen} which matches user's allergies`,
          reason: `Ingredient contains allergen: ${allergen}`,
        });
      }
    });
  }
  
  // Check for other active supplement recommendations (potential interactions)
  // Recommendations are in tenant database
  const activeRecommendations = await tenantDb.query.supplementRecommendations.findMany({
    where: and(
      eq(supplementRecommendations.userId, userId),
      eq(supplementRecommendations.status, 'active'),
    ),
  });
  
  // Fetch supplements for active recommendations (from central database)
  const supplementsMap = new Map();
  for (const rec of activeRecommendations) {
    if (!supplementsMap.has(rec.supplementId)) {
      const supp = await centralDb.query.supplements.findFirst({
        where: eq(supplements.id, rec.supplementId),
      });
      if (supp) {
        supplementsMap.set(rec.supplementId, supp);
      }
    }
  }
  
  activeRecommendations.forEach(rec => {
    const recSupplement = supplementsMap.get(rec.supplementId);
    if (rec.supplementId !== supplementId && recSupplement) {
      interactions.forEach(interaction => {
        if (interaction.interactionType === 'supplement') {
          const otherSuppName = recSupplement.name.toLowerCase();
          const interactsWith = interaction.interactsWith.toLowerCase();
          if (otherSuppName.includes(interactsWith) || interactsWith.includes(otherSuppName)) {
            warnings.push({
              severity: interaction.severity,
              message: `${supplement.name} may interact with ${recSupplement.name}: ${interaction.description}`,
              interactionId: interaction.id,
              reason: `Active supplement: ${recSupplement.name}`,
            });
          }
        }
      });
    }
  });
  
  return warnings;
}

export default function setupSupplementRoutes(app: Express) {
  
  // ============================================================================
  // A1: SUPPLEMENTS CATALOG ROUTES
  // ============================================================================
  
  /**
   * GET /api/supplements
   * List and search supplements with filters
   * Access: All authenticated users
   * Note: Supplements catalog is always from central database (shared across tenants)
   */
  app.get('/api/supplements', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Supplements catalog is ALWAYS from central database, regardless of tenant subdomain
      // Only supplement_recommendations are tenant-specific
      const dbToUse = db;
      
      const { 
        search, 
        category, 
        goal,
        page = '1',
        limit = '50',
      } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = Math.min(parseInt(limit as string), 100);
      const offset = (pageNum - 1) * limitNum;
      
      let conditions: SQL[] = [];
      
      // Users and coaches can only see global supplements + their own custom ones
      if (user.role === 'coach') {
        conditions.push(
          or(
            eq(supplements.isGlobal, true),
            eq(supplements.scopeCoachId, user.id)
          )
        );
      } else if (user.role === 'user') {
        // Users see global supplements + supplements from their coach
        if (user.coachId) {
          conditions.push(
            or(
              eq(supplements.isGlobal, true),
              eq(supplements.scopeCoachId, user.coachId)
            )
          );
        } else {
          conditions.push(eq(supplements.isGlobal, true));
        }
      } else if (user.role === 'gym') {
        // Gym sees global supplements + supplements from coaches in their gym
        conditions.push(eq(supplements.isGlobal, true));
      }
      // Admin sees all
      
      // Search filter
      if (search) {
        const searchTerm = `%${search}%`;
        conditions.push(
          or(
            ilike(supplements.name, searchTerm),
            ilike(supplements.nameAr, searchTerm)
          )
        );
      }
      
      // Category filter - using SQL for JSON array contains
      if (category) {
        conditions.push(
          sql`${supplements.categories} @> ${JSON.stringify([category])}`
        );
      }
      
      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
      
      const [supplementsList, totalCount] = await Promise.all([
        dbToUse.query.supplements.findMany({
          where: whereClause,
          limit: limitNum,
          offset: offset,
          orderBy: desc(supplements.createdAt),
        }),
        dbToUse.select({ count: sql<number>`count(*)` })
          .from(supplements)
          .where(whereClause)
          .then(result => Number(result[0]?.count || 0)),
      ]);
      
      res.json({
        supplements: supplementsList,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      });
    } catch (error: any) {
      console.error('Error fetching supplements:', error);
      res.status(500).json({ message: "Failed to fetch supplements", error: error.message });
    }
  });
  
  /**
   * GET /api/supplements/:id
   * Get supplement details
   * Access: All authenticated users
   */
  app.get('/api/supplements/:id', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const supplementId = parseInt(req.params.id);
      
      const supplement = await db.query.supplements.findFirst({
        where: eq(supplements.id, supplementId),
      });
      
      if (!supplement) {
        return res.status(404).json({ message: "Supplement not found" });
      }
      
      // Check access
      if (supplement.isGlobal) {
        // Global supplements are accessible to all
      } else if ((user.role === 'admin' || user.role === 'super_admin')) {
        // Admin can see all
      } else if (user.role === 'coach' && supplement.scopeCoachId === user.id) {
        // Coach can see their own custom supplements
      } else if (user.role === 'user' && user.coachId === supplement.scopeCoachId) {
        // User can see supplements from their coach
      } else {
        return res.status(403).json({ message: "Access denied to this supplement" });
      }
      
      // Get interaction warnings for this supplement
      const interactions = await db.query.supplementInteractions.findMany({
        where: eq(supplementInteractions.supplementId, supplementId),
        orderBy: desc(supplementInteractions.severity),
      });
      
      res.json({
        supplement,
        interactions,
      });
    } catch (error: any) {
      console.error('Error fetching supplement:', error);
      res.status(500).json({ message: "Failed to fetch supplement", error: error.message });
    }
  });
  
  /**
   * POST /api/supplements
   * Create a new supplement (Admin only for global, Coach for scoped)
   * Access: Admin (global), Coach (scoped to themselves)
   */
  app.post('/api/supplements', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Parse and validate input
      const supplementData = insertSupplementSchema.parse(req.body);
      
      // Check permissions
      if (supplementData.isGlobal && (user.role !== 'admin' && user.role !== 'super_admin')) {
        return res.status(403).json({ 
          message: "Only admins can create global supplements. Coaches can create coach-scoped supplements by setting isGlobal=false" 
        });
      }
      
      // If coach is creating, set scope
      if (user.role === 'coach') {
        supplementData.isGlobal = false;
        supplementData.scopeCoachId = user.id;
      }
      
      supplementData.createdBy = user.id;
      
      const [newSupplement] = await db.insert(supplements)
        .values(supplementData)
        .returning();
      
      res.status(201).json(newSupplement);
    } catch (error: any) {
      console.error('Error creating supplement:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create supplement", error: error.message });
    }
  });
  
  /**
   * PUT /api/supplements/:id
   * Update supplement
   * Access: Admin (all), Coach (their own scoped supplements)
   */
  app.put('/api/supplements/:id', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const user = req.user as User;
      const supplementId = parseInt(req.params.id);
      
      const existingSupplement = await db.query.supplements.findFirst({
        where: eq(supplements.id, supplementId),
      });
      
      if (!existingSupplement) {
        return res.status(404).json({ message: "Supplement not found" });
      }
      
      // Check permissions
      if (user.role === 'coach') {
        if (existingSupplement.scopeCoachId !== user.id) {
          return res.status(403).json({ message: "You can only update your own supplements" });
        }
      }
      
      // Validate update data
      const updateData = insertSupplementSchema.partial().parse(req.body);
      
      // Prevent coaches from making supplements global
      if (user.role === 'coach' && updateData.isGlobal === true) {
        return res.status(403).json({ message: "Coaches cannot make supplements global" });
      }
      
      updateData.updatedAt = new Date();
      
      const [updatedSupplement] = await db.update(supplements)
        .set(updateData)
        .where(eq(supplements.id, supplementId))
        .returning();
      
      res.json(updatedSupplement);
    } catch (error: any) {
      console.error('Error updating supplement:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update supplement", error: error.message });
    }
  });
  
  /**
   * DELETE /api/supplements/:id
   * Delete supplement
   * Access: Admin (all), Coach (their own scoped supplements)
   */
  app.delete('/api/supplements/:id', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const user = req.user as User;
      const supplementId = parseInt(req.params.id);
      
      const existingSupplement = await db.query.supplements.findFirst({
        where: eq(supplements.id, supplementId),
      });
      
      if (!existingSupplement) {
        return res.status(404).json({ message: "Supplement not found" });
      }
      
      // Check permissions
      if (user.role === 'coach') {
        if (existingSupplement.scopeCoachId !== user.id) {
          return res.status(403).json({ message: "You can only delete your own supplements" });
        }
      }
      
      await db.delete(supplements)
        .where(eq(supplements.id, supplementId));
      
      res.json({ message: "Supplement deleted successfully" });
    } catch (error: any) {
      console.error('Error deleting supplement:', error);
      res.status(500).json({ message: "Failed to delete supplement", error: error.message });
    }
  });
  
  // ============================================================================
  // A2 & A3: SUPPLEMENT RECOMMENDATIONS (Dosage & Timing)
  // ============================================================================
  
  /**
   * GET /api/supplement-recommendations/user/:userId
   * Get supplement recommendations for a user
   * Access: Admin, Coach (their trainees), User (themselves)
   */
  app.get('/api/supplement-recommendations/user/:userId', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const targetUserId = parseInt(req.params.userId);
      
      // Resolve tenant database if in tenant context
      const tenantDb = await resolveTenantDb(req);
      const dbToUse = tenantDb || db;
      
      // Check access
      const hasAccess = await canAccessUser(user, targetUserId, dbToUse);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { status } = req.query;
      
      let conditions: SQL[] = [eq(supplementRecommendations.userId, targetUserId)];
      
      if (status) {
        conditions.push(eq(supplementRecommendations.status, status as string));
      }
      
      const recommendations = await dbToUse.query.supplementRecommendations.findMany({
        where: and(...conditions),
        orderBy: desc(supplementRecommendations.createdAt),
      });
      
      // Fetch related supplement and coach data
      // Supplements come from central database, users/coaches from tenant database
      const enrichedRecommendations = await Promise.all(
        recommendations.map(async (rec) => {
          const [supplement, coach] = await Promise.all([
            db.query.supplements.findFirst({
              where: eq(supplements.id, rec.supplementId),
            }),
            rec.coachId
              ? dbToUse.query.users.findFirst({
                  where: eq(users.id, rec.coachId),
                  columns: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                })
              : Promise.resolve(null),
          ]);
          
          return {
            ...rec,
            supplement,
            coach,
          };
        })
      );
      
      res.json({ recommendations: enrichedRecommendations });
    } catch (error: any) {
      console.error('Error fetching recommendations:', error);
      res.status(500).json({ message: "Failed to fetch recommendations", error: error.message });
    }
  });
  
  /**
   * POST /api/supplement-recommendations
   * Create supplement recommendation for a user
   * Access: User (for themselves), Coach (for their trainees), Admin
   */
  app.post('/api/supplement-recommendations', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      
      // Resolve tenant database if in tenant context
      const tenantDb = await resolveTenantDb(req);
      const dbToUse = tenantDb || db;
      
      const recommendationData = insertSupplementRecommendationSchema.parse(req.body);
      
      // Authorization checks
      if (user.role === 'user') {
        // Users can only create recommendations for themselves
        if (recommendationData.userId !== user.id) {
          return res.status(403).json({ message: "You can only create recommendations for yourself" });
        }
        // Self-managed supplements have no coach
        recommendationData.coachId = undefined;
      } else if (user.role === 'coach') {
        const targetUser = await dbToUse.query.users.findFirst({
          where: eq(users.id, recommendationData.userId),
        });
        
        if (!targetUser || targetUser.coachId !== user.id) {
          return res.status(403).json({ message: "You can only create recommendations for your own trainees" });
        }
        
        recommendationData.coachId = user.id;
      }
      // Admin can create for anyone
      
      // Verify supplement exists (always check central database since supplements catalog is shared)
      const supplement = await db.query.supplements.findFirst({
        where: eq(supplements.id, recommendationData.supplementId),
      });
      
      if (!supplement) {
        return res.status(404).json({ message: "Supplement not found" });
      }
      
      // If using tenant database, ensure supplement exists there (sync from central)
      if (tenantDb) {
        await ensureSupplementInTenantDb(recommendationData.supplementId, tenantDb);
      }
      
      // Create recommendation (in tenant database if on tenant subdomain)
      const [newRecommendation] = await dbToUse.insert(supplementRecommendations)
        .values(recommendationData)
        .returning();
      
      // Detect warnings (A4)
      // Pass both tenant database (for users/recommendations) and central database (for supplements/interactions)
      const warnings = await detectSupplementWarnings(
        recommendationData.userId,
        recommendationData.supplementId,
        newRecommendation.id,
        dbToUse,  // tenant database for users and recommendations
        db        // central database for supplements and interactions
      );
      
      // Store warnings if any
      if (warnings.length > 0) {
        for (const warning of warnings) {
          await dbToUse.insert(userSupplementWarnings).values({
            userId: recommendationData.userId,
            recommendationId: newRecommendation.id,
            interactionId: warning.interactionId,
            severity: warning.severity,
            warningMessage: warning.message,
            flaggedReason: warning.reason,
            status: 'pending',
          });
        }
        
        // Mark recommendation as having warnings
        await dbToUse.update(supplementRecommendations)
          .set({ warningsChecked: true })
          .where(eq(supplementRecommendations.id, newRecommendation.id));
      } else {
        // No warnings found
        await dbToUse.update(supplementRecommendations)
          .set({ 
            warningsChecked: true,
            warningsAcknowledged: true,
          })
          .where(eq(supplementRecommendations.id, newRecommendation.id));
      }
      
      res.status(201).json({
        recommendation: newRecommendation,
        warnings: warnings,
        warningsCount: warnings.length,
      });
    } catch (error: any) {
      console.error('Error creating recommendation:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create recommendation", error: error.message });
    }
  });
  
  /**
   * PUT /api/supplement-recommendations/:id
   * Update supplement recommendation
   * Access: Coach (their own recommendations), Admin
   */
  app.put('/api/supplement-recommendations/:id', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const user = req.user as User;
      const recommendationId = parseInt(req.params.id);
      
      const existingRec = await db.query.supplementRecommendations.findFirst({
        where: eq(supplementRecommendations.id, recommendationId),
      });
      
      if (!existingRec) {
        return res.status(404).json({ message: "Recommendation not found" });
      }
      
      // Check permissions
      if (user.role === 'coach' && existingRec.coachId !== user.id) {
        return res.status(403).json({ message: "You can only update your own recommendations" });
      }
      
      const updateData = insertSupplementRecommendationSchema.partial().parse(req.body);
      updateData.updatedAt = new Date();
      
      const [updatedRec] = await db.update(supplementRecommendations)
        .set(updateData)
        .where(eq(supplementRecommendations.id, recommendationId))
        .returning();
      
      res.json(updatedRec);
    } catch (error: any) {
      console.error('Error updating recommendation:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update recommendation", error: error.message });
    }
  });
  
  /**
   * DELETE /api/supplement-recommendations/:id
   * Delete/discontinue supplement recommendation
   * Access: Coach (their own), Admin
   */
  app.delete('/api/supplement-recommendations/:id', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const user = req.user as User;
      const recommendationId = parseInt(req.params.id);
      
      const existingRec = await db.query.supplementRecommendations.findFirst({
        where: eq(supplementRecommendations.id, recommendationId),
      });
      
      if (!existingRec) {
        return res.status(404).json({ message: "Recommendation not found" });
      }
      
      // Check permissions
      if (user.role === 'coach' && existingRec.coachId !== user.id) {
        return res.status(403).json({ message: "You can only delete your own recommendations" });
      }
      
      // Soft delete by marking as discontinued
      await db.update(supplementRecommendations)
        .set({ 
          status: 'discontinued',
          endDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(supplementRecommendations.id, recommendationId));
      
      res.json({ message: "Recommendation discontinued successfully" });
    } catch (error: any) {
      console.error('Error deleting recommendation:', error);
      res.status(500).json({ message: "Failed to delete recommendation", error: error.message });
    }
  });
  
  // ============================================================================
  // A4: WARNINGS & INTERACTIONS
  // ============================================================================
  
  /**
   * GET /api/supplement-warnings/user/:userId
   * Get warnings for a user's supplement recommendations
   * Access: Admin, Coach (their trainees), User (themselves)
   */
  app.get('/api/supplement-warnings/user/:userId', isAuthenticated, async (req, res) => {
    try {
      const user = req.user as User;
      const targetUserId = parseInt(req.params.userId);
      
      const hasAccess = await canAccessUser(user, targetUserId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { status } = req.query;
      
      let conditions: SQL[] = [eq(userSupplementWarnings.userId, targetUserId)];
      
      if (status) {
        conditions.push(eq(userSupplementWarnings.status, status as string));
      }
      
      const warnings = await db.query.userSupplementWarnings.findMany({
        where: and(...conditions),
        orderBy: [desc(userSupplementWarnings.severity), desc(userSupplementWarnings.createdAt)],
      });
      
      // Fetch related data
      const enrichedWarnings = await Promise.all(
        warnings.map(async (warning) => {
          const [recommendation, interaction] = await Promise.all([
            warning.recommendationId
              ? db.query.supplementRecommendations.findFirst({
                  where: eq(supplementRecommendations.id, warning.recommendationId),
                })
              : Promise.resolve(null),
            warning.interactionId
              ? db.query.supplementInteractions.findFirst({
                  where: eq(supplementInteractions.id, warning.interactionId),
                })
              : Promise.resolve(null),
          ]);
          
          let supplement = null;
          if (recommendation) {
            supplement = await db.query.supplements.findFirst({
              where: eq(supplements.id, recommendation.supplementId),
            });
          }
          
          return {
            ...warning,
            recommendation: recommendation ? { ...recommendation, supplement } : null,
            interaction,
          };
        })
      );
      
      res.json({ warnings: enrichedWarnings });
    } catch (error: any) {
      console.error('Error fetching warnings:', error);
      res.status(500).json({ message: "Failed to fetch warnings", error: error.message });
    }
  });
  
  /**
   * PUT /api/supplement-warnings/:id/acknowledge
   * Acknowledge a warning (Coach or Admin)
   * Access: Coach, Admin
   */
  app.put('/api/supplement-warnings/:id/acknowledge', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const user = req.user as User;
      const warningId = parseInt(req.params.id);
      const { resolutionNotes } = req.body;
      
      const warning = await db.query.userSupplementWarnings.findFirst({
        where: eq(userSupplementWarnings.id, warningId),
      });
      
      if (!warning) {
        return res.status(404).json({ message: "Warning not found" });
      }
      
      // Fetch the recommendation
      const recommendation = await db.query.supplementRecommendations.findFirst({
        where: eq(supplementRecommendations.id, warning.recommendationId),
      });
      
      if (!recommendation) {
        return res.status(404).json({ message: "Associated recommendation not found" });
      }
      
      // Check if coach owns this recommendation
      if (user.role === 'coach' && recommendation.coachId !== user.id) {
        return res.status(403).json({ message: "You can only acknowledge warnings for your own recommendations" });
      }
      
      const [updatedWarning] = await db.update(userSupplementWarnings)
        .set({
          status: 'acknowledged',
          acknowledgedBy: user.id,
          acknowledgedAt: new Date(),
          resolutionNotes: resolutionNotes || null,
        })
        .where(eq(userSupplementWarnings.id, warningId))
        .returning();
      
      // Also update the recommendation
      await db.update(supplementRecommendations)
        .set({ warningsAcknowledged: true })
        .where(eq(supplementRecommendations.id, warning.recommendationId));
      
      res.json(updatedWarning);
    } catch (error: any) {
      console.error('Error acknowledging warning:', error);
      res.status(500).json({ message: "Failed to acknowledge warning", error: error.message });
    }
  });
  
  /**
   * POST /api/supplement-interactions
   * Create supplement interaction rule (Admin only)
   * Access: Admin
   */
  app.post('/api/supplement-interactions', isAuthenticated, requireAdmin, async (req, res) => {
    try {
      const interactionData = insertSupplementInteractionSchema.parse(req.body);
      
      const [newInteraction] = await db.insert(supplementInteractions)
        .values(interactionData)
        .returning();
      
      res.status(201).json(newInteraction);
    } catch (error: any) {
      console.error('Error creating interaction:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create interaction", error: error.message });
    }
  });
  
  /**
   * GET /api/supplement-interactions/:supplementId
   * Get all interactions for a supplement
   * Access: Admin, Coach
   */
  app.get('/api/supplement-interactions/:supplementId', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const supplementId = parseInt(req.params.supplementId);
      
      const interactions = await db.query.supplementInteractions.findMany({
        where: eq(supplementInteractions.supplementId, supplementId),
        orderBy: desc(supplementInteractions.severity),
      });
      
      res.json({ interactions });
    } catch (error: any) {
      console.error('Error fetching interactions:', error);
      res.status(500).json({ message: "Failed to fetch interactions", error: error.message });
    }
  });
  
  /**
   * GET /api/admin/flagged-users
   * Get all users with pending supplement warnings
   * Access: Admin, Coach (their own trainees only)
   */
  app.get('/api/admin/flagged-users', isAuthenticated, requireAdminOrCoach, async (req, res) => {
    try {
      const user = req.user as User;
      
      let conditions: SQL[] = [eq(userSupplementWarnings.status, 'pending')];
      
      // If coach, only show warnings for their recommendations
      if (user.role === 'coach') {
        const coachRecs = await db.query.supplementRecommendations.findMany({
          where: eq(supplementRecommendations.coachId, user.id),
          columns: { id: true },
        });
        
        const recIds = coachRecs.map(r => r.id);
        if (recIds.length === 0) {
          return res.json({ flaggedUsers: [] });
        }
        
        conditions.push(inArray(userSupplementWarnings.recommendationId, recIds));
      }
      
      const warnings = await db.query.userSupplementWarnings.findMany({
        where: and(...conditions),
        orderBy: [desc(userSupplementWarnings.severity), desc(userSupplementWarnings.createdAt)],
      });
      
      // Fetch related data
      const enrichedWarnings = await Promise.all(
        warnings.map(async (warning) => {
          const [user, recommendation] = await Promise.all([
            db.query.users.findFirst({
              where: eq(users.id, warning.userId),
              columns: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            }),
            warning.recommendationId
              ? db.query.supplementRecommendations.findFirst({
                  where: eq(supplementRecommendations.id, warning.recommendationId),
                })
              : Promise.resolve(null),
          ]);
          
          let supplement = null;
          if (recommendation) {
            supplement = await db.query.supplements.findFirst({
              where: eq(supplements.id, recommendation.supplementId),
            });
          }
          
          return {
            ...warning,
            user,
            recommendation: recommendation ? { ...recommendation, supplement } : null,
          };
        })
      );
      
      // Group by user
      interface FlaggedUserGroup {
        user: {
          id: number;
          firstName: string | null;
          lastName: string | null;
          username: string | null;
        } | null;
        warnings: typeof enrichedWarnings;
      }
      
      const flaggedUsers = enrichedWarnings.reduce((acc: Record<number, FlaggedUserGroup>, warning) => {
        const userId = warning.userId;
        if (!acc[userId]) {
          acc[userId] = {
            user: warning.user,
            warnings: [],
          };
        }
        acc[userId].warnings.push(warning);
        return acc;
      }, {});
      
      res.json({ 
        flaggedUsers: Object.values(flaggedUsers),
        totalWarnings: enrichedWarnings.length,
      });
    } catch (error: any) {
      console.error('Error fetching flagged users:', error);
      res.status(500).json({ message: "Failed to fetch flagged users", error: error.message });
    }
  });
}
