import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from './db';
import { sql, like, eq, and, or, inArray, desc, gte, lte, lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import MemoryStore from "memorystore";
import fs from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { sendEmail, sendPasswordResetEmail } from "./lib/emailService";
import {
  getEmailConfigForScope,
  getPlatformEmailSettings,
  getTenantEmailSettings,
  savePlatformEmailSettings,
  saveTenantEmailSettings,
} from "./lib/emailSettings";
import foodRouter from "./foodDatabaseRoutes";
import setupSupplementRoutes from "./supplementRoutes";
import setupSupplementFollowupRoutes from "./supplementFollowupRoutes";
import setupNotificationRoutes from "./notificationRoutes";
import setupFilesReportsRoutes from "./filesReportsRoutes";
import { registerAiAssistantRoutes } from "./aiAssistantRoutes";
import { registerSaasRoutes } from "./saas/routes";
import { registerSaasAdminRoutes } from "./saas/adminRoutes";
import { getCentralPool } from "./saas/centralDb";
import { getTenantPool } from "./saas/dbManager";
import { registerSeoRoutes } from "./seoRoutes";
import { registerBrandingRoutes } from "./brandingRoutes";
import { registerPublicContentRoutes } from "./publicContentRoutes";
import { registerPaymentRoutes } from "./payment";
import { registerCreditBillingRoutes } from "./creditBillingRoutes";
import { buildRequestMetadata, mergeStripeMetadata } from "./payment/metadata";
import { createPlatformCheckoutSession, logPlatformTransaction } from "./payment/platformStripe";
import { createTenantCheckoutSession, logTenantTransaction } from "./payment/tenantStripe";
import { createPlatformPayPalOrder } from "./payment/platformPayPal";
import { createTenantPayPalOrder } from "./payment/tenantPayPal";
import { createPlatformPaymobIntention, getPlatformPaymobKeys } from "./payment/platformPaymob";
import { createTenantPaymobIntention, getTenantPaymobKeys } from "./payment/tenantPaymob";
import { formatPayPalAmount } from "./payment/paypalClient";
import { getInsufficientCreditsMessage, getRequestLanguage } from "./utils/i18n";
import { buildScopeFromRequest, consumeCredits, getOrCreateAccountWithBalance, grantSignupCredits } from "./services/creditBilling";
import {
  aiSettingsInputSchema,
  buildAiNotConfiguredResponse,
  getAiFeatureConfig,
  getAiSettingsConfiguredFlags,
  getAiSettingsForRequest,
  saveAiSettingsForRequest,
} from "./aiSettings";
import communityRouter from "./communityRoutes";
import contentRouter from "./contentRoutes";
import blogRouter from "./blogRoutes";
import { registerCoursesRoutes } from "./coursesRoutes";
import { z } from "zod";
import OpenAI from "openai";
import {
  insertUserSchema,
  insertMealSchema,
  insertProgressSchema,
  insertMessageSchema,
  insertUserPlanSchema,
  insertUserWorkoutSchema,
  insertWorkoutSchema,
  insertContentLibrarySchema,
  insertContentCategorySchema,
  insertWorkoutSessionSchema,
  insertProductSchema,
  insertOrderSchema,
  insertOrderItemSchema,
  insertCoachProductSchema,
  insertAffiliateProductSchema,
  insertAffiliateCategorySchema,
  insertTrackingSettingsSchema,
  supplements,
  supplementRecommendations,
  supplementInteractions,
  userSupplementWarnings,
  supplementReminders,
  supplementSideEffects,
  supplementEffectivenessRatings,
  notifications,
  reminderSettings,
  motivationalTemplates,
  achievements,
  missedWorkouts,
  uploadedFiles,
  reports,
  progressSnapshots,
  aiConversations,
  aiInsights,
  aiPlanSuggestions,
  escalationRequests,
  friendships,
  achievementShares,
  groupChallenges,
  challengeParticipants,
  encouragements,
  contentReports,
  groups,
  groupMembers,
  discussionTopics,
  topicReplies,
  workshops,
  workshopAttendees,
  referrals,
  contentItems,
  contentRatings,
  contentBookmarks,
  contentLibrary,
  coachInvitations,
  users,
  meals,
  messages,
  workouts,
  workoutSessions,
  userWorkouts,
  progress,
  dailyStats,
  userPlans,
  userPointsAndStreaks,
  affiliateProducts,
  coachProducts,
  productClicks,
  userLogins,
  type User,
  type InsertUser,
  type Product,
  type InsertTrackingSettings,
  type CreditTransaction,
  type Order,
  type InsertOrder,
  type InsertOrderItem,
  type CartItem
} from "@shared/schema";
import { resolveValidCoachId, resolveValidGymId, applyCoachAttributionIfValid, applyGymAttributionIfValid } from './utils/coachAttribution';

const uploadsDir = path.join(process.cwd(), 'uploads');

// Extend session interface to include passport property
declare module 'express-session' {
  interface SessionData {
    passport?: {
      user?: number;
    };
    user?: User;
  }
}

// Extend Request interface for req.user
declare module 'express' {
  interface User {
    id: number;
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
  }
}

// Technical issue report interface
interface TechnicalIssueReport {
  type: string;
  description: string;
  email?: string;
  phone?: string;
  screenshot?: string;
  screenshotFilename?: string;
  screenshotSize?: number;
  screenshotType?: string;
  timestamp?: string;
  userAgent?: string;
  url?: string;
}
import { calculateSubscriptionEndDate, getSubscriptionStatus } from "@shared/subscriptionUtils";

// Add a custom global for tracking logout state
declare global {
  var userLoggedOut: boolean;
}
global.userLoggedOut = false; // Initialize as false by default

// Configure memory store for sessions
const SessionStore = MemoryStore(session);

const trackingSettingsUpdateSchema = insertTrackingSettingsSchema.partial();
const aiModelsRequestSchema = z.object({
  apiKey: z.string().min(1),
});
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeIdentityFields(input: { username?: unknown; email?: unknown }) {
  const username = typeof input.username === 'string' ? input.username.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const inferredEmail = !email && EMAIL_PATTERN.test(username) ? username.toLowerCase() : '';

  const resolvedEmail = email || inferredEmail || undefined;
  const resolvedUsername = username || resolvedEmail;

  return {
    username: resolvedUsername,
    email: resolvedEmail,
  };
}

// Helper function to safely parse JSON fields from database
function safeParseJSON(value: any): any {
  // If already an object (including null), return as is
  if (typeof value !== 'string') {
    return value;
  }
  
  // If empty string, return null
  if (value === '') {
    return null;
  }
  
  // Try to parse the JSON string
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('Error parsing JSON:', error, 'Value:', value);
    return null;
  }
}

// Helper function to update daily stats goals when plan changes
async function updateUserDailyStatsGoals(userId: number, userPlan: any) {
  try {
    if (userPlan.goals && typeof userPlan.goals === 'object') {
      const goals = userPlan.goals as any;
      const caloriesGoal = goals.calories || 2000;
      const proteinGoal = goals.protein || 150;
      const carbsGoal = goals.carbs || 250;
      const fatGoal = goals.fat || 65;

      // Update existing daily stats for the user with new goals
      await storage.updateUserDailyStatsGoals(userId, {
        caloriesGoal,
        proteinGoal,
        carbsGoal,
        fatGoal
      });
    }
  } catch (error) {
    console.error('Error updating daily stats goals:', error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust reverse proxy headers for correct client IP detection
  try { app.set('trust proxy', true); } catch {}

  // Ensure uploads directory exists so static handler can mount correctly
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (error) {
    console.error('[SERVER] Failed to ensure uploads directory:', error);
  }

  // Set up sessions with production-ready configuration
  app.use(
    session({
      name: 'connect.sid',
      cookie: {
        maxAge: 86400000, // 24h
        secure: process.env.NODE_ENV === 'production', // only secure over https in production
        sameSite: 'lax',
        httpOnly: true,
        path: '/',
      },
      store: new SessionStore({ checkPeriod: 86400000 }),
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || 'change-me-in-production-very-long-secret'
    })
  );

  // Initialize passport before any feature routes run
  app.use(passport.initialize());
  app.use(passport.session());

  // Import tenant resolver for multi-tenant support
  const { tenantResolver, renderContactHtml } = await import('./saas/tenantResolver');

  const normalizeMainDomainHost = (value?: string | null): string | null => {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }

    // Support either bare hosts (example.com) or full URLs (https://example.com).
    const urlCandidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const hostname = new URL(urlCandidate).hostname.toLowerCase();
      return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
    } catch {
      const fallbackHost = trimmed
        .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
        .split('/')[0]
        .split('?')[0]
        .split('#')[0]
        .split(':')[0]
        .toLowerCase();
      if (!fallbackHost) {
        return null;
      }
      return fallbackHost.startsWith('www.') ? fallbackHost.slice(4) : fallbackHost;
    }
  };
  
  // Apply tenant resolver globally to detect tenant subdomains
  // This middleware sets req.tenant and req.tenantPool if on a tenant subdomain
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const host = req.headers.host?.split(':')[0].toLowerCase();
    const mainDomain = normalizeMainDomainHost(process.env.MAIN_DOMAIN);

    const hasMainDomain = Boolean(host && mainDomain && (host === mainDomain || host.endsWith(`.${mainDomain}`)));
    const hasSubdomain = hasMainDomain && host !== mainDomain && host !== `www.${mainDomain}`;

    // Only invoke tenantResolver when a subdomain exists before the main domain
    if (hasSubdomain) {
      try {
        await tenantResolver(req, res, next);
      } catch (err: any) {
        // If tenant not found or error, continue to main platform
        console.log('[TENANT] Not a valid tenant subdomain, continuing to main platform');
        next();
      }
    } else {
      // Main platform request (root domain)
      next();
    }
  });

  // Helper function to resolve tenant database or central database
  const resolveDb = (req: any) => {
    const tenantPool = req?.tenantPool;
    if (tenantPool) {
      return drizzle(tenantPool, { schema });
    }
    return db;
  };

  const resolveTenantPoolFromSession = async (req: Request) => {
    const existingPool = (req as any).tenantPool;
    if (existingPool) return existingPool;

    const tenantId = (req.user as any)?.tenantId || (req.session as any)?.user?.tenantId;
    if (!tenantId) return undefined;

    try {
      const centralPool = getCentralPool();
      const result = await centralPool.query('SELECT * FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
      const tenant = result.rows[0];
      if (!tenant) return undefined;

      const tenantPool = await getTenantPool(tenant);
      (req as any).tenant = tenant;
      (req as any).tenantPool = tenantPool;
      return tenantPool;
    } catch (error) {
      console.error('[TENANT] Failed to resolve tenant pool from session:', error);
      return undefined;
    }
  };

  const isTenantRequest = (req: any) => Boolean(req?.tenantPool);

  const getDailyStatsByUserAndDateForRequest = async (req: any, userId: number, date: Date) => {
    if (!isTenantRequest(req)) {
      return storage.getDailyStatsByUserAndDate(userId, date);
    }

    const statsDb = resolveDb(req);
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const rows = await statsDb
      .select()
      .from(dailyStats)
      .where(and(
        eq(dailyStats.userId, userId),
        gte(dailyStats.date, startDate),
        lte(dailyStats.date, endDate)
      ))
      .orderBy(desc(dailyStats.date))
      .limit(1);
    return rows[0];
  };

  const getDailyStatsByUserIdForRequest = async (req: any, userId: number) => {
    if (!isTenantRequest(req)) {
      return storage.getDailyStatsByUserId(userId);
    }

    const statsDb = resolveDb(req);
    return statsDb
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.userId, userId))
      .orderBy(desc(dailyStats.date));
  };

  const getDailyStatsByIdForRequest = async (req: any, statsId: number) => {
    if (!isTenantRequest(req)) {
      return storage.getDailyStats(statsId);
    }

    const statsDb = resolveDb(req);
    const [stats] = await statsDb
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.id, statsId))
      .limit(1);
    return stats;
  };

  const getDailyStatsByDateRangeForRequest = async (req: any, userId: number, startDate: Date, endDate: Date) => {
    if (!isTenantRequest(req)) {
      return storage.getDailyStatsByDateRange(userId, startDate, endDate);
    }

    const statsDb = resolveDb(req);
    return statsDb
      .select()
      .from(dailyStats)
      .where(and(
        eq(dailyStats.userId, userId),
        gte(dailyStats.date, startDate),
        lte(dailyStats.date, endDate)
      ))
      .orderBy(dailyStats.date);
  };

  const getWeeklyStatsForRequest = async (req: any, userId: number, startDate: Date) => {
    if (!isTenantRequest(req)) {
      return storage.getWeeklyStats(userId, startDate);
    }

    const statsDb = resolveDb(req);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
    return statsDb
      .select()
      .from(dailyStats)
      .where(and(
        eq(dailyStats.userId, userId),
        gte(dailyStats.date, startDate),
        lt(dailyStats.date, endDate)
      ))
      .orderBy(dailyStats.date);
  };

  const getMealsByDateForRequest = async (req: any, userId: number, date: Date) => {
    if (!isTenantRequest(req)) {
      return storage.getMealsByDate(userId, date);
    }

    const mealsDb = resolveDb(req);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return mealsDb
      .select()
      .from(meals)
      .where(and(
        eq(meals.userId, userId),
        gte(meals.date, startOfDay),
        lte(meals.date, endOfDay)
      ));
  };

  const ensureDailyStatsForRequest = async (req: any, userId: number, date: Date) => {
    let stats = await getDailyStatsByUserAndDateForRequest(req, userId, date);
    if (stats) {
      return stats;
    }

    const userPlan = await getLatestUserPlanForRequest(req, userId);
    let caloriesGoal = 2000;
    let proteinGoal = 150;
    let carbsGoal = 250;
    let fatGoal = 65;

    if (userPlan && userPlan.goals && typeof userPlan.goals === 'object') {
      const goals = userPlan.goals as any;
      caloriesGoal = goals.calories || caloriesGoal;
      proteinGoal = goals.protein || proteinGoal;
      carbsGoal = goals.carbs || carbsGoal;
      fatGoal = goals.fat || fatGoal;
    }

    stats = await createDailyStatsForRequest(req, {
      userId,
      date: new Date(date.getTime()),
      calories: 0,
      caloriesGoal,
      protein: 0,
      proteinGoal,
      carbs: 0,
      carbsGoal,
      fat: 0,
      fatGoal,
      fiber: 0,
      fiberGoal: 30,
      steps: 0,
      stepsGoal: 10000,
      water: 0,
      waterGoal: 8
    });

    return stats;
  };

  const recalculateDailyStatsForRequest = async (req: any, userId: number, mealDate: Date) => {
    const date = new Date(mealDate);
    date.setHours(0, 0, 0, 0);

    const mealsForDate = await getMealsByDateForRequest(req, userId, date);
    const totals = mealsForDate.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.proteins,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fats,
        fiber: acc.fiber + (meal.fiber || 0)
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    );

    const stats = await ensureDailyStatsForRequest(req, userId, date);
    await updateDailyStatsForRequest(req, stats.id, {
      calories: totals.calories,
      protein: totals.protein,
      carbs: totals.carbs,
      fat: totals.fat,
      fiber: totals.fiber
    });
  };

  const createUserPlanForRequest = async (req: any, plan: typeof userPlans.$inferInsert) => {
    if (!isTenantRequest(req)) {
      return storage.createUserPlan(plan);
    }

    const plansDb = resolveDb(req);
    const [created] = await plansDb
      .insert(userPlans)
      .values(plan)
      .returning();
    return created;
  };

  const getUserPlanForRequest = async (req: any, planId: number) => {
    if (!isTenantRequest(req)) {
      return storage.getUserPlan(planId);
    }

    const plansDb = resolveDb(req);
    const [plan] = await plansDb
      .select()
      .from(userPlans)
      .where(eq(userPlans.id, planId))
      .limit(1);
    return plan;
  };

  const getUserPlansByUserIdForRequest = async (req: any, userId: number) => {
    if (!isTenantRequest(req)) {
      return storage.getUserPlansByUserId(userId);
    }

    const plansDb = resolveDb(req);
    return plansDb
      .select()
      .from(userPlans)
      .where(eq(userPlans.userId, userId))
      .orderBy(desc(userPlans.createdAt));
  };

  const getLatestUserPlanForRequest = async (req: any, userId: number) => {
    if (!isTenantRequest(req)) {
      return storage.getLatestUserPlan(userId);
    }

    const plansDb = resolveDb(req);
    const [plan] = await plansDb
      .select()
      .from(userPlans)
      .where(eq(userPlans.userId, userId))
      .orderBy(desc(userPlans.createdAt))
      .limit(1);
    return plan;
  };

  const updateUserPlanForRequest = async (
    req: any,
    planId: number,
    updates: Partial<typeof userPlans.$inferInsert>
  ) => {
    if (!isTenantRequest(req)) {
      return storage.updateUserPlan(planId, updates);
    }

    const plansDb = resolveDb(req);
    const [updated] = await plansDb
      .update(userPlans)
      .set(updates)
      .where(eq(userPlans.id, planId))
      .returning();
    return updated;
  };

  const deleteUserPlanForRequest = async (req: any, planId: number) => {
    if (!isTenantRequest(req)) {
      return storage.deleteUserPlan(planId);
    }

    const plansDb = resolveDb(req);
    const deleted = await plansDb
      .delete(userPlans)
      .where(eq(userPlans.id, planId))
      .returning({ id: userPlans.id });
    return deleted.length > 0;
  };

  const createDailyStatsForRequest = async (req: any, stats: typeof dailyStats.$inferInsert) => {
    if (!isTenantRequest(req)) {
      return storage.createDailyStats(stats);
    }

    const statsDb = resolveDb(req);
    const [created] = await statsDb
      .insert(dailyStats)
      .values(stats)
      .returning();
    return created;
  };

  const updateDailyStatsForRequest = async (req: any, statsId: number, updates: Partial<typeof dailyStats.$inferInsert>) => {
    if (!isTenantRequest(req)) {
      return storage.updateDailyStats(statsId, updates);
    }

    const statsDb = resolveDb(req);
    const [updated] = await statsDb
      .update(dailyStats)
      .set(updates)
      .where(eq(dailyStats.id, statsId))
      .returning();
    return updated;
  };

  const updateUserDailyStatsGoalsForRequest = async (req: any, userId: number, userPlan: any) => {
    try {
      if (!userPlan?.goals || typeof userPlan.goals !== 'object') {
        return;
      }

      const goals = userPlan.goals as any;
      const caloriesGoal = goals.calories || 2000;
      const proteinGoal = goals.protein || 150;
      const carbsGoal = goals.carbs || 250;
      const fatGoal = goals.fat || 65;

      if (!isTenantRequest(req)) {
        await storage.updateUserDailyStatsGoals(userId, {
          caloriesGoal,
          proteinGoal,
          carbsGoal,
          fatGoal,
        });
        return;
      }

      const statsDb = resolveDb(req);
      await statsDb
        .update(dailyStats)
        .set({ caloriesGoal, proteinGoal, carbsGoal, fatGoal })
        .where(eq(dailyStats.userId, userId));
    } catch (error) {
      console.error('Error updating daily stats goals:', error);
    }
  };

  const deleteUserForRequest = async (req: any, userId: number) => {
    if (!isTenantRequest(req)) {
      return storage.deleteUser(userId);
    }

    // Tenant delete: use raw SQL to handle all FK constraints comprehensively
    const tenantPool = (req as any).tenantPool;
    try {
      // Helper: run a query silently ignoring "table does not exist" (42P01) errors
      const safeQuery = async (sql: string, params: any[] = []) => {
        try {
          await tenantPool.query(sql, params);
        } catch (err: any) {
          if (err?.code !== '42P01') throw err; // rethrow unexpected errors
        }
      };

      // ── SET NULL on non-ownership nullable FK columns first ──────────────────
      await safeQuery('UPDATE users SET approved_by = NULL WHERE approved_by = $1', [userId]);
      await safeQuery('UPDATE ai_plan_suggestions SET approved_by = NULL WHERE approved_by = $1', [userId]);
      await safeQuery('UPDATE ai_plan_suggestions SET coach_id = NULL WHERE coach_id = $1', [userId]);
      await safeQuery('UPDATE archive_records SET archived_by = NULL WHERE archived_by = $1', [userId]);
      await safeQuery('UPDATE archive_records SET restore_requested_by = NULL WHERE restore_requested_by = $1', [userId]);
      await safeQuery('UPDATE archive_records SET restored_by = NULL WHERE restored_by = $1', [userId]);
      await safeQuery('UPDATE content_items SET coach_id = NULL WHERE coach_id = $1', [userId]);
      await safeQuery('UPDATE content_reports SET assigned_to = NULL WHERE assigned_to = $1', [userId]);
      await safeQuery('UPDATE escalation_requests SET assigned_to = NULL WHERE assigned_to = $1', [userId]);
      await safeQuery('UPDATE escalation_requests SET resolved_by = NULL WHERE resolved_by = $1', [userId]);
      await safeQuery('UPDATE refund_requests SET reviewed_by = NULL WHERE reviewed_by = $1', [userId]);
      await safeQuery('UPDATE refund_requests SET processed_by = NULL WHERE processed_by = $1', [userId]);
      await safeQuery('UPDATE search_index SET coach_id = NULL WHERE coach_id = $1', [userId]);
      await safeQuery('UPDATE supplement_side_effects SET escalated_to = NULL WHERE escalated_to = $1', [userId]);
      await safeQuery('UPDATE supplement_recommendations SET coach_id = NULL WHERE coach_id = $1', [userId]);
      await safeQuery('UPDATE user_supplement_warnings SET acknowledged_by = NULL WHERE acknowledged_by = $1', [userId]);
      await safeQuery('UPDATE uploaded_files SET coach_id = NULL WHERE coach_id = $1', [userId]);
      await safeQuery('UPDATE user_plans SET coach_id = NULL WHERE coach_id = $1', [userId]);

      // ── DELETE all rows owned by this user ────────────────────────────────────
      // Core fitness data
      await safeQuery('DELETE FROM user_workouts WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM workout_sessions WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM missed_workouts WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM workouts WHERE coach_id = $1', [userId]);
      await safeQuery('DELETE FROM meals WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM progress WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM progress_snapshots WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM daily_stats WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM user_plans WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM user_points_and_streaks WHERE user_id = $1', [userId]);
      // Messages
      await safeQuery('DELETE FROM messages WHERE sender_id = $1 OR receiver_id = $1', [userId]);
      // Notifications & reminders
      await safeQuery('DELETE FROM notifications WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM reminder_settings WHERE user_id = $1', [userId]);
      // AI data
      await safeQuery('DELETE FROM ai_conversations WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM ai_insights WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM ai_plan_suggestions WHERE user_id = $1', [userId]);
      // Credits & billing
      await safeQuery('DELETE FROM credit_transactions_v2 WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM credit_transactions WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM credit_balances WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM credit_accounts WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM financial_transactions WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM financial_transactions WHERE created_by = $1', [userId]);
      await safeQuery('DELETE FROM invoices WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM payments WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM payment_methods WHERE user_id = $1', [userId]);
      // Shop
      await safeQuery('DELETE FROM cart_items WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [userId]);
      await safeQuery('DELETE FROM orders WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM refund_requests WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM product_clicks WHERE user_id = $1', [userId]);
      // Courses
      await safeQuery('DELETE FROM lesson_progress WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM course_progress WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM course_reviews WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM course_certificate_issuances WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM course_enrollments WHERE user_id = $1', [userId]);
      // Achievements & social
      await safeQuery('DELETE FROM achievement_shares WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM achievements WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM encouragements WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM friendships WHERE user_id = $1 OR friend_id = $1', [userId]);
      await safeQuery('DELETE FROM group_members WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM workshop_attendees WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM topic_replies WHERE author_id = $1', [userId]);
      await safeQuery('DELETE FROM discussion_topics WHERE author_id = $1', [userId]);
      // Content
      await safeQuery('DELETE FROM content_bookmarks WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM content_ratings WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM content_reports WHERE reporter_id = $1', [userId]);
      await safeQuery('DELETE FROM content_library WHERE coach_id = $1', [userId]);
      await safeQuery('DELETE FROM uploaded_files WHERE user_id = $1', [userId]);
      // Supplements
      await safeQuery('DELETE FROM user_supplement_warnings WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM supplement_effectiveness_ratings WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM supplement_reminders WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM supplement_side_effects WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM supplement_recommendations WHERE user_id = $1', [userId]);
      // Tracking & logs
      await safeQuery('DELETE FROM event_tracking WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM user_logins WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM search_history WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM search_index WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM audit_logs WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM system_logs WHERE user_id = $1', [userId]);
      // Escalations & reports
      await safeQuery('DELETE FROM escalation_requests WHERE user_id = $1', [userId]);
      await safeQuery('DELETE FROM reports WHERE user_id = $1', [userId]);
      // Referrals
      await safeQuery('DELETE FROM referrals WHERE referrer_id = $1 OR referred_user_id = $1', [userId]);
      // Coach-specific
      await safeQuery('DELETE FROM coach_invitations WHERE user_id = $1 OR coach_id = $1', [userId]);
      await safeQuery('DELETE FROM coach_info WHERE coach_id = $1', [userId]);
      await safeQuery('DELETE FROM coach_products WHERE coach_id = $1', [userId]);
      // Ad data
      await safeQuery('DELETE FROM ad_metrics WHERE user_id = $1', [userId]);

      // ── Finally delete the user ───────────────────────────────────────────────
      const result = await tenantPool.query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [userId]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting tenant user and related data:', error);
      return false;
    }
  };

  const getTenantUserPointsAndStreaks = async (req: any, userId: number) => {
    const pointsDb = resolveDb(req);
    const [record] = await pointsDb
      .select()
      .from(userPointsAndStreaks)
      .where(eq(userPointsAndStreaks.userId, userId))
      .limit(1);
    return record;
  };

  const createTenantUserPointsAndStreaks = async (req: any, userId: number) => {
    const pointsDb = resolveDb(req);
    const [created] = await pointsDb
      .insert(userPointsAndStreaks)
      .values({
        userId,
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0
      })
      .returning();
    return created;
  };

  const updateTenantUserPointsAndStreaks = async (
    req: any,
    userId: number,
    data: Partial<schema.UserPointsAndStreaks>
  ) => {
    const pointsDb = resolveDb(req);
    const [updated] = await pointsDb
      .update(userPointsAndStreaks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userPointsAndStreaks.userId, userId))
      .returning();
    return updated;
  };

  const addPointsForRequest = async (req: any, userId: number, points: number, actionType: string) => {
    if (!isTenantRequest(req)) {
      return storage.addPoints(userId, points, actionType);
    }

    let userPoints = await getTenantUserPointsAndStreaks(req, userId);
    if (!userPoints) {
      userPoints = await createTenantUserPointsAndStreaks(req, userId);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let canAddPoints = false;
    const updateFields: Partial<schema.UserPointsAndStreaks> = {};

    switch (actionType) {
      case 'breakfast': {
        const lastBreakfast = userPoints.lastBreakfastLogDate ? new Date(userPoints.lastBreakfastLogDate) : null;
        if (!lastBreakfast || lastBreakfast < today) {
          canAddPoints = true;
          updateFields.lastBreakfastLogDate = new Date();
        }
        break;
      }
      case 'lunch': {
        const lastLunch = userPoints.lastLunchLogDate ? new Date(userPoints.lastLunchLogDate) : null;
        if (!lastLunch || lastLunch < today) {
          canAddPoints = true;
          updateFields.lastLunchLogDate = new Date();
        }
        break;
      }
      case 'dinner': {
        const lastDinner = userPoints.lastDinnerLogDate ? new Date(userPoints.lastDinnerLogDate) : null;
        if (!lastDinner || lastDinner < today) {
          canAddPoints = true;
          updateFields.lastDinnerLogDate = new Date();
        }
        break;
      }
      case 'snack': {
        const lastSnack = userPoints.lastSnackLogDate ? new Date(userPoints.lastSnackLogDate) : null;
        const isNewDay = !lastSnack || lastSnack < today;
        const snackCount = isNewDay ? 0 : userPoints.snackLogsToday;

        if (snackCount < 2) {
          canAddPoints = true;
          updateFields.lastSnackLogDate = new Date();
          updateFields.snackLogsToday = snackCount + 1;
        }
        break;
      }
      case 'workout': {
        const lastWorkout = userPoints.lastWorkoutLogDate ? new Date(userPoints.lastWorkoutLogDate) : null;
        if (!lastWorkout || lastWorkout < today) {
          canAddPoints = true;
          updateFields.lastWorkoutLogDate = new Date();
        }
        break;
      }
      case 'weight': {
        const lastWeight = userPoints.lastWeightLogDate ? new Date(userPoints.lastWeightLogDate) : null;
        if (!lastWeight || lastWeight < today) {
          canAddPoints = true;
          updateFields.lastWeightLogDate = new Date();
        }
        break;
      }
      case 'store': {
        canAddPoints = true;
        updateFields.lastStorePurchaseDate = new Date();
        break;
      }
      default:
        canAddPoints = false;
    }

    if (canAddPoints) {
      updateFields.totalPoints = userPoints.totalPoints + points;
      return updateTenantUserPointsAndStreaks(req, userId, updateFields);
    }

    return userPoints;
  };

  const updateStreakForRequest = async (req: any, userId: number, hasActivity: boolean) => {
    if (!isTenantRequest(req)) {
      return storage.updateStreak(userId, hasActivity);
    }

    let userPoints = await getTenantUserPointsAndStreaks(req, userId);
    if (!userPoints) {
      userPoints = await createTenantUserPointsAndStreaks(req, userId);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastActivity = userPoints.lastActivityDate ? new Date(userPoints.lastActivityDate) : null;

    if (hasActivity) {
      if (!lastActivity || lastActivity < today) {
        const updateFields: Partial<schema.UserPointsAndStreaks> = {
          lastActivityDate: new Date()
        };

        if (!lastActivity) {
          updateFields.currentStreak = 1;
          updateFields.longestStreak = Math.max(1, userPoints.longestStreak);
        } else {
          const lastActivityDate = new Date(lastActivity);
          lastActivityDate.setHours(0, 0, 0, 0);

          if (lastActivityDate.getTime() === yesterday.getTime()) {
            updateFields.currentStreak = userPoints.currentStreak + 1;
            updateFields.longestStreak = Math.max(userPoints.currentStreak + 1, userPoints.longestStreak);
          } else if (lastActivityDate.getTime() < yesterday.getTime()) {
            updateFields.currentStreak = 1;
          }
        }

        return updateTenantUserPointsAndStreaks(req, userId, updateFields);
      }
    }

    return userPoints;
  };

  const getUserWorkoutsByUserIdForRequest = async (req: any, userId: number) => {
    if (!isTenantRequest(req)) {
      return storage.getUserWorkoutsByUserId(userId);
    }

    const workoutsDb = resolveDb(req);
    return workoutsDb.select().from(userWorkouts).where(eq(userWorkouts.userId, userId));
  };

  const getUserWorkoutsByDateForRequest = async (req: any, userId: number, date: Date) => {
    if (!isTenantRequest(req)) {
      return storage.getUserWorkoutsByDate(userId, date);
    }

    const workoutsDb = resolveDb(req);
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    return workoutsDb
      .select()
      .from(userWorkouts)
      .where(
        and(
          eq(userWorkouts.userId, userId),
          gte(userWorkouts.scheduledFor, startDate),
          lte(userWorkouts.scheduledFor, endDate)
        )
      );
  };

  const getUserWorkoutForRequest = async (req: any, userWorkoutId: number) => {
    if (!isTenantRequest(req)) {
      return storage.getUserWorkout(userWorkoutId);
    }

    const workoutsDb = resolveDb(req);
    const [workout] = await workoutsDb
      .select()
      .from(userWorkouts)
      .where(eq(userWorkouts.id, userWorkoutId))
      .limit(1);
    return workout;
  };

  const createUserWorkoutForRequest = async (req: any, data: schema.InsertUserWorkout) => {
    if (!isTenantRequest(req)) {
      return storage.createUserWorkout(data);
    }

    const workoutsDb = resolveDb(req);
    const [created] = await workoutsDb
      .insert(userWorkouts)
      .values(data)
      .returning();
    return created;
  };

  const markUserWorkoutCompleteForRequest = async (req: any, userWorkoutId: number, completedAt: Date) => {
    if (!isTenantRequest(req)) {
      return storage.markUserWorkoutComplete(userWorkoutId, completedAt);
    }

    const workoutsDb = resolveDb(req);
    const [updated] = await workoutsDb
      .update(userWorkouts)
      .set({ completedAt, completed: true })
      .where(eq(userWorkouts.id, userWorkoutId))
      .returning();
    return updated;
  };

  const deleteUserWorkoutForRequest = async (req: any, userWorkoutId: number) => {
    if (!isTenantRequest(req)) {
      return storage.deleteUserWorkout(userWorkoutId);
    }

    const workoutsDb = resolveDb(req);
    await workoutsDb.delete(userWorkouts).where(eq(userWorkouts.id, userWorkoutId));
    return true;
  };

  const getProgressByUserIdForRequest = async (req: any, userId: number) => {
    if (!isTenantRequest(req)) {
      return storage.getProgressByUserId(userId);
    }

    const progressDb = resolveDb(req);
    return progressDb.select().from(progress).where(eq(progress.userId, userId));
  };

  const getProgressByDateForRequest = async (req: any, userId: number, date: Date) => {
    if (!isTenantRequest(req)) {
      return storage.getProgressByDate(userId, date);
    }

    const progressDb = resolveDb(req);
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    const [record] = await progressDb
      .select()
      .from(progress)
      .where(
        and(
          eq(progress.userId, userId),
          gte(progress.date, startDate),
          lte(progress.date, endDate)
        )
      );

    return record;
  };

  const getProgressByDateRangeForRequest = async (req: any, userId: number, startDate: Date, endDate: Date) => {
    if (!isTenantRequest(req)) {
      return storage.getProgressByDateRange(userId, startDate, endDate);
    }

    const progressDb = resolveDb(req);
    return progressDb
      .select()
      .from(progress)
      .where(
        and(
          eq(progress.userId, userId),
          gte(progress.date, startDate),
          lte(progress.date, endDate)
        )
      )
      .orderBy(progress.date);
  };

  const createProgressForRequest = async (req: any, data: schema.InsertProgress) => {
    if (!isTenantRequest(req)) {
      return storage.createProgress(data);
    }

    const progressDb = resolveDb(req);
    const [created] = await progressDb.insert(progress).values(data).returning();
    return created;
  };

  const getProgressForRequest = async (req: any, progressId: number) => {
    if (!isTenantRequest(req)) {
      return storage.getProgress(progressId);
    }

    const progressDb = resolveDb(req);
    const [record] = await progressDb
      .select()
      .from(progress)
      .where(eq(progress.id, progressId))
      .limit(1);
    return record;
  };

  const updateProgressForRequest = async (req: any, progressId: number, data: Partial<schema.Progress>) => {
    if (!isTenantRequest(req)) {
      return storage.updateProgress(progressId, data);
    }

    const progressDb = resolveDb(req);
    const [updated] = await progressDb
      .update(progress)
      .set(data)
      .where(eq(progress.id, progressId))
      .returning();
    return updated;
  };

  const deleteProgressForRequest = async (req: any, progressId: number) => {
    if (!isTenantRequest(req)) {
      return storage.deleteProgress(progressId);
    }

    const progressDb = resolveDb(req);
    await progressDb.delete(progress).where(eq(progress.id, progressId));
    return true;
  };

  const createWorkoutSessionForRequest = async (req: any, data: schema.InsertWorkoutSession) => {
    if (!isTenantRequest(req)) {
      return storage.createWorkoutSession(data);
    }

    const sessionsDb = resolveDb(req);
    const [created] = await sessionsDb.insert(workoutSessions).values(data).returning();
    return created;
  };

  const deleteWorkoutSessionForRequest = async (req: any, sessionId: number) => {
    if (!isTenantRequest(req)) {
      return storage.deleteWorkoutSession(sessionId);
    }

    const sessionsDb = resolveDb(req);
    await sessionsDb.delete(workoutSessions).where(eq(workoutSessions.id, sessionId));
    return true;
  };

  const getWorkoutSessionsByUserIdForRequest = async (req: any, userId: number) => {
    if (!isTenantRequest(req)) {
      return storage.getWorkoutSessionsByUserId(userId);
    }

    const sessionsDb = resolveDb(req);
    return sessionsDb.select().from(workoutSessions).where(eq(workoutSessions.userId, userId));
  };

  const getWorkoutSessionsByDateRangeForRequest = async (req: any, userId: number, startDate: Date, endDate: Date) => {
    if (!isTenantRequest(req)) {
      return storage.getWorkoutSessionsByDateRange(userId, startDate, endDate);
    }

    const sessionsDb = resolveDb(req);
    return sessionsDb
      .select()
      .from(workoutSessions)
      .where(
        and(
          eq(workoutSessions.userId, userId),
          gte(workoutSessions.completedAt, startDate),
          lte(workoutSessions.completedAt, endDate)
        )
      );
  };

  // Central contact page (available even if SPA routing fails)
  app.get('/contact', (_req: Request, res: Response) => {
    res.status(200).send(renderContactHtml());
  });

  // Contact form submission -> sends email via SMTP
  app.post('/api/contact', async (req: Request, res: Response) => {
    const { name, email, message } = req.body || {};

    if (!name || !email || !message) {
      return res.status(400).json({ message: 'الاسم والبريد الإلكتروني والرسالة مطلوبة.' });
    }

    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).trim();
    const trimmedMessage = String(message).trim();

    if (trimmedName.length < 2 || trimmedName.length > 120) {
      return res.status(400).json({ message: 'يرجى إدخال اسم صحيح.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ message: 'يرجى إدخال بريد إلكتروني صحيح.' });
    }

    if (trimmedMessage.length < 5 || trimmedMessage.length > 2000) {
      return res.status(400).json({ message: 'يرجى إدخال رسالة مناسبة.' });
    }

    try {
      const emailConfig = await getEmailConfigForScope(req);
      if (!emailConfig) {
        console.error('[CONTACT] SMTP configuration is incomplete in dashboard settings.');
        return res.status(500).json({ message: 'خدمة البريد الإلكتروني غير مفعلة حالياً.' });
      }

      const toAddress = emailConfig.to || emailConfig.from;

      const textBody = `New contact message\n\nName: ${trimmedName}\nEmail: ${trimmedEmail}\nMessage:\n${trimmedMessage}`;
      const htmlBody = `<p><strong>Name:</strong> ${trimmedName}</p><p><strong>Email:</strong> ${trimmedEmail}</p><p><strong>Message:</strong><br/>${trimmedMessage.replace(/\n/g, '<br/>')}</p>`;

      const sent = await sendEmail({
        to: toAddress,
        subject: `Contact Form: ${trimmedName} (${trimmedEmail})`,
        text: textBody,
        html: htmlBody,
      }, req);

      if (!sent) {
        return res.status(500).json({ message: 'فشل إرسال الرسالة. حاول لاحقاً.' });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('[CONTACT] Failed to send email:', error);
      return res.status(500).json({ message: 'فشل إرسال الرسالة. حاول لاحقاً.' });
    }
  });

  // Hydrate req.user from session data and provide a safe req.isAuthenticated fallback
  app.use(async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        if (req.session?.user) {
          req.user = req.session.user as any;
        } else if (req.session?.passport?.user) {
          const sessionUserId = Number(req.session.passport.user);
          if (Number.isFinite(sessionUserId)) {
            try {
              const sessionUser = await storage.getUser(sessionUserId);
              if (sessionUser) {
                req.user = sessionUser;
                req.session.user = sessionUser as any;
              }
            } catch (error) {
              console.error('[SERVER] Failed to hydrate user from session passport data:', error);
            }
          }
        }
      }

      if (typeof req.isAuthenticated !== 'function') {
        (req as any).isAuthenticated = () => Boolean(req.user);
      }
    } catch (error) {
      console.error('[SERVER] Auth helper middleware error:', error);
    }

    next();
  });

  // Expose uploads so signed URLs resolve to real files
  app.use(
    '/uploads',
    express.static(uploadsDir, {
      fallthrough: false,
      maxAge: process.env.NODE_ENV === 'production' ? 1000 * 60 * 60 * 24 * 7 : 0,
    })
  );

  // Set up food database routes - accessible without authentication
  app.use("/api/food-database", foodRouter);

  // Set up supplement routes (Epic A) - requires authentication
  setupSupplementRoutes(app);

  // Set up supplement follow-up routes (Epic B) - requires authentication
  setupSupplementFollowupRoutes(app);

  // Set up notification & reminder routes (Epic C) - requires authentication
  setupNotificationRoutes(app);

  // Set up files & reports routes (Epic D) - requires authentication
  setupFilesReportsRoutes(app);

  // Set up AI assistant routes (Epic E) - requires authentication
  registerAiAssistantRoutes(app);

  // Set up community & engagement routes (Epic F) - requires authentication
  app.use("/api", communityRouter);

  // Set up content hub routes (Epic H) - requires authentication
  app.use("/api", contentRouter);

  // Set up blog upload routes (Admin/Coach)
  app.use("/api", blogRouter);

  // SEO settings and public SEO endpoints
  registerSeoRoutes(app);

  // Branding settings endpoints
  registerBrandingRoutes(app);

  // Public footer/page content settings endpoints
  registerPublicContentRoutes(app);

  // Set up courses routes (Epic I - Ads & Courses) - requires authentication
  registerCoursesRoutes(app);

  // Multi-tenant SaaS provisioning & tenant resolution endpoints
  try {
    registerSaasRoutes(app);
    registerSaasAdminRoutes(app);
  } catch (error) {
    console.error('[SAAS] Failed to register SaaS routes:', error);
  }

  // Stripe payment routes (platform and tenant level)
  try {
    registerPaymentRoutes(app);
  } catch (error) {
    console.error('[PAYMENT] Failed to register payment routes:', error);
  }


  // Simple username format validator shared by endpoints
  const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;

  // Username availability check endpoint
  app.get('/api/auth/username-available', async (req: Request, res: Response) => {
    try {
      const raw = String((req.query.username ?? '') as string).trim();
      if (!raw) {
        return res.status(400).json({ available: false, reason: 'missing', suggestions: [] });
      }
      if (raw.length < 3 || !USERNAME_REGEX.test(raw)) {
        // Invalid format; treat as not available for UX purposes, client will show format guidance
        return res.json({ available: false, reason: 'invalid', suggestions: [] });
      }

      const existing = await storage.getUserByUsername(raw);
      if (!existing) {
        return res.json({ available: true, suggestions: [] });
      }

      // Build up to 3 available suggestions by appending numbers/underscores
      const candidates: string[] = [];
      const base = raw.length > 24 ? raw.slice(0, 24) : raw; // keep reasonable length
      const seeds = [
        `${base}1`, `${base}123`, `${base}_1`, `${base}-1`, `${base}${Math.floor(100 + Math.random()*900)}`,
        `${base}_${new Date().getFullYear() % 100}`
      ];
      // Deduplicate seeds while preserving order
      const uniqueSeeds = Array.from(new Set(seeds));

      for (const cand of uniqueSeeds) {
        if (candidates.length >= 3) break;
        if (!USERNAME_REGEX.test(cand)) continue;
        try {
          const taken = await storage.getUserByUsername(cand);
          if (!taken) candidates.push(cand);
        } catch {}
      }

      // If still less than 3, brute-force append incremental numbers
      if (candidates.length < 3) {
        let i = 2;
        while (candidates.length < 3 && i < 100) {
          const cand = `${base}${i}`;
          if (USERNAME_REGEX.test(cand)) {
            try {
              const taken = await storage.getUserByUsername(cand);
              if (!taken) candidates.push(cand);
            } catch {}
          }
          i++;
        }
      }

      return res.json({ available: false, suggestions: candidates });
    } catch (err) {
      console.error('Error in /api/auth/username-available:', err);
      return res.status(500).json({ available: false, suggestions: [] });
    }
  });
  // Lightweight geo endpoint to guess ISO country code from headers (no external calls)
  app.get('/api/geo/guess-country', (req, res) => {
    try {
      // Common headers set by reverse proxies / platforms
      const candidates: Array<[string, string | undefined]> = [
        ['cf-ipcountry', req.header('cf-ipcountry')],
        ['x-vercel-ip-country', req.header('x-vercel-ip-country')],
        ['x-country', req.header('x-country')],
        ['x-country-code', req.header('x-country-code')],
        ['x-geo-country', req.header('x-geo-country')],
        ['fastly-country-code', req.header('fastly-country-code')],
        ['x-appengine-country', req.header('x-appengine-country')],
        ['geoip-country-code', req.header('geoip-country-code')],
      ];
      let iso: string | undefined;
      for (const [, val] of candidates) {
        if (val && /^[A-Za-z]{2}$/.test(val)) { iso = val.toUpperCase(); break; }
      }
      // No language fallback; if no headers, try external lookup below
      // Last resort: external lookup by client IP with a very short timeout
      const done = (code?: string) => res.json({ iso: code });
      if (iso) return done(iso);
      // Extract client IP from x-forwarded-for or connection
      let ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
        || (req.socket?.remoteAddress || req.ip || '').toString();
      if (!ip) return done(undefined);
      // Normalize IPv6 mapped IPv4 like ::ffff:127.0.0.1
      if (ip.startsWith('::ffff:')) ip = ip.substring(7);
      // Skip private/local addresses
      const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|127\.|::1|fc00:|fe80:)/.test(ip);
      if (isPrivate) return done(undefined);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 700);
      fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=country_code`, { signal: controller.signal })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          clearTimeout(timeout);
          const cc = data?.country_code && typeof data.country_code === 'string' ? data.country_code.toUpperCase() : undefined;
          return done(cc);
        })
        .catch(() => {
          clearTimeout(timeout);
          return done(undefined);
        });
    } catch (e) {
      return res.json({ iso: undefined });
    }
  });

  // Helper function to convert snake_case database columns to camelCase
  const mapTenantRow = (row: Record<string, any>) => {
    const mapped: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const camelKey = key.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
      mapped[camelKey] = value;
    }
    return mapped;
  };

  // Configure local strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email', // Use email field for authentication
        passwordField: 'password',
        passReqToCallback: true // Need request to get tenant info
      },
      async (req, email, password, done) => {
        try {
          let user;
          try {
            // Check if this is a tenant request (tenant pool exists in request)
            const tenantPool = (req as any).tenantPool;
            
            if (tenantPool) {
              // Tenant authentication: query the tenant's database directly
              console.log('[TENANT AUTH] Looking up user in tenant database:', { email });

              // Try finding by email first
              let result = await tenantPool.query(
                'SELECT * FROM users WHERE email = $1 LIMIT 1',
                [email]
              );

              // Fallback to username if email not found (for backward compatibility)
              if (result.rows.length === 0) {
                result = await tenantPool.query(
                  'SELECT * FROM users WHERE username = $1 LIMIT 1',
                  [email]
                );
              }
              
              if (result.rows.length > 0) {
                // Convert snake_case database columns to camelCase
                user = mapTenantRow(result.rows[0]);
                console.log('[TENANT AUTH] User found, mapped to camelCase:', { id: user.id, role: user.role, isApproved: user.isApproved });
              }
            } else {
              // Main platform authentication: use the global storage
              // Try to find user by email
              user = await storage.getUserByEmail(email);
              
              // Fallback to username if email not found (for backwards compatibility)
              if (!user) {
                user = await storage.getUserByUsername(email);
              }
            }
          } catch (dbErr) {
            console.error('DB error during user lookup:', dbErr);
            return done(new Error('Database lookup failed'));
          }
          if (!user) {

            return done(null, false, { message: "Incorrect credentials." });
          }
          if (!user.password) {
            return done(null, false, { message: "Invalid credentials." });
          }
          const isLikelyBcrypt = /^\$2[aby]\$\d{2}\$/.test(user.password) && user.password.length === 60;
          let passwordMatch = false;
          if (isLikelyBcrypt) {
            try {
              passwordMatch = await bcrypt.compare(password, user.password);
            } catch (cmpErr) {
              console.error('bcrypt compare failed:', cmpErr);
              return done(new Error('Password verification failed'));
            }
          } else {
            // Legacy plaintext password stored. Migrate if matches.
            if (password === user.password) {
              passwordMatch = true;
              console.warn('Legacy plaintext password detected for user - migrating to bcrypt hash.');
              try {
                const salt = await bcrypt.genSalt(10);
                const newHash = await bcrypt.hash(password, salt);
                const tenantPool = (req as any).tenantPool;
                if (tenantPool) {
                  await tenantPool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [newHash, user.id]);
                } else {
                  await storage.updateUser(user.id, { password: newHash });
                }
              } catch (migrateErr) {
                console.error('Failed to migrate legacy password for user', migrateErr);
                // Continue with login anyway since plaintext matched
              }
            }
          }
          if (!passwordMatch) {

            return done(null, false, { message: "Incorrect password." });
          }

          // Check if coach account is approved
          if (user.role === 'coach' && !user.isApproved) {

            return done(null, false, { message: "Your coach account is pending admin approval." });
          }

          // If this is a tenant login, attach the tenant ID to the user object
          const tenant = (req as any).tenant;
          if (tenant) {
            user.tenantId = tenant.id;
            console.log('[TENANT AUTH] Login successful for tenant:', { tenantId: tenant.id, userId: user.id });
          }

          return done(null, user);
        } catch (err) {
          console.error('Authentication error:', err);
          return done(err);
        }
      }
    )
  );

  // Serialize user to session
  passport.serializeUser((user: any, done) => {
    // Store user ID and tenant ID (if tenant user) in session
    const sessionData: any = { id: user.id };
    if (user.tenantId || user.tenant_id) {
      sessionData.tenantId = user.tenantId || user.tenant_id;
    }
    done(null, sessionData);
  });

  // Deserialize user from session
  passport.deserializeUser(async (sessionData: any, done) => {
    // Handle both old format (just ID) and new format (object with id and tenantId)
    const userId = typeof sessionData === 'number' ? sessionData : sessionData.id;
    const tenantId = typeof sessionData === 'object' ? sessionData.tenantId : null;
    
    console.log('Deserializing user:', { userId, tenantId });
    
    try {
      let user;
      
      if (tenantId) {
        // Tenant user: get tenant pool and query tenant database
        const centralPool = (await import('./saas/centralDb')).getCentralPool();
        const tenantResult = await centralPool.query(
          'SELECT * FROM tenants WHERE id = $1',
          [tenantId]
        );
        
        if (tenantResult.rows.length > 0) {
          const tenant = tenantResult.rows[0];
          const { getTenantPool } = await import('./saas/dbManager');
          const tenantPool = await getTenantPool(tenant);
          
          const userResult = await tenantPool.query(
            'SELECT * FROM users WHERE id = $1',
            [userId]
          );
          
          if (userResult.rows.length > 0) {
            // Convert snake_case columns to camelCase for consistency
            user = mapTenantRow(userResult.rows[0]);
            // Attach tenant info to user object for reference
            user.tenantId = tenantId;
          }
        }
      } else {
        // Main platform user
        user = await storage.getUser(userId);
      }
      
      console.log('Deserialized user:', user ? { id: user.id, username: user.username, tenantId: user.tenantId } : 'not found');
      done(null, user);
    } catch (err) {
      console.error('Error deserializing user:', err);
      done(err);
    }
  });

  // Auth middleware
  const isAuthenticated = async (req: Request, res: Response, next: any) => {
    console.log('Auth check - isAuthenticated:', req.isAuthenticated());
    console.log('Auth check - session ID:', req.session.id);
    console.log('Auth check - user:', req.user ? { id: (req.user as any).id, username: (req.user as any).username, tenantId: (req.user as any).tenantId } : null);
    console.log('Auth check - session.user:', req.session?.user ? { id: req.session.user.id, username: req.session.user.username, tenantId: req.session.user.tenantId } : null);
    console.log('Auth check - session.passport:', req.session.passport);

    // Check if user is authenticated through passport
    if (req.isAuthenticated() && req.user) {
      console.log('User authenticated via passport');
      
      // Update last activity timestamp (only for main platform users)
      if (!(req.user as any).tenantId) {
        try {
          await storage.updateUser((req.user as any).id, { 
            lastActivityAt: new Date() 
          });
        } catch (err) {
          console.error('Failed to update lastActivityAt:', err);
        }
      }
      
      return next();
    }

    // Check if user is stored in session (for frontend auth state)
    if (req.session && req.session.user) {
      req.user = req.session.user as any;
      console.log('User found in session:', { id: req.session.user.id, username: req.session.user.username, tenantId: req.session.user.tenantId });
      
      // Update last activity timestamp (only for main platform users)
      if (!req.session.user.tenantId) {
        try {
          await storage.updateUser(req.session.user.id, { 
            lastActivityAt: new Date() 
          });
        } catch (err) {
          console.error('Failed to update lastActivityAt:', err);
        }
      }
      
      return next();
    }

    // Try to deserialize from session manually if passport isn't working
    if (req.session && req.session.passport && req.session.passport.user) {
      try {
        // Handle both old format (just ID) and new format (object with id and tenantId)
        const sessionData = req.session.passport.user;
        const userId = typeof sessionData === 'number' ? sessionData : sessionData.id;
        const tenantId = typeof sessionData === 'object' ? sessionData.tenantId : null;
        
        let user;
        
        if (tenantId) {
          // Tenant user: get tenant pool and query tenant database
          const centralPool = (await import('./saas/centralDb')).getCentralPool();
          const tenantResult = await centralPool.query(
            'SELECT * FROM tenants WHERE id = $1',
            [tenantId]
          );
          
          if (tenantResult.rows.length > 0) {
            const tenant = tenantResult.rows[0];
            const { getTenantPool } = await import('./saas/dbManager');
            const tenantPool = await getTenantPool(tenant);
            
            const userResult = await tenantPool.query(
              'SELECT * FROM users WHERE id = $1',
              [userId]
            );
            
            if (userResult.rows.length > 0) {
              // Convert snake_case columns to camelCase for consistency
              user = mapTenantRow(userResult.rows[0]);
              user.tenantId = tenantId;
            }
          }
        } else {
          // Main platform user
          user = await storage.getUser(userId);
        }
        
        if (user) {
          req.user = user;
          console.log('User manually deserialized from session:', { id: user.id, username: user.username, tenantId: user.tenantId });
          
          // Update last activity timestamp - only for main platform users
          if (!tenantId) {
            try {
              await storage.updateUser(user.id, { 
                lastActivityAt: new Date() 
              });
            } catch (err) {
              console.error('Failed to update lastActivityAt:', err);
            }
          }
          
          return next();
        }
      } catch (err) {
        console.error('Error manually deserializing user:', err);
      }
    }

    // No fallback authentication - require proper session-based authentication

    // If no authenticated user, return 401
    console.log('No authenticated user found - returning 401');
    return res.status(401).json({ message: "Authentication required" });
  };

  // Credit billing routes (scope-aware for central vs tenant)
  try {
    registerCreditBillingRoutes(app, { isAuthenticated });
  } catch (error) {
    console.error('[CREDITS] Failed to register credit billing routes:', error);
  }

  // Middleware to ensure user is admin or coach
  const isCoachOrAdmin = async (req: Request, res: Response, next: any) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if ((user.role === 'admin' || user.role === 'super_admin') || user.role === 'coach' || user.role === 'gym') {
        return next();
      }

      return res.status(403).json({ message: "Access denied. Admin or coach role required." });
    } catch (error) {
      console.error('Error in isCoachOrAdmin middleware:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  const isGymOrAdmin = async (req: Request, res: Response, next: any) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if ((user.role === 'admin' || user.role === 'super_admin') || user.role === 'gym') {
        return next();
      }

      return res.status(403).json({ message: "Access denied. Admin or gym role required." });
    } catch (error) {
      console.error('Error in isGymOrAdmin middleware:', error);
      return res.status(500).json({ message: "Internal server error" });
    }
  };

  const sanitizeUser = (user: User) => {
    const { password, ...userData } = user as any;
    return userData;
  };

  const resolveViewerGymId = (user: User | undefined | null) => {
    if (!user) return null;
    if (user.role === 'gym') {
      return user.gymId || user.id;
    }
    return user.gymId ?? null;
  };

  const canViewUserProfile = (viewer: User, target: User): boolean => {
    if (!viewer) return false;
    if ((viewer.role === 'admin' || viewer.role === 'super_admin')) return true;
    if (viewer.id === target.id) return true;

    // Allow anyone to view coach profiles (public profiles for course instructors)
    if (target.role === 'coach') return true;

    if (viewer.role === 'coach') {
      if (target.role === 'user') return target.coachId === viewer.id;
      return target.id === viewer.id;
    }

    if (viewer.role === 'gym') {
      const viewerGymId = resolveViewerGymId(viewer);
      if (!viewerGymId) return false;
      if (target.role === 'gym') {
        const targetGymId = resolveViewerGymId(target);
        return targetGymId === viewerGymId;
      }
      if (target.role === 'coach') {
        return target.gymId === viewerGymId;
      }
      return target.gymId === viewerGymId;
    }

    if (viewer.role === 'user') {
      if (target.role === 'coach' && viewer.coachId === target.id) return true;
      return target.id === viewer.id;
    }

    return false;
  };

  type HttpError = Error & { status?: number };

  const createHttpError = (status: number, message: string): HttpError => {
    const err = new Error(message) as HttpError;
    err.status = status;
    return err;
  };

  const paymentMethodEnum = z.enum(["card", "cod"]);
  const paymentStatusEnum = z.enum(["pending", "paid", "failed", "refunded"]);
  const cartItemPayloadSchema = z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
  });
  const updateCartQuantitySchema = z.object({
    quantity: z.number().int().min(0).max(99),
  });
  const cartCheckoutSchema = z.object({
    shippingAddress: z.string().min(5, "Shipping address is required"),
    shippingCity: z.string().min(2, "City is required"),
    shippingCountry: z.string().min(2, "Country is required"),
    shippingPhone: z.string().min(5, "Phone number is required"),
    notes: z.string().max(500).optional(),
    paymentMethod: paymentMethodEnum.default("card"),
    paymentProvider: z.enum(["stripe", "paypal", "paymob"]).optional(),
  });
  const directOrderSchema = z.object({
    items: z.array(cartItemPayloadSchema),
    shippingAddress: z.string().optional(),
    shippingCity: z.string().optional(),
    shippingCountry: z.string().optional(),
    shippingPhone: z.string().optional(),
    notes: z.string().optional(),
    paymentMethod: paymentMethodEnum.optional(),
    paymentStatus: paymentStatusEnum.optional(),
  });

  type CartItemWithProduct = CartItem & { product: Product };

  const buildCartResponse = (items: CartItemWithProduct[] = []) => {
    const currency = process.env.STORE_CURRENCY || "EGP";
    const normalizedItems = items.map((item) => {
      const lineTotal = Number((item.product.price * item.quantity).toFixed(2));
      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        product: item.product,
        lineTotal,
      };
    });

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const itemCount = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);

    return {
      items: normalizedItems,
      subtotal,
      currency,
      itemCount,
    };
  };

  const mapTenantStoreRow = (row: Record<string, any>) => {
    const mapped: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const camelKey = key.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
      mapped[camelKey] = value;
    }
    return mapped;
  };

  const fetchTenantCartItemsWithProducts = async (tenantPool: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }, userId: number) => {
    const cartResult = await tenantPool.query('SELECT * FROM cart_items WHERE user_id = $1', [userId]);
    const cartItems = cartResult.rows.map(mapTenantStoreRow);
    if (cartItems.length === 0) return [];

    const productIds = cartItems.map((item: any) => item.productId);
    const productsResult = await tenantPool.query('SELECT * FROM products WHERE id = ANY($1::int[])', [productIds]);
    const products = productsResult.rows.map(mapTenantStoreRow);
    const productMap = new Map(products.map((product: any) => [product.id, product]));

    return cartItems
      .map((item: any) => ({
        ...item,
        product: productMap.get(item.productId),
      }))
      .filter((item: any) => item.product);
  };

  const fetchTenantOrdersWithItems = async (
    tenantPool: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
    whereClause: string,
    params: any[]
  ) => {
    const ordersResult = await tenantPool.query(`SELECT * FROM orders ${whereClause} ORDER BY created_at DESC`, params);
    const orders = ordersResult.rows.map(mapTenantStoreRow);
    if (orders.length === 0) return [];

    const orderIds = orders.map((order: any) => order.id);
    const itemsResult = await tenantPool.query('SELECT * FROM order_items WHERE order_id = ANY($1::int[])', [orderIds]);
    const items = itemsResult.rows.map(mapTenantStoreRow);
    const itemsByOrder = new Map<number, any[]>();
    for (const item of items) {
      const orderId = item.orderId as number;
      const existing = itemsByOrder.get(orderId) ?? [];
      existing.push(item);
      itemsByOrder.set(orderId, existing);
    }

    return orders.map((order: any) => ({
      ...order,
      items: itemsByOrder.get(order.id) ?? [],
    }));
  };

  const prepareOrderFromItems = async (items: { productId: number; quantity: number }[], tenantPool?: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }) => {
    if (!items || items.length === 0) {
      throw createHttpError(400, "Order must contain at least one item");
    }

    let total = 0;
    const orderItems: InsertOrderItem[] = [];

    for (const item of items) {
      const parsedItem = cartItemPayloadSchema.parse(item);
      const product = tenantPool
        ? await tenantPool.query('SELECT * FROM products WHERE id = $1', [parsedItem.productId]).then((result) => result.rows[0] ? mapTenantStoreRow(result.rows[0]) : null)
        : await storage.getProduct(parsedItem.productId);

      if (!product) {
        throw createHttpError(404, `Product ${parsedItem.productId} not found`);
      }

      if (product.stock < parsedItem.quantity) {
        throw createHttpError(
          400,
          `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${parsedItem.quantity}`,
        );
      }

      const subtotal = product.price * parsedItem.quantity;
      total += subtotal;

      orderItems.push({
        orderId: 0,
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        productImageUrl: product.imageUrl || null,
        quantity: parsedItem.quantity,
        subtotal,
      });

      if (tenantPool) {
        await tenantPool.query('UPDATE products SET stock = $1 WHERE id = $2', [product.stock - parsedItem.quantity, product.id]);
      } else {
        await storage.updateProduct(product.id, {
          stock: product.stock - parsedItem.quantity,
        });
      }
    }

    return { total, orderItems };
  };

  const resolveGymContext = async (currentUser: any, gymIdParam?: string) => {
    if (currentUser.role === 'gym') {
      const targetGymId = currentUser.gymId || currentUser.id;
      return { targetGymId, gymAccountId: currentUser.id };
    }

    if ((currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
      if (!gymIdParam) {
        throw createHttpError(400, 'gymId query parameter is required for admin requests');
      }
      const parsedGymId = parseInt(gymIdParam, 10);
      if (Number.isNaN(parsedGymId)) {
        throw createHttpError(400, 'Invalid gymId');
      }
      const gymAccount = await storage.getUser(parsedGymId);
      if (!gymAccount || gymAccount.role !== 'gym') {
        throw createHttpError(404, 'Gym not found');
      }
      const targetGymId = gymAccount.gymId || gymAccount.id;
      return { targetGymId, gymAccountId: gymAccount.id };
    }

    throw createHttpError(403, 'Access denied');
  };

  // Check if WhatsApp number or email exists
  app.post("/api/check-whatsapp", async (req, res) => {
    try {
      const { whatsappWithCode, email } = req.body;
      
      if (!whatsappWithCode && !email) {
        return res.json({ exists: false });
      }

      const tenantPool = (req as any).tenantPool;
      if (tenantPool) {
        // Tenant-aware: check tenant DB for any matching phone/username/email field
        const params: string[] = [];
        if (whatsappWithCode) params.push(whatsappWithCode);
        if (email) params.push(email);
        
        const result = await tenantPool.query(
          `SELECT id FROM users WHERE username = ANY($1::text[])
             OR (whatsapp_with_code IS NOT NULL AND whatsapp_with_code = ANY($1::text[]))
             OR (phone IS NOT NULL AND phone = ANY($1::text[]))
             OR (phone_number IS NOT NULL AND phone_number = ANY($1::text[]))
             OR (email IS NOT NULL AND email = ANY($1::text[]))
           LIMIT 1`,
          [params]
        );
        return res.json({ exists: result.rows.length > 0 });
      }

      // Check email first if provided
      if (email) {
        const existingUserByEmail = await storage.getUserByEmail(email);
        if (existingUserByEmail) {
          return res.json({ exists: true });
        }
      }

      // Check whatsapp if provided
      if (whatsappWithCode) {
        const existingUser = await storage.getUserByWhatsappWithCode(whatsappWithCode);
        return res.json({ exists: !!existingUser });
      }
      
      return res.json({ exists: false });
    } catch (error) {
      console.error('Error checking WhatsApp/Email:', error);
      return res.status(500).json({ message: "Error checking WhatsApp number or email" });
    }
  });

  // Get coach name by ID (public endpoint for signup page)
  app.get("/api/coach/:id/name", async (req, res) => {
    try {
      const coachId = parseInt(req.params.id);
      
      if (isNaN(coachId)) {
        return res.status(400).json({ message: "Invalid coach ID" });
      }

      const coach = await storage.getUser(coachId);
      
      if (!coach || coach.role !== 'coach') {
        return res.status(404).json({ message: "Coach not found" });
      }

      // Return only the coach's name
      return res.json({ 
        firstName: coach.firstName,
        lastName: coach.lastName,
        fullName: `${coach.firstName} ${coach.lastName}`
      });
    } catch (error) {
      console.error('Error fetching coach name:', error);
      return res.status(500).json({ message: "Error fetching coach information" });
    }
  });

  app.get("/api/gym/:id/name", async (req, res) => {
    try {
      const gymId = parseInt(req.params.id);
      if (isNaN(gymId)) {
        return res.status(400).json({ message: "Invalid gym ID" });
      }

      const gym = await storage.getUser(gymId);
      if (!gym || gym.role !== 'gym') {
        return res.status(404).json({ message: "Gym not found" });
      }

      return res.json({
        firstName: gym.firstName,
        lastName: gym.lastName,
        fullName: `${gym.firstName} ${gym.lastName}`
      });
    } catch (error) {
      console.error('Error fetching gym name:', error);
      return res.status(500).json({ message: "Error fetching gym information" });
    }
  });

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      // Check if this is a tenant request
      const tenantPool = (req as any).tenantPool;
      const isTenantRequest = Boolean(tenantPool);
      const normalizedIdentity = normalizeIdentityFields(req.body || {});

      // Parse coachId from query string (preferred over any body field; body is not allowed to set coachId)
      const rawCoachId = (req.query?.coachId ?? req.query?.ref) as any;
      let validatedCoachId: number | undefined;
      
      if (isTenantRequest) {
        // Validate coach ID from tenant database
        if (rawCoachId !== undefined && rawCoachId !== null) {
          const str = String(rawCoachId);
          if (/^\d+$/.test(str)) {
            const id = parseInt(str, 10);
            if (id > 0) {
              try {
                const result = await tenantPool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
                if (result.rows.length > 0) {
                  const coach = mapTenantRow(result.rows[0]);
                  if (coach.role === 'coach' && coach.isApproved === true) {
                    validatedCoachId = id;
                  }
                }
              } catch (err) {
                console.log('[TENANT SIGNUP] Failed to validate coach ID:', err);
              }
            }
          }
        }
      } else {
        validatedCoachId = await resolveValidCoachId(storage, rawCoachId);
      }
      
      const rawGymId = req.query?.gymId as any;
      const validatedGymId = isTenantRequest ? null : await resolveValidGymId(storage, rawGymId);
      
      // Ensure role is preserved from the request
      const userData: any = {
        ...req.body,
        ...normalizedIdentity,
        role: req.body.role || 'user' // Default to 'user' if no role specified
      };
      
  let parsedData: InsertUser;
      try {
        parsedData = insertUserSchema.parse(userData) as InsertUser;
      } catch (err: any) {
        // Zod validation failed – build detailed response including missing required fields for 'user' role
        console.error('Signup validation error:', err);
        // Determine missing fields if role is user
        const body = userData || {};
        const requiredForUser = [
          'firstName','lastName','password','email','city','country','gender','religion','height','age','weight','howFoundUs'
        ];
        const missing: string[] = [];
        if ((body.role || 'user') === 'user') {
          for (const f of requiredForUser) {
            const v = (body as any)[f];
            if (v === undefined || v === null || v === '' ) missing.push(f);
          }
        }
        // If Zod provides its own issues, include them
        const issues = err?.issues?.map((i: any) => ({ path: i.path?.join('.'), message: i.message })) || [];
        return res.status(400).json({
          message: 'فشلت عملية التحقق من البيانات',
            missingFields: missing,
            issues
        });
      }
      const parsedIdentity = normalizeIdentityFields(parsedData as any);
      // Generate username from email if not provided (for backward compatibility)
      const username = parsedIdentity.username as string;
      let passwordValue = (parsedData as any).password as string | undefined;
      const email = parsedIdentity.email as string | undefined;

      if (!email) {
        return res.status(400).json({ message: "البريد الإلكتروني مطلوب" });
      }


      // Check if user exists by email (tenant-aware)
      let existingUser: any;
      if (isTenantRequest) {
        // Check by email first, then fallback to username
        const candidates = [email, username].filter(Boolean);
        const result = await tenantPool.query(
          `SELECT id FROM users
           WHERE (email IS NOT NULL AND email = ANY($1::text[]))
              OR username = ANY($1::text[])
           LIMIT 1`,
          [candidates]
        );
        existingUser = result.rows[0];
      } else {
        // Check email first
        existingUser = await storage.getUserByEmail(email);
        
        // If no user found by email, check username for backward compatibility
        if (!existingUser && username) {
          existingUser = await storage.getUserByUsername(username);
        }
      }
      
      if (existingUser) {
        return res.status(400).json({ message: "البريد الإلكتروني أو اسم المستخدم مستخدم بالفعل" });
      }

      // Create user with the selected role


      // Hash password before storage if it's plain text (simple detection: not starting with $2a/b/2y$)
      if (passwordValue && !/^\$2[aby]\$/.test(passwordValue)) {
        try {
          const salt = await bcrypt.genSalt(10);
          passwordValue = await bcrypt.hash(passwordValue, salt);
        } catch (hashErr) {
          console.error('Password hashing failed:', hashErr);
          return res.status(500).json({ message: 'حدث خطأ أثناء تأمين كلمة المرور' });
        }
      }

      // Set approval status and gymId based on role and referral
      const userDataWithApproval: InsertUser = {
        ...(parsedData as any),
        username,
        email,  // Explicitly ensure email is always set
        password: passwordValue,
        isApproved: parsedData.role === 'coach' ? false : true,
        // For coaches signing up via gym referral, ensure gymId is set
        // For regular users, also set gymId if provided
        gymId: validatedGymId ?? null
      } as InsertUser;
      
      // Create user (tenant-aware)
      let user: any;
      if (isTenantRequest) {
        // For tenant requests, insert directly into tenant database
        console.log('[TENANT SIGNUP] Creating user in tenant database');
        const firstNameStr = String(userDataWithApproval.firstName || '');
        const [firstName, ...rest] = firstNameStr.split(' ');
        const lastName = rest.join(' ') || userDataWithApproval.lastName || '';

        const toSnakeCase = (value: string) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        const tenantInsertData: Record<string, any> = {
          ...userDataWithApproval,
          username,
          email,
          password: passwordValue,
          firstName: firstName || userDataWithApproval.firstName,
          lastName,
          status: 'active'
        };

        const entries = Object.entries(tenantInsertData).filter(([, value]) => value !== undefined);
        const columns = entries.map(([key]) => (key === 'status' ? 'status' : toSnakeCase(key)));
        const placeholders = entries.map((_, index) => `$${index + 1}`);
        const values = entries.map(([, value]) => value);

        const result = await tenantPool.query(
          `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
          values
        );

        const mapTenantRowToCamel = (row: Record<string, any>) => {
          const mapped: Record<string, any> = {};
          for (const [key, value] of Object.entries(row)) {
            const camelKey = key.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
            mapped[camelKey] = value;
          }
          if (mapped.phone && !mapped.phoneNumber) {
            mapped.phoneNumber = mapped.phone;
          }
          return mapped;
        };

        user = mapTenantRowToCamel(result.rows[0]);
        console.log('[TENANT SIGNUP] User created with id:', user.id);
      } else {
        user = await storage.createUser(userDataWithApproval);
      }

  // If a valid coachId attribution exists, apply it to the new user (non-fatal if fails)
  let attributedUser = user;
  
  if (validatedCoachId && user.role === 'user' && !user.coachId) {
    if (isTenantRequest) {
      // Tenant-aware coach attribution
      try {
        console.log('[TENANT SIGNUP] Applying coach attribution:', validatedCoachId);
        const updateResult = await tenantPool.query(
          'UPDATE users SET coach_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          [validatedCoachId, user.id]
        );
        if (updateResult.rows.length > 0) {
          attributedUser = mapTenantRow(updateResult.rows[0]);
          console.log('[TENANT SIGNUP] Coach attribution successful');
        }
      } catch (err) {
        console.log('[TENANT SIGNUP] Failed to apply coach attribution (non-fatal):', err);
      }
    } else {
      // Central database attribution
      attributedUser = await applyCoachAttributionIfValid(storage, user, validatedCoachId);
    }
  }

      // Map signup subscriptionDuration to subscriptionType and update dates for regular users
      let effectiveUser = attributedUser;
      
      // Additional gymId assignment logic for edge cases (skip for tenant requests)
      if (!isTenantRequest) {
        try {
          // If user signed up via coach referral and coach has a gym, inherit coach's gymId
          if (!validatedGymId && validatedCoachId && effectiveUser.role === 'user') {
            const coach = await storage.getUser(validatedCoachId);
            if (coach?.gymId && coach.gymId !== effectiveUser.gymId) {
              const updated = await storage.updateUser(effectiveUser.id, { gymId: coach.gymId });
              if (updated) effectiveUser = updated;
            }
          }

          // If role is gym, set gymId to own ID
          if (effectiveUser.role === 'gym' && effectiveUser.gymId !== effectiveUser.id) {
            const updated = await storage.updateUser(effectiveUser.id, { gymId: effectiveUser.id });
            if (updated) effectiveUser = updated;
          }
        } catch (gymAssignErr) {
          console.warn('Failed to assign gymId during signup (non-fatal):', gymAssignErr);
        }
        
        try {
          if (attributedUser.role === 'user') {
            const dur = (parsedData as any)?.subscriptionDuration as string | undefined; // e.g., '1','3','6','12'
            if (dur) {
              const n = parseFloat(dur);
              if (!Number.isNaN(n) && n > 0) {
                const unit = n === 1 ? 'month' : 'months';
                const subscriptionType = `${n}_${unit}`; // matches updateSubscriptionSchema
                const updated = await storage.updateUserSubscription(attributedUser.id, {
                  subscriptionType,
                  subscriptionStartDate: new Date()
                });
                if (updated) effectiveUser = updated;
              }
            }
          }
        } catch (subErr) {
          console.warn('Subscription update after signup failed (non-fatal):', subErr);
        }
      }

      // Verify the role was set correctly
      if (user.role !== parsedData.role) {

      }

      try {
        const scope = buildScopeFromRequest(req);
        await grantSignupCredits(scope, { userId: effectiveUser.id });
      } catch (creditError) {
        console.error('Failed to grant signup credits:', creditError);
      }

      // For coaches, return success but indicate pending approval
      if (effectiveUser.role === 'coach') {
        const userData: any = { ...(effectiveUser as any) };
        if ('password' in userData) delete userData.password;
        return res.status(201).json({
          ...userData,
          message: "تم إنشاء حساب المدرب بنجاح. حسابك قيد المراجعة من الإدارة.",
          pendingApproval: true
        });
      }

      // Handle coach invitation if preferredCoachName is provided (skip for tenant requests)
      if (!isTenantRequest && parsedData.preferredCoachName && (parsedData.preferredCoachName as string).trim()) {
        try {
          // Find coach by name (searching in firstName and lastName)
          const coaches = await storage.getAllUsers();
          const preferredCoachName = parsedData.preferredCoachName as string;
          const preferredCoach = coaches.find(coach => 
            coach.role === 'coach' && 
            coach.isApproved === true &&
            (
              `${coach.firstName} ${coach.lastName}`.toLowerCase().includes(preferredCoachName.toLowerCase()) ||
              coach.username.toLowerCase().includes(preferredCoachName.toLowerCase())
            )
          );

          if (preferredCoach) {
            // Create coach invitation
            await storage.createCoachInvitation({
              userId: user.id,
              coachId: preferredCoach.id,
              status: 'pending',
              userMessage: `Hello ${preferredCoach.firstName}, I would like you to be my coach. Looking forward to working with you!`
            });


          }
        } catch (error) {
          console.error('Error creating coach invitation:', error);
          // Don't fail signup if invitation creation fails
        }
      }

      // Log in the user (only for non-coaches)
      // For tenant requests, we need to manually set the session
      if (isTenantRequest) {
        // Get tenant ID from request
        const tenant = (req as any).tenant;
        const tenantId = tenant?.id;
        
        const { password: _password, ...mappedUser } = {
          ...user,
          tenantId: tenantId // Include tenantId for session serialization
        };
        
        console.log('[TENANT SIGNUP] Logging in user with tenantId:', { userId: user.id, tenantId });
        
        req.login(mappedUser, (err) => {
          if (err) {
            console.error('Login error after tenant signup:', err);
            return res.status(500).json({ message: "حدث خطأ أثناء تسجيل الدخول بعد إنشاء الحساب" });
          }
          // Return user data without password
          const userData: any = { ...mappedUser };
          if ('password' in userData) delete userData.password;

          return res.status(201).json(userData);
        });
      } else {
        req.login(effectiveUser, (err) => {
          if (err) {
            console.error('Login error after signup:', err);
            return res.status(500).json({ message: "حدث خطأ أثناء تسجيل الدخول بعد إنشاء الحساب" });
          }
          // Return user data without password
          const userData: any = { ...(effectiveUser as any) };
          if ('password' in userData) delete userData.password;

          return res.status(201).json(userData);
        });
      }
    } catch (error) {
      console.error('Signup error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      return res.status(500).json({ message: "حدث خطأ أثناء إنشاء الحساب" });
    }
  });

  // Get demo users for quick login
  app.get("/api/auth/demo-users", async (req: Request, res: Response) => {
    try {
      const demoUsers = await db
        .select({
          role: users.role,
          whatsappWithCode: users.whatsappWithCode,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(like(users.username, 'demo_%'))
        .orderBy(
          sql`CASE 
            WHEN ${users.role} = 'user' THEN 1
            WHEN ${users.role} = 'coach' THEN 2
            WHEN ${users.role} = 'gym' THEN 3
            WHEN ${users.role} = 'admin' THEN 4
            ELSE 5
          END`
        );

      const formattedUsers = demoUsers.map(user => {
        let label = '';
        let note = '';
        
        switch (user.role) {
          case 'user':
            label = 'Client Journey';
            note = 'See what trainees track daily';
            break;
          case 'coach':
            label = 'Coach Console';
            note = 'Review roster & plans';
            break;
          case 'gym':
            label = 'Gym Owner';
            note = 'Test gym analytics';
            break;
          case 'admin':
            label = 'Admin Overview';
            note = 'Manage platform settings';
            break;
          default:
            label = `${user.firstName} ${user.lastName}`;
            note = user.role;
        }

        return {
          label,
          note,
          whatsappWithCode: user.whatsappWithCode,
          name: `${user.firstName} ${user.lastName}`,
        };
      });

      res.json(formattedUsers);
    } catch (error) {
      console.error('Error fetching demo users:', error);
      res.status(500).json({ message: 'Error fetching demo users' });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    try {
      passport.authenticate("local", (err: any, user: any, info: any) => {
        if (err) {
          console.error('Passport authentication error:', err);
          return res.status(500).json({ message: 'Authentication internal error' });
        }
        if (!user) {
          const errorMessage = info?.message || 'Invalid credentials';

          return res.status(401).json({ message: errorMessage });
        }

        req.logIn(user, async (loginErr) => {
          if (loginErr) {
            console.error('Login error (req.logIn):', loginErr);
            return res.status(500).json({ message: 'Login session error' });
          }

            // Track login in user_logins table (only for main platform users)
            if (!user.tenantId) {
              try {
                const ipAddress = req.ip || req.headers['x-forwarded-for'] as string || req.connection.remoteAddress || 'unknown';
                const userAgent = req.headers['user-agent'] || 'unknown';
                
                await db.insert(userLogins).values({
                  userId: user.id,
                  ipAddress,
                  userAgent
                });
              } catch (trackErr) {
                console.error('Failed to track login:', trackErr);
                // Continue with login even if tracking fails
              }
            }

            // Attach user object to session explicitly
            try {
              (req.session as any).user = user;
            } catch (attachErr) {
              console.error('Failed attaching user to session:', attachErr);
            }

            // Attempt to persist session
            req.session.save((saveErr) => {
              if (saveErr) {
                console.error('Session save error:', saveErr, {
                  sessionID: req.session.id,
                  hasPassport: !!req.session.passport,
                  cookie: req.session.cookie
                });
                return res.status(500).json({ message: 'Session persistence error' });
              }



              const { password, ...userData } = user;
              return res.json(userData);
            });
        });
      })(req, res, next);
    } catch (outerErr) {
      console.error('Unexpected /api/auth/login error wrapper:', outerErr);
      return res.status(500).json({ message: 'Unexpected login error' });
    }
  });

  // Admin-only password rehash endpoint (supply ADMIN_REHASH_TOKEN env secret)
  app.post('/api/auth/rehash-password', async (req: Request, res: Response) => {
    try {
      const { username, newPassword, adminToken } = req.body as { username?: string; newPassword?: string; adminToken?: string };
      if (!username || !newPassword || !adminToken) {
        return res.status(400).json({ success: false, error: 'username, newPassword, adminToken required' });
      }
      if (!process.env.ADMIN_REHASH_TOKEN || adminToken !== process.env.ADMIN_REHASH_TOKEN) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(newPassword, salt);
      await storage.updateUser(user.id, { password: hash });
      return res.json({ success: true });
    } catch (err) {
      console.error('rehash-password error', err);
      return res.status(500).json({ success: false, error: 'Internal error' });
    }
  });


  app.post("/api/auth/logout", (req, res) => {
    // For our test implementation, set a global flag to indicate logged out state
    global.userLoggedOut = true;

    // If using an actual passport session, log out properly
    if (req.isAuthenticated()) {
      req.logout((err) => {
        if (err) {
          console.error("Error during logout:", err);
          return res.status(500).json({ message: "Error logging out" });
        }

        if (req.session) {
          req.session.destroy((err) => {
            if (err) {
              console.error("Error destroying session:", err);
            }
            // Clear all possible cookie variations
            res.clearCookie('connect.sid');
            res.clearCookie('connect.sid', { path: '/' });
            res.clearCookie('fitlife.session');
            res.clearCookie('fitlife.session', { path: '/' });

            // Return success after the session is destroyed
            return res.status(200).json({ 
              message: "Logged out successfully",
              success: true 
            });
          });
        } else {
          // If no session exists, still clear cookies and return success
          res.clearCookie('connect.sid');
          res.clearCookie('connect.sid', { path: '/' });
          res.clearCookie('fitlife.session');
          res.clearCookie('fitlife.session', { path: '/' });
          return res.status(200).json({ 
            message: "Logged out successfully",
            success: true 
          });
        }
      });
    } else {
      // If not authenticated, still clear any cookies and return success
      res.clearCookie('connect.sid');
      res.clearCookie('connect.sid', { path: '/' });
      res.clearCookie('fitlife.session');
      res.clearCookie('fitlife.session', { path: '/' });
      return res.status(200).json({ 
        message: "Logged out successfully",
        success: true 
      });
    }
  });

  // Password reset endpoint
  // NOTE: PIN numbers are intentionally stored unhashed as per business requirements
  // for password recovery functionality. This is a trade-off between security and usability.
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email, pinNumber, newPassword } = req.body;

      // Validate required fields
      if (!email || !pinNumber || !newPassword) {
        return res.status(400).json({ message: "جميع الحقول مطلوبة" });
      }

      // Validate PIN format (4 digits)
      if (!/^\d{4}$/.test(pinNumber)) {
        return res.status(400).json({ message: "رقم التحقق يجب أن يكون 4 أرقام بالضبط" });
      }

      // Validate password length
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "يجب أن تكون كلمة المرور 6 أحرف على الأقل" });
      }

      let user: any = null;
      const tenantPool = (req as any).tenantPool;

      // Find user by email - check tenant database if tenant context exists
      if (tenantPool) {
        console.log('[TENANT RESET] Looking up user in tenant database:', { email });
        try {
          const result = await tenantPool.query(
            'SELECT * FROM users WHERE email = $1 LIMIT 1',
            [email]
          );
          
          if (result.rows.length > 0) {
            // Convert snake_case database columns to camelCase
            const row = result.rows[0];
            user = {
              id: row.id,
              username: row.username,
              email: row.email,
              password: row.password,
              firstName: row.first_name,
              lastName: row.last_name,
              whatsappWithCode: row.whatsapp_with_code,
              pinNumber: row.pin_number,
              role: row.role,
              isApproved: row.is_approved,
            };
            console.log('[TENANT RESET] User found in tenant database:', { id: user.id });
          }
        } catch (dbErr) {
          console.error('[TENANT RESET] Database error:', dbErr);
        }
      } else {
        // Central platform - use storage
        console.log('[CENTRAL RESET] Looking up user in central database:', { email });
        user = await storage.getUserByEmail(email);
      }
      
      if (!user) {
        console.log('[RESET] User not found:', { email, isTenant: !!tenantPool });
        return res.status(404).json({ message: "المستخدم غير موجود" });
      }

      // Check if PIN matches (stored unhashed as per requirements)
      if (user.pinNumber !== pinNumber) {
        return res.status(401).json({ message: "رقم التحقق غير صحيح، برجاء المحاولة مرة أخرى" });
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update user's password - use tenant pool if available
      if (tenantPool) {
        console.log('[TENANT RESET] Updating password in tenant database for user:', user.id);
        await tenantPool.query(
          'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
          [hashedPassword, user.id]
        );
      } else {
        console.log('[CENTRAL RESET] Updating password in central database for user:', user.id);
        await storage.updateUser(user.id, { password: hashedPassword });
      }

      return res.status(200).json({ 
        message: "تم تحديث كلمة المرور الجديدة الخاصة بك",
        success: true 
      });
    } catch (error) {
      console.error("Password reset error:", error);
      return res.status(500).json({ message: "حدث خطأ أثناء إعادة تعيين كلمة المرور" });
    }
  });

  // Request password reset - sends email with reset token
  // Rate limiting: max 3 requests per email per hour (in-memory tracking)
  const resetRequestTracker = new Map<string, { count: number; resetAt: number }>();
  
  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = req.body;

      // Validate required fields
      if (!email) {
        return res.status(400).json({ message: "البريد الإلكتروني مطلوب" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "البريد الإلكتروني غير صحيح" });
      }

      // Rate limiting: check if email has exceeded request limit
      const now = Date.now();
      const tracker = resetRequestTracker.get(email);
      
      if (tracker) {
        // Reset counter if an hour has passed
        if (now - tracker.resetAt > 60 * 60 * 1000) {
          resetRequestTracker.set(email, { count: 1, resetAt: now });
        } else if (tracker.count >= 3) {
          console.log('[RESET-REQUEST] Rate limit exceeded:', { email });
          // Return generic success to prevent enumeration, but don't send email
          return res.status(200).json({ 
            message: "إذا كان البريد الإلكتروني موجودًا، فسيتم إرسال رابط إعادة تعيين كلمة المرور إليه",
            success: true 
          });
        } else {
          tracker.count++;
        }
      } else {
        resetRequestTracker.set(email, { count: 1, resetAt: now });
      }

      let user: any = null;
      const tenantPool = (req as any).tenantPool;

      // Find user by email - check tenant database if tenant context exists
      if (tenantPool) {
        console.log('[TENANT RESET-REQUEST] Looking up user in tenant database:', { email });
        try {
          const result = await tenantPool.query(
            'SELECT id, email, first_name, last_name FROM users WHERE email = $1 LIMIT 1',
            [email]
          );
          
          if (result.rows.length > 0) {
            const row = result.rows[0];
            user = {
              id: row.id,
              email: row.email,
              firstName: row.first_name,
              lastName: row.last_name,
            };
            console.log('[TENANT RESET-REQUEST] User found in tenant database:', { id: user.id });
          }
        } catch (dbErr) {
          console.error('[TENANT RESET-REQUEST] Database error:', dbErr);
        }
      } else {
        // Central platform - use storage
        console.log('[CENTRAL RESET-REQUEST] Looking up user in central database:', { email });
        const fullUser = await storage.getUserByEmail(email);
        if (fullUser) {
          user = {
            id: fullUser.id,
            email: fullUser.email,
            firstName: fullUser.firstName,
            lastName: fullUser.lastName,
          };
        }
      }
      
      // Always return success to prevent user enumeration
      // But only send email if user exists
      if (user) {
        // Generate cryptographically secure random token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        // Store token in database
        if (tenantPool) {
          console.log('[TENANT RESET-REQUEST] Storing reset token for user:', user.id);
          await tenantPool.query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) 
             VALUES ($1, $2, $3)`,
            [user.id, tokenHash, expiresAt]
          );
        } else {
          console.log('[CENTRAL RESET-REQUEST] Storing reset token for user:', user.id);
          await db.insert(schema.passwordResetTokens).values({
            userId: user.id,
            tokenHash,
            expiresAt,
          });
        }

        // Send password reset email
        const userName = `${user.firstName} ${user.lastName}`.trim() || 'User';
        const emailSent = await sendPasswordResetEmail(user.email, resetToken, userName, req);
        
        if (emailSent) {
          console.log('[RESET-REQUEST] Password reset email sent successfully:', { email: user.email });
        } else {
          console.error('[RESET-REQUEST] Failed to send password reset email:', { email: user.email });
        }
      } else {
        console.log('[RESET-REQUEST] User not found, but returning success:', { email, isTenant: !!tenantPool });
      }

      // Always return generic success message to prevent user enumeration
      return res.status(200).json({ 
        message: "إذا كان البريد الإلكتروني موجودًا، فسيتم إرسال رابط إعادة تعيين كلمة المرور إليه",
        success: true 
      });
    } catch (error) {
      console.error("Password reset request error:", error);
      return res.status(500).json({ message: "حدث خطأ أثناء معالجة طلبك" });
    }
  });

  // Confirm password reset - validates token and updates password
  app.post("/api/auth/confirm-password-reset", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      // Validate required fields
      if (!token || !newPassword) {
        return res.status(400).json({ message: "جميع الحقول مطلوبة" });
      }

      // Validate password length
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "يجب أن تكون كلمة المرور 6 أحرف على الأقل" });
      }

      // Hash the token to find it in database
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const tenantPool = (req as any).tenantPool;

      let resetTokenRecord: any = null;
      let userId: number | null = null;

      // Find token in database - check tenant database if tenant context exists
      if (tenantPool) {
        console.log('[TENANT RESET-CONFIRM] Looking up reset token in tenant database');
        try {
          const result = await tenantPool.query(
            `SELECT id, user_id, expires_at, used_at 
             FROM password_reset_tokens 
             WHERE token_hash = $1 
             LIMIT 1`,
            [tokenHash]
          );
          
          if (result.rows.length > 0) {
            const row = result.rows[0];
            resetTokenRecord = {
              id: row.id,
              userId: row.user_id,
              expiresAt: new Date(row.expires_at),
              usedAt: row.used_at ? new Date(row.used_at) : null,
            };
            userId = resetTokenRecord.userId;
            console.log('[TENANT RESET-CONFIRM] Token found in tenant database');
          }
        } catch (dbErr) {
          console.error('[TENANT RESET-CONFIRM] Database error:', dbErr);
        }
      } else {
        // Central platform - use drizzle
        console.log('[CENTRAL RESET-CONFIRM] Looking up reset token in central database');
        const tokens = await db
          .select()
          .from(schema.passwordResetTokens)
          .where(eq(schema.passwordResetTokens.tokenHash, tokenHash))
          .limit(1);
        
        if (tokens.length > 0) {
          resetTokenRecord = tokens[0];
          userId = resetTokenRecord.userId;
          console.log('[CENTRAL RESET-CONFIRM] Token found in central database');
        }
      }

      if (!resetTokenRecord || !userId) {
        console.log('[RESET-CONFIRM] Token not found');
        return res.status(400).json({ message: "رابط إعادة تعيين كلمة المرور غير صحيح أو منتهي الصلاحية" });
      }

      // Check if token has already been used
      if (resetTokenRecord.usedAt) {
        console.log('[RESET-CONFIRM] Token already used');
        return res.status(400).json({ message: "تم استخدام هذا الرابط بالفعل" });
      }

      // Check if token has expired
      const now = new Date();
      if (resetTokenRecord.expiresAt < now) {
        console.log('[RESET-CONFIRM] Token expired');
        return res.status(400).json({ message: "انتهت صلاحية رابط إعادة تعيين كلمة المرور" });
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update user's password and mark token as used
      if (tenantPool) {
        console.log('[TENANT RESET-CONFIRM] Updating password and marking token as used');
        await tenantPool.query('BEGIN');
        try {
          await tenantPool.query(
            'UPDATE users SET password = $1 WHERE id = $2',
            [hashedPassword, userId]
          );
          await tenantPool.query(
            'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
            [resetTokenRecord.id]
          );
          await tenantPool.query('COMMIT');
        } catch (err) {
          await tenantPool.query('ROLLBACK');
          throw err;
        }
      } else {
        console.log('[CENTRAL RESET-CONFIRM] Updating password and marking token as used');
        await storage.updateUser(userId, { password: hashedPassword });
        await db
          .update(schema.passwordResetTokens)
          .set({ usedAt: now })
          .where(eq(schema.passwordResetTokens.id, resetTokenRecord.id));
      }

      // Optionally: Clear any active sessions for this user for security
      // This would require session store integration

      console.log('[RESET-CONFIRM] Password reset successful for user:', userId);
      return res.status(200).json({ 
        message: "تم تحديث كلمة المرور بنجاح",
        success: true 
      });
    } catch (error) {
      console.error("Password reset confirmation error:", error);
      return res.status(500).json({ message: "حدث خطأ أثناء إعادة تعيين كلمة المرور" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      console.log('GET /api/auth/me called');
      console.log('Session ID:', req.session.id);
      console.log('req.user:', req.user ? { id: (req.user as any).id, tenantId: (req.user as any).tenantId } : null);
      console.log('req.isAuthenticated():', req.isAuthenticated());

      // Check if user is authenticated through passport
      if (req.isAuthenticated() && req.user) {
        console.log('User authenticated via passport');
        const { password, ...userData } = req.user as any;
        return res.json(userData);
      }

      // Check if user is stored in session
      if (req.session && req.session.user) {
        console.log('User found in session');
        const { password, ...userData } = req.session.user;
        return res.json(userData);
      }

      // Try to deserialize from session manually
      if (req.session && req.session.passport && req.session.passport.user) {
        try {
          // Handle both old format (just ID) and new format (object with id and tenantId)
          const sessionData = req.session.passport.user;
          const userId = typeof sessionData === 'number' ? sessionData : sessionData.id;
          const tenantId = typeof sessionData === 'object' ? sessionData.tenantId : null;
          
          let user;
          
          if (tenantId) {
            // Tenant user: get tenant pool and query tenant database
            const centralPool = (await import('./saas/centralDb')).getCentralPool();
            const tenantResult = await centralPool.query(
              'SELECT * FROM tenants WHERE id = $1',
              [tenantId]
            );
            
            if (tenantResult.rows.length > 0) {
              const tenant = tenantResult.rows[0];
              const { getTenantPool } = await import('./saas/dbManager');
              const tenantPool = await getTenantPool(tenant);
              
              const userResult = await tenantPool.query(
                'SELECT * FROM users WHERE id = $1',
                [userId]
              );
              
              if (userResult.rows.length > 0) {
                const mapTenantRowToCamel = (row: Record<string, any>) => {
                  const mapped: Record<string, any> = {};
                  for (const [key, value] of Object.entries(row)) {
                    const camelKey = key.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
                    mapped[camelKey] = value;
                  }
                  if (mapped.phone && !mapped.phoneNumber) {
                    mapped.phoneNumber = mapped.phone;
                  }
                  return mapped;
                };

                user = mapTenantRowToCamel(userResult.rows[0]);
                user.tenantId = tenantId;
              }
            }
          } else {
            // Main platform user
            user = await storage.getUser(userId);
          }
          
          if (user) {
            console.log('User manually deserialized from session:', { id: user.id, tenantId: user.tenantId });
            const { password, ...userData } = user;
            return res.json(userData);
          }
        } catch (err) {
          console.error('Error manually deserializing user:', err);
        }
      }

      return res.status(200).json({ 
        authenticated: false,
        message: "Not authenticated"
      });
    } catch (error) {
      console.error('Error in /api/auth/me:', error);
      res.status(500).json({ message: "Error fetching user data" });
    }
  });



  // User routes
  app.get("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = req.user as any;
      
      // Use tenant database if user is a tenant user
      let targetUser;
      if (currentUser.tenantId) {
        const usersDb = resolveDb(req);
        const [user] = await usersDb.select().from(users).where(eq(users.id, userId));
        targetUser = user;
      } else {
        targetUser = await storage.getUser(userId);
      }
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!canViewUserProfile(currentUser, targetUser)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { password, ...userData } = targetUser;
      res.json(userData);
    } catch (error) {
      res.status(500).json({ message: "Error fetching user" });
    }
  });

  // Get user progress data (restricted to allowed viewers)
  app.get("/api/users/:id/progress", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = req.user as any;
      
      // Use tenant database if user is a tenant user
      let targetUser;
      if (currentUser.tenantId) {
        const usersDb = resolveDb(req);
        const [user] = await usersDb.select().from(users).where(eq(users.id, userId));
        targetUser = user;
      } else {
        targetUser = await storage.getUser(userId);
      }
      
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!canViewUserProfile(currentUser, targetUser)) {
        return res.status(403).json({ message: "Access denied" });
      }

      console.log('Fetching progress for user:', userId);

      // Return simplified mock progress for now to test the UI
      const progressSummary = {
        weightProgress: Math.floor(Math.random() * 70) + 20, // 20-90%
        calorieGoalProgress: Math.floor(Math.random() * 60) + 30, // 30-90%
        waterGoalProgress: Math.floor(Math.random() * 50) + 40, // 40-90%
        workoutProgress: Math.floor(Math.random() * 80) + 10, // 10-90%
        totalDaysTracked: Math.floor(Math.random() * 20) + 5 // 5-25 days
      };

      res.json({
        latestProgress: null,
        progressSummary,
        totalEntries: progressSummary.totalDaysTracked
      });
    } catch (error) {
      console.error('Error fetching user progress:', error);
      res.status(500).json({ message: "Error fetching user progress" });
    }
  });

  const mapTenantUserRow = (row: Record<string, any>): User => {
    return mapTenantRow(row) as User;
  };

  const fetchTenantUsers = async (tenantPool: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }): Promise<User[]> => {
    const result = await tenantPool.query('SELECT * FROM users');
    return result.rows.map(mapTenantUserRow);
  };

  const buildTenantUpdate = (data: Record<string, unknown>, columnMap: Record<string, string>) => {
    const entries = Object.entries(data).filter(([, value]) => value !== undefined);
    const sets: string[] = [];
    const values: unknown[] = [];

    entries.forEach(([key, value], index) => {
      const column = columnMap[key] ?? key;
      sets.push(`${column} = $${index + 1}`);
      values.push(value);
    });

    return { sets, values };
  };

  const fetchTenantUserPlans = async (
    tenantPool: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> },
    users: User[]
  ): Promise<Array<{ userId: number; plans: any[] }>> => {
    if (users.length === 0) return [];
    const userIds = users.map((user) => user.id);
    const result = await tenantPool.query(
      'SELECT user_id FROM user_plans WHERE user_id = ANY($1::int[])',
      [userIds]
    );
    const usersWithPlans = new Set(result.rows.map((row) => Number(row.user_id)));
    return users.map((user) => ({
      userId: user.id,
      plans: usersWithPlans.has(user.id) ? [{}] : [],
    }));
  };

  // Get coaches endpoint for admin dashboard
  app.get("/api/coaches", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Only admin and coaches can access this endpoint
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && currentUser.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const tenantPool = (req as any).tenantPool;
      const users = tenantPool ? await fetchTenantUsers(tenantPool) : await storage.getAllUsers();
      const coaches = users.filter(user => user.role === 'coach');
      const sanitizedCoaches = coaches.map(user => {
        const { password, ...userData } = user;
        return userData;
      });
      res.json(sanitizedCoaches);
    } catch (error) {
      res.status(500).json({ message: "Error fetching coaches" });
    }
  });

  // Get users based on role - for messaging system
  app.get("/api/users", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const role = req.query.role as string;
      const coachId = req.query.coachId as string;
      const pending = req.query.pending as string;
      const tenantPool = (req as any).tenantPool;
      const allUsers = tenantPool ? await fetchTenantUsers(tenantPool) : await storage.getAllUsers();
      
      // Pagination parameters
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
      
      // New filter parameters
      const statusFilter = req.query.status as string;
      const subscriptionFilter = req.query.subscription as string;
      const planStatusFilter = req.query.planStatus as string;
      const roleFilter = req.query.role as string;
      const coachAssignmentFilter = req.query.coachAssignment as string;
      const gymAssignmentFilter = req.query.gymAssignment as string;
      const searchQuery = req.query.search as string;

      // If requesting pending coaches (admin only)
      if (pending === 'true' && role === 'coach' && (currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
        const users = allUsers;
        // Admin should only see coaches WITHOUT a gymId (independent coaches)
        // Coaches with gymId are managed by their respective gym
        // Only show coaches that are not approved AND have not been reviewed yet (approvedAt is null)
        const pendingCoaches = users.filter(user => 
          user.role === 'coach' && 
          !user.isApproved && 
          !user.approvedAt && // Exclude rejected coaches (they have approvedAt set)
          !user.gymId
        );
        const sanitizedCoaches = pendingCoaches.map(user => {
          const { password, ...userData } = user;
          return userData;
        });
        return res.json(sanitizedCoaches);
      }

      // If requesting coaches (for regular users to message)
      if (role === 'coach' && !statusFilter && !subscriptionFilter && !planStatusFilter && !roleFilter && !coachAssignmentFilter && !gymAssignmentFilter) {
        const users = allUsers;
        const coaches = users.filter(user => user.role === 'coach' && user.isApproved);
        const sanitizedCoaches = coaches.map(user => {
          const { password, ...userData } = user;
          return userData;
        });
        return res.json(sanitizedCoaches);
      }

      // If coach requesting clients (for coaches to message their clients)
      if (coachId && currentUser.role === 'coach' && !statusFilter && !subscriptionFilter && !planStatusFilter) {
        const users = allUsers;
        // For now, return all non-coach users as potential clients
        // In a real app, this would be filtered by actual coach-client relationships
        const clients = users.filter(user => user.role !== 'coach' && (user.role !== 'admin' && user.role !== 'super_admin'));
        const sanitizedClients = clients.map(user => {
          const { password, ...userData } = user;
          return userData;
        });
        return res.json(sanitizedClients);
      }

      // Admin or coach access to all users with filtering
      if ((currentUser.role === 'admin' || currentUser.role === 'super_admin') || currentUser.role === 'coach') {
        let users = allUsers;
        
        // Apply filters if provided
        if (statusFilter || subscriptionFilter || planStatusFilter || roleFilter || coachAssignmentFilter || gymAssignmentFilter) {
          const statusFilters = statusFilter ? statusFilter.split(',') : [];
          const subscriptionFilters = subscriptionFilter ? subscriptionFilter.split(',') : [];
          const planStatusFilters = planStatusFilter ? planStatusFilter.split(',') : [];
          const roleFilters = roleFilter ? roleFilter.split(',') : [];
          
          // Get all user plans for plan status filtering
          const allUserPlans = planStatusFilters.length > 0
            ? tenantPool
              ? await fetchTenantUserPlans(tenantPool, users)
              : await Promise.all(
                users.map(async (user) => ({
                  userId: user.id,
                  plans: await storage.getUserPlansByUserId(user.id)
                }))
              )
            : [];
          
          const userPlansMap = new Map(allUserPlans.map(item => [item.userId, item.plans]));
          
          // Import subscription utilities
          const { getSubscriptionStatus } = await import('@shared/subscriptionUtils');
          
          users = users.filter(user => {
            // Apply status filter (responsive = 2+ activities in last 7 days, idle = 0 activities in last 7 days)
            if (statusFilters.length > 0) {
              const sevenDaysAgo = new Date();
              sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
              
              // Check if user has lastActivityAt within last 7 days
              const hasRecentActivity = user.lastActivityAt && new Date(user.lastActivityAt) >= sevenDaysAgo;
              
              // For "responsive", we require activity in last 7 days
              // For "idle", user should have NO activity in last 7 days (or never had activity)
              const isResponsive = hasRecentActivity;
              const isIdle = !hasRecentActivity;
              
              const matchesStatus = statusFilters.some(filter => {
                if (filter === 'active' && isResponsive) return true;
                if (filter === 'inactive' && isIdle) return true;
                return false;
              });
              
              if (!matchesStatus) return false;
            }
            
            // Apply subscription filter
            if (subscriptionFilters.length > 0) {
              const subscriptionStatus = getSubscriptionStatus(
                user.subscriptionType,
                user.subscriptionStartDate,
                user.subscriptionEndDate
              );
              
              const matchesSubscription = subscriptionFilters.some(filter => {
                if (filter === 'active_subscription' && subscriptionStatus === 'active') return true;
                if (filter === 'expired_subscription' && subscriptionStatus === 'expired') return true;
                // Suspended includes: suspended and none statuses (no subscription or invalid dates)
                if (filter === 'suspended_subscription' && (subscriptionStatus === 'suspended' || subscriptionStatus === 'none')) return true;
                return false;
              });
              
              if (!matchesSubscription) return false;
            }
            
            // Apply plan status filter
            if (planStatusFilters.length > 0) {
              const userPlans = userPlansMap.get(user.id) || [];
              const hasPlans = userPlans.length > 0;
              
              const matchesPlanStatus = planStatusFilters.some(filter => {
                if (filter === 'with_plans' && hasPlans) return true;
                if (filter === 'without_plans' && !hasPlans) return true;
                return false;
              });
              
              if (!matchesPlanStatus) return false;
            }
            
            // Apply role filter
            if (roleFilters.length > 0) {
              if (!user.role) return false;
              const matchesRole = roleFilters.includes(user.role);
              if (!matchesRole) return false;
            }
            
            // Apply coach assignment filter
            if (coachAssignmentFilter) {
              if (coachAssignmentFilter === 'unassigned') {
                if (user.coachId) return false;
              } else {
                const targetCoachId = parseInt(coachAssignmentFilter);
                if (user.coachId !== targetCoachId) return false;
              }
            }
            
            // Apply gym assignment filter
            if (gymAssignmentFilter) {
              if (gymAssignmentFilter === 'unassigned') {
                if (user.gymId) return false;
              } else {
                const targetGymId = parseInt(gymAssignmentFilter);
                if (user.gymId !== targetGymId) return false;
              }
            }
            
            return true;
          });
        }
        
        const normalizedSearch = searchQuery?.trim().toLowerCase();
        if (normalizedSearch) {
          users = users.filter(user => {
            const fullName = `${user.firstName || ''} ${user.lastName || ''}`.toLowerCase();
            const contact = (user.whatsappWithCode || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            const userId = user.id?.toString() || '';
            return fullName.includes(normalizedSearch) || contact.includes(normalizedSearch) || email.includes(normalizedSearch) || userId.includes(normalizedSearch);
          });
        }

        const sanitizedUsers = users.map(user => {
          const { password, ...userData } = user;
          return userData;
        });
        
        // Apply pagination for admin/coach queries with filters
        const total = sanitizedUsers.length;
        const totalPages = Math.ceil(total / limit);
        const skip = (page - 1) * limit;
        const paginatedUsers = sanitizedUsers.slice(skip, skip + limit);
        
        return res.json({
          data: paginatedUsers,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
          }
        });
      }

      // Default: only return coaches for regular users
      const users = allUsers;
      const coaches = users.filter(user => user.role === 'coach');
      const sanitizedCoaches = coaches.map(user => {
        const { password, ...userData } = user;
        return userData;
      });
      
      // Apply pagination for regular users accessing coaches list
      const total = sanitizedCoaches.length;
      const totalPages = Math.ceil(total / limit);
      const skip = (page - 1) * limit;
      const paginatedCoaches = sanitizedCoaches.slice(skip, skip + limit);
      
      res.json({
        data: paginatedCoaches,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  app.get("/api/gym/members", isAuthenticated, isGymOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { targetGymId } = await resolveGymContext(currentUser, req.query.gymId as string | undefined);
      const members = await storage.getUsersByGymId(targetGymId);
      const filteredMembers = members.filter(member => member.id !== targetGymId);
      const sanitizedMembers = filteredMembers.map(sanitizeUser);
      const coaches = sanitizedMembers.filter((member: any) => member.role === 'coach');
      const users = sanitizedMembers.filter((member: any) => member.role === 'user');

      return res.json({
        gymId: targetGymId,
        totals: {
          coaches: coaches.length,
          users: users.length,
        },
        coaches,
        users,
      });
    } catch (error) {
      const status = (error as HttpError).status || 500;
      return res.status(status).json({ message: (error as Error).message || 'Failed to load gym members' });
    }
  });

  app.get("/api/gym/pending-coaches", isAuthenticated, isGymOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { targetGymId } = await resolveGymContext(currentUser, req.query.gymId as string | undefined);
      const members = await storage.getUsersByGymId(targetGymId);
      
      const pendingCoaches = members
        .filter(member => member.role === 'coach' && member.id !== targetGymId && member.isApproved !== true && !member.approvedAt)
        .map(sanitizeUser);
      
      return res.json(pendingCoaches);
    } catch (error) {
      const status = (error as HttpError).status || 500;
      return res.status(status).json({ message: (error as Error).message || 'Failed to load pending coaches' });
    }
  });

  app.patch("/api/gym/coaches/:id/approval", isAuthenticated, isGymOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { targetGymId } = await resolveGymContext(currentUser, req.query.gymId as string | undefined);
      const coachId = parseInt(req.params.id, 10);
      if (Number.isNaN(coachId)) {
        return res.status(400).json({ message: 'Invalid coach ID' });
      }
      const { isApproved } = req.body as { isApproved?: boolean };
      if (typeof isApproved !== 'boolean') {
        return res.status(400).json({ message: 'isApproved must be a boolean' });
      }
      const coach = await storage.getUser(coachId);
      if (!coach || coach.role !== 'coach') {
        return res.status(404).json({ message: 'Coach not found' });
      }
      if (coach.gymId !== targetGymId) {
        return res.status(403).json({ message: 'Coach does not belong to this gym' });
      }

      const updatedCoach = await storage.updateUser(coachId, {
        isApproved,
        approvedBy: currentUser.id,
        approvedAt: new Date(), // Always set approvedAt when reviewing (approve or reject)
      });
      if (!updatedCoach) {
        return res.status(500).json({ message: 'Failed to update coach approval status' });
      }
      return res.json(sanitizeUser(updatedCoach));
    } catch (error) {
      const status = (error as HttpError).status || 500;
      return res.status(status).json({ message: (error as Error).message || 'Failed to update coach approval' });
    }
  });

  app.patch("/api/gym/users/:id/unassign", isAuthenticated, isGymOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { targetGymId } = await resolveGymContext(currentUser, req.query.gymId as string | undefined);
      const targetUserId = parseInt(req.params.id, 10);
      if (Number.isNaN(targetUserId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      if (targetUserId === targetGymId) {
        return res.status(400).json({ message: 'Cannot unassign the gym owner account' });
      }
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      if (targetUser.gymId !== targetGymId) {
        return res.status(403).json({ message: 'User does not belong to this gym' });
      }

      const updateData: Partial<User> = { gymId: null };
      if (targetUser.role === 'user' && targetUser.coachId) {
        const assignedCoach = await storage.getUser(targetUser.coachId);
        if (assignedCoach?.gymId === targetGymId) {
          updateData.coachId = null;
        }
      }

      const updatedUser = await storage.updateUser(targetUserId, updateData);
      if (!updatedUser) {
        return res.status(500).json({ message: 'Failed to unassign user' });
      }
      return res.json(sanitizeUser(updatedUser));
    } catch (error) {
      const status = (error as HttpError).status || 500;
      return res.status(status).json({ message: (error as Error).message || 'Failed to unassign user from gym' });
    }
  });



  app.patch("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool;

      // Fetch user from the correct database (tenant or main)
      let user: any;
      if (tenantPool) {
        const usersDb = resolveDb(req);
        const [tenantUser] = await usersDb.select().from(users).where(eq(users.id, userId));
        user = tenantUser;
      } else {
        user = await storage.getUser(userId);
      }
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // If username is being updated, check for conflicts in the correct DB
      if (req.body.username && req.body.username !== user.username) {
        if (tenantPool) {
          const conflictResult = await tenantPool.query(
            'SELECT id FROM users WHERE username = $1 AND id != $2 LIMIT 1',
            [req.body.username, userId]
          );
          if (conflictResult.rows.length > 0) {
            return res.status(400).json({ message: "Username already exists" });
          }
        } else {
          const existingUser = await storage.getUserByUsername(req.body.username);
          if (existingUser && existingUser.id !== userId) {
            return res.status(400).json({ message: "Username already exists" });
          }
        }
      }

      // Sanitize incoming update data: convert empty strings to null, numeric strings to numbers, boolean strings to booleans
      const rawData = { ...req.body } as Record<string, any>;
      const updateData: Record<string, any> = {};
      Object.entries(rawData).forEach(([key, value]) => {
        if (value === '') {
          // CRITICAL: Never set email, username, or pinNumber to NULL - these are authentication fields
          if (key === 'email' || key === 'username' || key === 'pinNumber') {
            return; // Skip this field, keep existing value
          }
          updateData[key] = null;
          return;
        }
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'true') { updateData[key] = true; return; }
            if (lower === 'false') { updateData[key] = false; return; }
          // Numeric detection (ints / floats)
          if (/^-?\d+(?:\.\d+)?$/.test(value)) {
            const num = value.includes('.') ? parseFloat(value) : parseInt(value, 10);
            updateData[key] = num;
            return;
          }
        }
        updateData[key] = value;
      });

      // Only allow role changes for admin users
      if (req.body.role && (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        delete updateData.role;
      }

      if (Object.prototype.hasOwnProperty.call(updateData, 'coachId')) {
        if (updateData.coachId === null) {
          // Do not automatically clear gymId to preserve direct gym assignments
        } else {
          const coachIdValue = updateData.coachId;
          if (typeof coachIdValue !== 'number' || Number.isNaN(coachIdValue)) {
            return res.status(400).json({ message: 'coachId must be a valid number' });
          }
          let assignedCoach: any;
          if (tenantPool) {
            const coachResult = await tenantPool.query(
              'SELECT id, role, gym_id FROM users WHERE id = $1 LIMIT 1',
              [coachIdValue]
            );
            assignedCoach = coachResult.rows[0] ? mapTenantRow(coachResult.rows[0]) : null;
          } else {
            assignedCoach = await storage.getUser(coachIdValue);
          }
          if (!assignedCoach || assignedCoach.role !== 'coach') {
            return res.status(400).json({ message: 'coachId must reference an existing coach' });
          }
          updateData.gymId = assignedCoach.gymId ?? null;
        }
      }

      // Prevent empty updates
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No data to update" });
      }

      if (tenantPool) {
        // Build dynamic SQL UPDATE for tenant database
        const camelToSnakePatch = (str: string) => str.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);
        const setClauses: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updateData)) {
          const column = camelToSnakePatch(key);
          setClauses.push(`${column} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
        setClauses.push(`updated_at = NOW()`);
        values.push(userId);

        const updateResult = await tenantPool.query(
          `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
          values
        );

        if (updateResult.rows.length > 0) {
          const { password, ...userData } = mapTenantRow(updateResult.rows[0]);
          return res.json(userData);
        } else {
          return res.status(500).json({ message: "Failed to update user" });
        }
      } else {
        const updatedUser = await storage.updateUser(userId, updateData);
        if (updatedUser) {
          const { password, ...userData } = updatedUser;
          res.json(userData);
        } else {
          res.status(500).json({ message: "Failed to update user" });
        }
      }
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Error updating user" });
    }
  });

  // Admin-only coach approval endpoint
  app.patch("/api/admin/coaches/:id/approval", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      // Only admins can approve coaches
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const coachId = parseInt(req.params.id);
      const { isApproved } = req.body;

      if (typeof isApproved !== 'boolean') {
        return res.status(400).json({ message: "isApproved must be a boolean value" });
      }

      // Check if this is a tenant request
      const tenantPool = (req as any).tenantPool;
      const isInTenant = Boolean(tenantPool);

      let coach: any;
      let updatedCoach: any;

      if (isInTenant) {
        // Tenant database: use direct SQL queries
        const getResult = await tenantPool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [coachId]);
        if (getResult.rows.length === 0) {
          return res.status(404).json({ message: "Coach not found" });
        }
        coach = mapTenantUserRow(getResult.rows[0]);

        if (coach.role !== 'coach') {
          return res.status(400).json({ message: "User is not a coach" });
        }

        // Update coach approval status
        const updateResult = await tenantPool.query(
          'UPDATE users SET is_approved = $1, approved_at = NOW(), approved_by = $3, updated_at = NOW() WHERE id = $2 RETURNING *',
          [isApproved, coachId, currentUser.id]
        );
        
        if (updateResult.rows.length > 0) {
          updatedCoach = mapTenantUserRow(updateResult.rows[0]);
        }
      } else {
        // Central database: use storage methods
        coach = await storage.getUser(coachId);
        if (!coach) {
          return res.status(404).json({ message: "Coach not found" });
        }

        if (coach.role !== 'coach') {
          return res.status(400).json({ message: "User is not a coach" });
        }

        updatedCoach = await storage.updateUser(coachId, { 
          isApproved,
          approvedAt: new Date(),
          approvedBy: currentUser.id
        });
      }

      if (updatedCoach) {
        const { password, ...coachData } = updatedCoach;
        res.json(coachData);
      } else {
        res.status(500).json({ message: "Failed to update coach approval status" });
      }
    } catch (error) {
      console.error("Error updating coach approval:", error);
      res.status(500).json({ message: "Error updating coach approval status" });
    }
  });

  // Admin-only subscription management
  app.patch('/api/users/:id/subscription', isAuthenticated, async (req, res) => {
    try {
      console.log('Subscription update request received');

      const currentUser = req.user as any;
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
      }

      const userId = parseInt(req.params.id);
      if (Number.isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      const subscriptionData = req.body;

      console.log('User ID:', userId, 'Subscription data:', subscriptionData);

      // Validate subscription data
      const { subscriptionType } = subscriptionData;

      // If subscriptionType is provided, validate and format it
      let formattedSubscriptionType = subscriptionType;
      if (!subscriptionType || typeof subscriptionType !== 'string') {
        return res.status(400).json({ error: 'subscriptionType is required' });
      }
      if (subscriptionType) {
        // Check if it's just a number (from the admin form)
        const numberMatch = subscriptionType.match(/^(\d+(?:\.\d{1,2})?)$/);
        if (numberMatch) {
          // Format as "{number}_months"
          formattedSubscriptionType = `${numberMatch[1]}_months`;
        } else {
          // Check if it's already in the correct format
          if (!/^(\d+(?:\.\d{1,2})?)_(month|months)$/.test(subscriptionType)) {
            return res.status(400).json({ 
              error: "Invalid subscription type format. Use format like '1', '3', '1.5', '3.78', etc." 
            });
          }
        }
      }

      // Parse dates if provided
      const updateData: any = {
        subscriptionType: formattedSubscriptionType
      };

      if (subscriptionData.subscriptionStartDate) {
        updateData.subscriptionStartDate = new Date(subscriptionData.subscriptionStartDate);
      } else {
        // If no start date provided, use current date
        updateData.subscriptionStartDate = new Date();
      }

      if (Number.isNaN(updateData.subscriptionStartDate.getTime())) {
        return res.status(400).json({ error: 'Invalid subscriptionStartDate' });
      }

      // Always automatically calculate end date - don't accept manual end date
      updateData.subscriptionEndDate = calculateSubscriptionEndDate(updateData.subscriptionStartDate, formattedSubscriptionType);

      const tenantPool = (req as any).tenantPool;
      if (tenantPool) {
        const updateResult = await tenantPool.query(
          `UPDATE users
           SET subscription_type = $1,
               subscription_start_date = $2,
               subscription_end_date = $3,
               updated_at = NOW()
           WHERE id = $4
           RETURNING *`,
          [
            updateData.subscriptionType,
            updateData.subscriptionStartDate,
            updateData.subscriptionEndDate,
            userId,
          ]
        );

        if (updateResult.rows.length === 0) {
          return res.status(404).json({ message: 'User not found' });
        }

        const { password, ...userData } = mapTenantUserRow(updateResult.rows[0]);
        return res.json(userData);
      }

      const updatedUser = await storage.updateUserSubscription(userId, updateData);
      if (updatedUser) {
        const { password, ...userData } = updatedUser;
        res.json(userData);
      } else {
        res.status(500).json({ message: 'Failed to update subscription' });
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      res.status(500).json({ message: 'Error updating subscription' });
    }
  });

  // Nutrition/Meals routes
  app.get("/api/meals", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id; // Use authenticated user's ID
      const dateParam = req.query.date as string;
      const mealsDb = resolveDb(req);

      if (dateParam) {
        const date = new Date(dateParam);
        if (isNaN(date.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }

        // Convert the input date to start and end of day for proper comparison
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const mealsResult = await mealsDb
          .select()
          .from(meals)
          .where(
            and(
              eq(meals.userId, userId),
              gte(meals.date, startOfDay),
              lte(meals.date, endOfDay)
            )
          );
        return res.json(mealsResult);
      }

      const mealsResult = await mealsDb.select().from(meals).where(eq(meals.userId, userId));
      res.json(mealsResult);
    } catch (error) {
      res.status(500).json({ message: "Error fetching meals" });
    }
  });

  app.post("/api/meals", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userId = currentUser.id; // Use authenticated user's ID
      const mealsDb = resolveDb(req);

      // Convert the date string to a Date object before validation
      let mealData = { ...req.body };
      if (typeof mealData.date === 'string') {
        mealData.date = new Date(mealData.date);
      }

      const parsedData = insertMealSchema.parse({
        ...mealData,
        userId
      });

      // Create meal using tenant-aware database
      const [meal] = await mealsDb
        .insert(meals)
        .values(parsedData)
        .returning();

      if (currentUser?.role === 'user') {
        try {
          const scope = buildScopeFromRequest(req);
          await getOrCreateAccountWithBalance(scope, userId);

          const consumeResult = await consumeCredits(scope, {
            userId,
            actionKey: 'nutrition_log_meal',
          });

          if ('insufficient' in consumeResult) {
            // Delete meal using tenant-aware database
            await mealsDb.delete(meals).where(eq(meals.id, meal.id));
            const language = getRequestLanguage(req);
            return res.status(402).json({ message: getInsufficientCreditsMessage(language), balance: consumeResult.balance });
          }
        } catch (creditError) {
          // Delete meal using tenant-aware database
          await mealsDb.delete(meals).where(eq(meals.id, meal.id));
          console.error('Error consuming credits for meal log:', creditError);
          return res.status(500).json({ message: 'Failed to consume credits' });
        }
      }

      // Award points based on meal type
      const mealType = meal.type.toLowerCase();
      let points = 0;
      let actionType = '';

      switch (mealType) {
        case 'breakfast':
          points = 5;
          actionType = 'breakfast';
          break;
        case 'lunch':
          points = 5;
          actionType = 'lunch';
          break;
        case 'dinner':
          points = 5;
          actionType = 'dinner';
          break;
        case 'snack':
          points = 3;
          actionType = 'snack';
          break;
      }

      if (points > 0) {
        await addPointsForRequest(req, userId, points, actionType);
        // Update streak - user logged a meal today
        await updateStreakForRequest(req, userId, true);
      }

      await recalculateDailyStatsForRequest(req, userId, meal.date);

      res.status(201).json(meal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error("Error creating meal:", error);
      res.status(500).json({ message: "Error creating meal" });
    }
  });

  app.get("/api/meals/:id", isAuthenticated, async (req, res) => {
    try {
      const mealId = parseInt(req.params.id);
      const mealsDb = resolveDb(req);
      const [meal] = await mealsDb.select().from(meals).where(eq(meals.id, mealId));

      if (!meal) {
        return res.status(404).json({ message: "Meal not found" });
      }

      // Check if the meal belongs to the current user
      if (meal.userId !== (req.user as any).id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      res.json(meal);
    } catch (error) {
      res.status(500).json({ message: "Error fetching meal" });
    }
  });

  app.patch("/api/meals/:id", isAuthenticated, async (req, res) => {
    try {
      const mealId = parseInt(req.params.id);
      const mealsDb = resolveDb(req);
      const [meal] = await mealsDb.select().from(meals).where(eq(meals.id, mealId));

      if (!meal) {
        return res.status(404).json({ message: "Meal not found" });
      }

      // Check if the meal belongs to the current user
      if (meal.userId !== (req.user as any).id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Validate update data using a partial meal schema with date preprocessing
      const updateMealSchema = insertMealSchema.partial().omit({ userId: true }).extend({
        date: z.union([z.date(), z.string().transform((str) => new Date(str))]).optional()
      });

      let mealData;
      try {
        mealData = updateMealSchema.parse(req.body);
      } catch (validationError) {
        if (validationError instanceof z.ZodError) {
          return res.status(400).json({ 
            message: "Invalid meal data", 
            errors: validationError.errors 
          });
        }
        throw validationError;
      }

      const [updatedMeal] = await mealsDb
        .update(meals)
        .set(mealData)
        .where(eq(meals.id, mealId))
        .returning();

      if (updatedMeal) {
        const originalDate = new Date(meal.date);
        const updatedDate = new Date(updatedMeal.date);
        originalDate.setHours(0, 0, 0, 0);
        updatedDate.setHours(0, 0, 0, 0);

        if (originalDate.getTime() !== updatedDate.getTime()) {
          await recalculateDailyStatsForRequest(req, updatedMeal.userId, originalDate);
        }
        await recalculateDailyStatsForRequest(req, updatedMeal.userId, updatedDate);
        res.json(updatedMeal);
      } else {
        res.status(500).json({ message: "Failed to update meal" });
      }
    } catch (error) {
      console.error("Error updating meal:", error);
      res.status(500).json({ message: "Error updating meal" });
    }
  });

  app.delete("/api/meals/:id", isAuthenticated, async (req, res) => {
    try {
      const mealId = parseInt(req.params.id);
      const mealsDb = resolveDb(req);
      const [meal] = await mealsDb.select().from(meals).where(eq(meals.id, mealId));

      if (!meal) {
        return res.status(404).json({ message: "Meal not found" });
      }

      // Check if the meal belongs to the current user
      if (meal.userId !== (req.user as any).id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await mealsDb.delete(meals).where(eq(meals.id, mealId));
      await recalculateDailyStatsForRequest(req, meal.userId, meal.date);
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Error deleting meal" });
    }
  });

  // Progress tracking routes
  app.get("/api/progress", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const dateParam = req.query.date as string;

      if (dateParam) {
        const date = new Date(dateParam);
        if (isNaN(date.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }

        const progress = await getProgressByDateForRequest(req, userId, date);
        return res.json(progress || null);
      }

      // Get date range if provided
      const startDateParam = req.query.startDate as string;
      const endDateParam = req.query.endDate as string;

      if (startDateParam && endDateParam) {
        const startDate = new Date(startDateParam);
        const endDate = new Date(endDateParam);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }

        const progressList = await getProgressByDateRangeForRequest(req, userId, startDate, endDate);
        return res.json(progressList);
      }

      const progressList = await getProgressByUserIdForRequest(req, userId);
      res.json(progressList);
    } catch (error) {
      res.status(500).json({ message: "Error fetching progress data" });
    }
  });

  app.post("/api/progress", isAuthenticated, async (req, res) => {
    try {
      console.log('Progress POST request received:', req.body);
      const currentUser = req.user as any;
      const userId = currentUser.id;
      console.log('User ID:', userId);

      // Convert date string to Date object
      const progressData = {
        ...req.body,
        userId,
        date: new Date(req.body.date)
      };

      const parsedData = insertProgressSchema.parse(progressData);
      console.log('Parsed progress data:', parsedData);

      const progress = await createProgressForRequest(req, parsedData);
      console.log('Progress created successfully:', progress);

      // Consume credits for trainee users
      if (currentUser?.role === 'user') {
        try {
          const scope = buildScopeFromRequest(req);
          await getOrCreateAccountWithBalance(scope, userId);

          // Determine action key based on what was logged
          let actionKey = 'progress_log_entry';
          if (parsedData.waterGlasses !== null && parsedData.waterGlasses !== undefined) {
            actionKey = 'nutrition_log_water';
          }

          const consumeResult = await consumeCredits(scope, {
            userId,
            actionKey,
          });

          if ('insufficient' in consumeResult) {
            // Rollback: delete the progress entry
            await deleteProgressForRequest(req, progress.id);
            const language = getRequestLanguage(req);
            return res.status(402).json({ message: getInsufficientCreditsMessage(language), balance: consumeResult.balance });
          }
        } catch (creditError) {
          await deleteProgressForRequest(req, progress.id);
          console.error('Error consuming credits for progress log:', creditError);
          return res.status(500).json({ message: 'Failed to consume credits' });
        }
      }

      // Award points if weight was logged (once per day)
      if (progress.weight !== null && progress.weight !== undefined) {
        await addPointsForRequest(req, userId, 10, 'weight');
      }

      res.status(201).json(progress);
    } catch (error) {
      console.error('Error creating progress entry:', error);
      if (error instanceof z.ZodError) {
        console.log('Validation errors:', error.errors);
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Error creating progress entry" });
    }
  });

  app.patch("/api/progress/:id", isAuthenticated, async (req, res) => {
    try {
      const progressId = parseInt(req.params.id);
      const progress = await getProgressForRequest(req, progressId);

      if (!progress) {
        return res.status(404).json({ message: "Progress entry not found" });
      }

      // Check if the progress entry belongs to the current user
      if (progress.userId !== (req.user as any).id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updatedProgress = await updateProgressForRequest(req, progressId, req.body);
      if (updatedProgress) {
        res.json(updatedProgress);
      } else {
        res.status(500).json({ message: "Failed to update progress entry" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error updating progress entry" });
    }
  });

  // Daily Stats routes
  app.get("/api/daily-stats", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id; // Use authenticated user's ID
      const dateParam = req.query.date as string;

      if (dateParam) {
        const date = new Date(dateParam);
        if (isNaN(date.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }

        let stats = await getDailyStatsByUserAndDateForRequest(req, userId, date);

        // If no stats exist for the requested date, create default stats
        if (!stats) {
          // Get user's latest plan to use for goals
          const userPlan = await storage.getLatestUserPlan(userId);
          let caloriesGoal = 2000, proteinGoal = 150, carbsGoal = 250, fatGoal = 65;

          // If user has a plan with goals, use those instead of defaults
          if (userPlan && userPlan.goals && typeof userPlan.goals === 'object') {
            const goals = userPlan.goals as any;
            caloriesGoal = goals.calories || 2000;
            proteinGoal = goals.protein || 150;
            carbsGoal = goals.carbs || 250;
            fatGoal = goals.fat || 65;
          }

          stats = await createDailyStatsForRequest(req, {
            userId,
            date: new Date(date.getTime()), // Create a new Date object to avoid mutation
            calories: 0,
            caloriesGoal,
            protein: 0,
            proteinGoal,
            carbs: 0,
            carbsGoal,
            fat: 0,
            fatGoal,
            fiber: 0,
            fiberGoal: 30,
            steps: 0,
            stepsGoal: 10000,
            water: 0,
            waterGoal: 8
          });
        }

        return res.json(stats);
      }

      // Get weekly stats if startDate is provided
      const startDateParam = req.query.startDate as string;
      const endDateParam = req.query.endDate as string;

      if (startDateParam) {
        const startDate = new Date(startDateParam);

        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }

        // If endDate is provided, get stats for the range
        if (endDateParam) {
          const endDate = new Date(endDateParam);
          if (isNaN(endDate.getTime())) {
            return res.status(400).json({ message: "Invalid end date format" });
          }

          const rangeStats = await getDailyStatsByDateRangeForRequest(req, userId, startDate, endDate);
          return res.json(rangeStats);
        }

        const weeklyStats = await getWeeklyStatsForRequest(req, userId, startDate);
        return res.json(weeklyStats);
      }

      // Default to today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let stats = await getDailyStatsByUserAndDateForRequest(req, userId, today);

      // If no stats exist for today, create default stats
      if (!stats) {
        // Get user's latest plan to use for goals
        const userPlan = await getLatestUserPlanForRequest(req, userId);
        let caloriesGoal = 2000, proteinGoal = 150, carbsGoal = 250, fatGoal = 65;

        // If user has a plan with goals, use those instead of defaults
        if (userPlan && userPlan.goals && typeof userPlan.goals === 'object') {
          const goals = userPlan.goals as any;
          caloriesGoal = goals.calories || 2000;
          proteinGoal = goals.protein || 150;
          carbsGoal = goals.carbs || 250;
          fatGoal = goals.fat || 65;
        }

        stats = await createDailyStatsForRequest(req, {
          userId,
          date: today,
          calories: 0,
          caloriesGoal,
          protein: 0,
          proteinGoal,
          carbs: 0,
          carbsGoal,
          fat: 0,
          fatGoal,
          fiber: 0,
          fiberGoal: 30,
          steps: 0,
          stepsGoal: 10000,
          water: 0,
          waterGoal: 8
        });
      }

      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching daily stats" });
    }
  });

  app.patch("/api/daily-stats/:id", isAuthenticated, async (req, res) => {
    try {
      const statsId = parseInt(req.params.id);
      const stats = await getDailyStatsByIdForRequest(req, statsId);

      if (!stats) {
        return res.status(404).json({ message: "Daily stats not found" });
      }

      // Check if the stats belong to the current user
      if (stats.userId !== (req.user as any).id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updatedStats = await updateDailyStatsForRequest(req, statsId, req.body);
      if (updatedStats) {
        res.json(updatedStats);
      } else {
        res.status(500).json({ message: "Failed to update daily stats" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error updating daily stats" });
    }
  });

  // Weekly stats route for dashboard chart
  app.get("/api/weekly-stats", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userId = currentUser.id; // Use authenticated user's ID
      const startDateParam = req.query.startDate as string;

      let startDate: Date;
      if (startDateParam) {
        startDate = new Date(startDateParam);
        if (isNaN(startDate.getTime())) {
          return res.status(400).json({ message: "Invalid start date format" });
        }
      } else {
        // Default to last 7 days
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
      }

      console.log('Fetching weekly stats for user:', userId, 'from date:', startDate);
      const weeklyStats = await getWeeklyStatsForRequest(req, userId, startDate);
      console.log('Found weekly stats:', weeklyStats.length, 'records');
      res.json(weeklyStats);
    } catch (error) {
      console.error('Error fetching weekly stats:', error);
      res.status(500).json({ message: "Error fetching weekly stats" });
    }
  });

  // User Points and Streaks routes
  app.get("/api/user-points", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      
      // Get or create user points record
      let userPoints = isTenantRequest(req)
        ? await getTenantUserPointsAndStreaks(req, userId)
        : await storage.getUserPointsAndStreaks(userId);

      if (!userPoints) {
        userPoints = isTenantRequest(req)
          ? await createTenantUserPointsAndStreaks(req, userId)
          : await storage.createUserPointsAndStreaks({
              userId,
              totalPoints: 0,
              currentStreak: 0,
              longestStreak: 0
            });
      }

      // Calculate level and rank based on points
      const totalPoints = userPoints.totalPoints;
      let level = 1;
      let rank = "Starter";
      let nextLevelPoints = 200;

      if (totalPoints >= 2500) {
        level = 5;
        rank = "Elite";
        nextLevelPoints = 0; // Max level
      } else if (totalPoints >= 1000) {
        level = 4;
        rank = "Athlete";
        nextLevelPoints = 2500;
      } else if (totalPoints >= 500) {
        level = 3;
        rank = "Dedicated";
        nextLevelPoints = 1000;
      } else if (totalPoints >= 200) {
        level = 2;
        rank = "Consistent";
        nextLevelPoints = 500;
      } else {
        level = 1;
        rank = "Starter";
        nextLevelPoints = 200;
      }

      res.json({
        ...userPoints,
        level,
        rank,
        nextLevelPoints
      });
    } catch (error) {
      console.error('Error fetching user points:', error);
      res.status(500).json({ message: "Error fetching user points" });
    }
  });

  // Get all coaches (admin only)
  app.get("/api/coaches", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      // Only admins can fetch all coaches
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: "Access denied. Admin privileges required." });
      }

      const coaches = await storage.getUsersByRole('coach');
      // Return sanitized coach data (no passwords)
      const sanitizedCoaches = coaches.map(({ password, ...coach }) => coach);
      res.json(sanitizedCoaches);
    } catch (error) {
      console.error('Error fetching coaches:', error);
      res.status(500).json({ message: "Error fetching coaches" });
    }
  });

  // Admin routes for comprehensive user activity data
  app.get("/api/admin/users/:userId/activity", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Check if user is admin or coach
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && currentUser.role !== 'coach') {
        return res.status(403).json({ message: "Access denied. Admin or coach privileges required." });
      }

      const userId = parseInt(req.params.userId);
      const { startDate, endDate, limit = 50 } = req.query;
      const mealsDb = resolveDb(req);

      // Fetch comprehensive activity data
      const [
        progressData,
        mealData,
        workoutSessions,
        dailyStatsData,
        userWorkouts,
        messages
      ] = await Promise.all([
        // Progress entries
        startDate && endDate 
          ? getProgressByDateRangeForRequest(req, userId, new Date(startDate as string), new Date(endDate as string))
          : getProgressByUserIdForRequest(req, userId),

        // Meal entries - use tenant-aware database
        startDate && endDate
          ? mealsDb.select().from(meals).where(
              and(
                eq(meals.userId, userId),
                gte(meals.date, new Date(startDate as string)),
                lte(meals.date, new Date(endDate as string))
              )
            ).orderBy(desc(meals.date))
          : mealsDb.select().from(meals).where(eq(meals.userId, userId)),

        // Workout sessions
        startDate && endDate
          ? getWorkoutSessionsByDateRangeForRequest(req, userId, new Date(startDate as string), new Date(endDate as string))
          : getWorkoutSessionsByUserIdForRequest(req, userId),

        // Daily stats
        startDate && endDate
          ? storage.getDailyStatsByDateRange(userId, new Date(startDate as string), new Date(endDate as string))
          : storage.getDailyStatsByUserId(userId),

        // Scheduled workouts
        getUserWorkoutsByUserIdForRequest(req, userId),

        // Messages (if admin is requesting)
        (currentUser.role === 'admin' || currentUser.role === 'super_admin') ? storage.getMessagesByUserId(userId) : []
      ]);

      // Combine and sort all activities by date
      const activities: any[] = [];

      // Add progress entries
      progressData.forEach(progress => {
        activities.push({
          id: `progress-${progress.id}`,
          type: 'progress',
          action: 'Progress Update',
          date: progress.date,
          time: progress.date,
          details: {
            weight: progress.weight,
            caloriesConsumed: progress.caloriesConsumed,
            caloriesBurned: progress.caloriesBurned,
            steps: progress.steps,
            waterGlasses: progress.waterGlasses,
            notes: progress.notes
          },
          summary: `Weight: ${progress.weight || 'N/A'}kg, Steps: ${progress.steps || 0}, Water: ${progress.waterGlasses || 0} glasses`
        });
      });

      // Add meal entries
      mealData.forEach(meal => {
        activities.push({
          id: `meal-${meal.id}`,
          type: 'meal',
          action: 'Meal Logged',
          date: meal.date,
          time: meal.date,
          details: {
            name: meal.name,
            type: meal.type,
            calories: meal.calories,
            proteins: meal.proteins,
            carbs: meal.carbs,
            fats: meal.fats,
            fiber: meal.fiber
          },
          summary: `${meal.type}: ${meal.name} (${meal.calories} cal)`
        });
      });

      // Add workout sessions
      workoutSessions.forEach(session => {
        activities.push({
          id: `workout-session-${session.id}`,
          type: 'workout-session',
          action: 'Workout Completed',
          date: session.completedAt,
          time: session.completedAt,
          details: {
            workoutName: session.workoutName,
            workoutType: session.workoutType,
            duration: session.duration,
            totalSets: session.totalSets,
            completedSets: session.completedSets,
            exercises: session.exercises,
            notes: session.notes
          },
          summary: `${session.workoutName} (${session.duration || 0}min, ${session.completedSets}/${session.totalSets} sets)`
        });
      });

      // Add daily stats entries
      dailyStatsData.forEach(stats => {
        activities.push({
          id: `daily-stats-${stats.id}`,
          type: 'daily-stats',
          action: 'Daily Stats Updated',
          date: stats.date,
          time: stats.date,
          details: {
            calories: stats.calories,
            caloriesGoal: stats.caloriesGoal,
            protein: stats.protein,
            proteinGoal: stats.proteinGoal,
            carbs: stats.carbs,
            carbsGoal: stats.carbsGoal,
            fat: stats.fat,
            fatGoal: stats.fatGoal,
            fiber: stats.fiber,
            fiberGoal: stats.fiberGoal,
            steps: stats.steps,
            stepsGoal: stats.stepsGoal,
            water: stats.water,
            waterGoal: stats.waterGoal
          },
          summary: `Daily goals: ${stats.calories}/${stats.caloriesGoal} cal, ${stats.steps}/${stats.stepsGoal} steps`
        });
      });

      // Add scheduled workouts
      userWorkouts.forEach(workout => {
        activities.push({
          id: `user-workout-${workout.id}`,
          type: 'scheduled-workout',
          action: workout.completed ? 'Workout Completed' : 'Workout Scheduled',
          date: workout.completed ? workout.completedAt : workout.scheduledFor,
          time: workout.completed ? workout.completedAt : workout.scheduledFor,
          details: {
            workoutId: workout.workoutId,
            scheduledFor: workout.scheduledFor,
            completed: workout.completed,
            completedAt: workout.completedAt
          },
          summary: `Workout ${workout.completed ? 'completed' : 'scheduled'} for ${new Date(workout.scheduledFor).toLocaleDateString()}`
        });
      });

      // Add messages (admin only)
      messages.forEach(message => {
        activities.push({
          id: `message-${message.id}`,
          type: 'message',
          action: message.senderId === userId ? 'Message Sent' : 'Message Received',
          date: message.sentAt,
          time: message.sentAt,
          details: {
            content: message.content,
            senderId: message.senderId,
            receiverId: message.receiverId,
            read: message.read
          },
          summary: `${message.senderId === userId ? 'Sent' : 'Received'}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`
        });
      });

      // Sort activities by date (most recent first) and limit
      const sortedActivities = activities
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, parseInt(limit as string));

      res.json({
        activities: sortedActivities,
        totalCount: activities.length,
        summary: {
          progressEntries: progressData.length,
          mealEntries: mealData.length,
          workoutSessions: workoutSessions.length,
          dailyStatsEntries: dailyStatsData.length,
          scheduledWorkouts: userWorkouts.length,
          messages: messages.length
        }
      });
    } catch (error) {
      console.error('Error fetching user activity:', error);
      res.status(500).json({ message: "Error fetching user activity data" });
    }
  });

  // Admin route for user summary data
  app.get("/api/admin/users/:userId/summary", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Check if user is admin or coach
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && currentUser.role !== 'coach') {
        return res.status(403).json({ message: "Access denied. Admin or coach privileges required." });
      }

      const userId = parseInt(req.params.userId);

      // Fetch user and subscription data
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get latest user plan
      const latestPlan = await storage.getLatestUserPlan(userId);

      // Get recent activity counts (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const mealsDb = resolveDb(req);

      const [
        recentProgress,
        recentMeals,
        recentWorkoutSessions,
        totalScheduledWorkouts,
        unreadMessages
      ] = await Promise.all([
        getProgressByDateRangeForRequest(req, userId, thirtyDaysAgo, new Date()),
        mealsDb.select().from(meals).where(
          and(
            eq(meals.userId, userId),
            gte(meals.date, thirtyDaysAgo),
            lte(meals.date, new Date())
          )
        ).orderBy(desc(meals.date)),
        getWorkoutSessionsByDateRangeForRequest(req, userId, thirtyDaysAgo, new Date()),
        getUserWorkoutsByUserIdForRequest(req, userId),
        (currentUser.role === 'admin' || currentUser.role === 'super_admin') ? storage.getUnreadMessagesByUserId(userId) : []
      ]);

      const summary = {
        user: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          phoneNumber: user.phoneNumber,
          role: user.role,
          subscriptionType: user.subscriptionType,
          subscriptionStartDate: user.subscriptionStartDate,
          subscriptionEndDate: user.subscriptionEndDate,
          profilePicture: user.profilePicture,
          fitnessGoal: user.fitnessGoal,
          activityLevel: user.activityLevel,
          weight: user.weight,
          height: user.height,
          goalWeight: user.goalWeight,
          age: user.age,
          gender: user.gender,
          bio: user.bio
        },
        subscription: {
          type: user.subscriptionType,
          startDate: user.subscriptionStartDate,
          endDate: user.subscriptionEndDate,
          status: getSubscriptionStatus(user.subscriptionType, user.subscriptionStartDate, user.subscriptionEndDate),
          isActive: getSubscriptionStatus(user.subscriptionType, user.subscriptionStartDate, user.subscriptionEndDate) === 'active',
          isSuspended: getSubscriptionStatus(user.subscriptionType, user.subscriptionStartDate, user.subscriptionEndDate) === 'suspended',
          daysRemaining: user.subscriptionEndDate && getSubscriptionStatus(user.subscriptionType, user.subscriptionStartDate, user.subscriptionEndDate) === 'active'
            ? Math.max(0, Math.ceil((new Date(user.subscriptionEndDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
            : 0
        },
        currentPlan: latestPlan,
        recentActivity: {
          progressEntries: recentProgress.length,
          mealEntries: recentMeals.length,
          workoutSessions: recentWorkoutSessions.length,
          totalScheduledWorkouts: totalScheduledWorkouts.length,
          completedWorkouts: totalScheduledWorkouts.filter(w => w.completed).length,
          unreadMessages: unreadMessages.length
        },
        statistics: {
          averageWeightLoss: recentProgress.length > 1 
            ? ((recentProgress[0].weight || 0) - (recentProgress[recentProgress.length - 1].weight || 0))
            : 0,
          totalWorkoutsCompleted: recentWorkoutSessions.length,
          averageWorkoutDuration: recentWorkoutSessions.length > 0
            ? Math.round(recentWorkoutSessions.reduce((sum, session) => sum + (session.duration || 0), 0) / recentWorkoutSessions.length)
            : 0,
          totalCaloriesConsumed: recentMeals.reduce((sum, meal) => sum + meal.calories, 0),
          averageDailyCalories: recentMeals.length > 0
            ? Math.round(recentMeals.reduce((sum, meal) => sum + meal.calories, 0) / Math.max(1, recentMeals.length))
            : 0
        }
      };

      res.json(summary);
    } catch (error) {
      console.error('Error fetching user summary:', error);
      res.status(500).json({ message: "Error fetching user summary data" });
    }
  });

  // Products routes
  app.get("/api/products", async (req, res) => {
    try {
      const category = req.query.category as string;
      const tenantPool = (req as any).tenantPool;

      if (tenantPool) {
        // Tenant subdomains only show their own products (no fallback to central)
        if (category) {
          const result = await tenantPool.query('SELECT * FROM products WHERE category = $1', [category]);
          return res.json(result.rows.map(mapTenantRow));
        }
        const result = await tenantPool.query('SELECT * FROM products');
        return res.json(result.rows.map(mapTenantRow));
      }

      // Central domain uses central database
      if (category) {
        const products = await storage.getProductsByCategory(category);
        return res.json(products);
      }

      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: "Error fetching products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const productId = parseInt(req.params.id);
      const tenantPool = (req as any).tenantPool;

      if (tenantPool) {
        // Tenant subdomains only show their own products (no fallback to central)
        const result = await tenantPool.query('SELECT * FROM products WHERE id = $1', [productId]);
        const row = result.rows[0];
        if (!row) {
          return res.status(404).json({ message: "Product not found" });
        }
        return res.json(mapTenantRow(row));
      }

      // Central domain uses central database
      const product = await storage.getProduct(productId);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      res.status(500).json({ message: "Error fetching product" });
    }
  });

  // Create product (admin and coach only)
  app.post("/api/products", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const tenantPool = (req as any).tenantPool;

      // Check if user is admin or coach
      if ((user.role !== 'admin' && user.role !== 'super_admin') && user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied. Admin or coach privileges required." });
      }

      const validatedData = insertProductSchema.parse(req.body);

      if (tenantPool) {
        const columns = [
          'name',
          'description',
          'price',
          'image_url',
          'category',
          'rating',
          'review_count',
          'stock',
        ];
        const values = [
          validatedData.name,
          validatedData.description,
          validatedData.price,
          validatedData.imageUrl ?? null,
          validatedData.category,
          validatedData.rating ?? null,
          validatedData.reviewCount ?? null,
          validatedData.stock,
        ];
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const result = await tenantPool.query(
          `INSERT INTO products (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
          values
        );
        return res.status(201).json(mapTenantRow(result.rows[0]));
      }
      const newProduct = await storage.createProduct(validatedData);

      res.status(201).json(newProduct);
    } catch (error) {
      console.error('Error creating product:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Error creating product" });
    }
  });

  // Update product (admin and coach only)
  app.patch("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const tenantPool = (req as any).tenantPool;

      // Check if user is admin or coach
      if ((user.role !== 'admin' && user.role !== 'super_admin') && user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied. Admin or coach privileges required." });
      }

      const productId = parseInt(req.params.id);
      if (tenantPool) {
        const existing = await tenantPool.query('SELECT * FROM products WHERE id = $1', [productId]);
        if (!existing.rows[0]) {
          return res.status(404).json({ message: "Product not found" });
        }
      } else {
        const existingProduct = await storage.getProduct(productId);

        if (!existingProduct) {
          return res.status(404).json({ message: "Product not found" });
        }
      }

      // Validate partial update data
      const partialProductSchema = insertProductSchema.partial();
      const validatedData = partialProductSchema.parse(req.body);

      if (tenantPool) {
        const { sets, values } = buildTenantUpdate(validatedData, {
          imageUrl: 'image_url',
          reviewCount: 'review_count',
        });
        if (sets.length === 0) {
          return res.status(400).json({ message: "No fields to update" });
        }
        values.push(productId);
        const result = await tenantPool.query(
          `UPDATE products SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
          values
        );
        return res.json(mapTenantRow(result.rows[0]));
      }

      await storage.updateProduct(productId, validatedData);
      const updatedProduct = await storage.getProduct(productId);

      res.json(updatedProduct);
    } catch (error) {
      console.error('Error updating product:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid product data", errors: error.errors });
      }
      res.status(500).json({ message: "Error updating product" });
    }
  });

  // Delete product (admin and coach only)
  app.delete("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const tenantPool = (req as any).tenantPool;

      // Check if user is admin or coach
      if ((user.role !== 'admin' && user.role !== 'super_admin') && user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied. Admin or coach privileges required." });
      }

      const productId = parseInt(req.params.id);
      if (tenantPool) {
        const existing = await tenantPool.query('SELECT * FROM products WHERE id = $1', [productId]);
        if (!existing.rows[0]) {
          return res.status(404).json({ message: "Product not found" });
        }
        await tenantPool.query('DELETE FROM products WHERE id = $1', [productId]);
        return res.status(204).send();
      }

      const existingProduct = await storage.getProduct(productId);

      if (!existingProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      await storage.deleteProduct(productId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: "Error deleting product" });
    }
  });

  // Cart routes
  app.get("/api/cart", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const tenantPool = (req as any).tenantPool;

      if (tenantPool) {
        const items = await fetchTenantCartItemsWithProducts(tenantPool, userId);
        return res.json(buildCartResponse(items as CartItemWithProduct[]));
      }

      const items = await storage.getCartItems(userId);
      res.json(buildCartResponse(items));
    } catch (error) {
      console.error('Error fetching cart:', error);
      res.status(500).json({ message: "Error fetching cart" });
    }
  });

  app.post("/api/cart", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const tenantPool = (req as any).tenantPool;
      const payload = cartItemPayloadSchema.parse(req.body ?? {});
      const product = tenantPool
        ? await tenantPool.query('SELECT * FROM products WHERE id = $1', [payload.productId]).then((result) => result.rows[0] ? mapTenantStoreRow(result.rows[0]) : null)
        : await storage.getProduct(payload.productId);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (product.stock === 0) {
        return res.status(400).json({ message: `${product.name} is out of stock` });
      }

      const existing = tenantPool
        ? await tenantPool.query('SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, payload.productId]).then((result) => result.rows[0] ? mapTenantStoreRow(result.rows[0]) : null)
        : await storage.getCartItem(userId, payload.productId);
      const desiredQuantity = ((existing as any)?.quantity ?? 0) + payload.quantity;

      if (desiredQuantity > product.stock) {
        return res.status(400).json({
          message: `Only ${product.stock} units of ${product.name} are available`,
        });
      }

      if (tenantPool) {
        await tenantPool.query(
          `INSERT INTO cart_items (user_id, product_id, quantity)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, product_id)
           DO UPDATE SET quantity = $3, updated_at = NOW()`,
          [userId, payload.productId, desiredQuantity]
        );
        const items = await fetchTenantCartItemsWithProducts(tenantPool, userId);
        return res.status(existing ? 200 : 201).json(buildCartResponse(items as CartItemWithProduct[]));
      }

      await storage.upsertCartItem(userId, payload.productId, desiredQuantity);
      const items = await storage.getCartItems(userId);
      res.status(existing ? 200 : 201).json(buildCartResponse(items));
    } catch (error) {
      console.error('Error adding to cart:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid cart payload", issues: error.issues });
      }
      res.status(500).json({ message: "Error updating cart" });
    }
  });

  app.patch("/api/cart/:productId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const tenantPool = (req as any).tenantPool;
      const productId = parseInt(req.params.productId, 10);
      if (Number.isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const payload = updateCartQuantitySchema.parse(req.body ?? {});
      const existing = tenantPool
        ? await tenantPool.query('SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, productId]).then((result) => result.rows[0] ? mapTenantStoreRow(result.rows[0]) : null)
        : await storage.getCartItem(userId, productId);

      if (!existing) {
        return res.status(404).json({ message: "Cart item not found" });
      }

      if (payload.quantity === 0) {
        if (tenantPool) {
          await tenantPool.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);
        } else {
          await storage.removeCartItem(userId, productId);
        }
      } else {
        const product = tenantPool
          ? await tenantPool.query('SELECT * FROM products WHERE id = $1', [productId]).then((result) => result.rows[0] ? mapTenantStoreRow(result.rows[0]) : null)
          : await storage.getProduct(productId);
        if (!product) {
          if (tenantPool) {
            await tenantPool.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);
          } else {
            await storage.removeCartItem(userId, productId);
          }
          return res.status(404).json({ message: "Product not found" });
        }
        if (product.stock < payload.quantity) {
          return res.status(400).json({
            message: `Only ${product.stock} units of ${product.name} are available`,
          });
        }
        if (tenantPool) {
          await tenantPool.query(
            `INSERT INTO cart_items (user_id, product_id, quantity)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, product_id)
             DO UPDATE SET quantity = $3, updated_at = NOW()`,
            [userId, productId, payload.quantity]
          );
        } else {
          await storage.upsertCartItem(userId, productId, payload.quantity);
        }
      }

      if (tenantPool) {
        const items = await fetchTenantCartItemsWithProducts(tenantPool, userId);
        return res.json(buildCartResponse(items as CartItemWithProduct[]));
      }

      const items = await storage.getCartItems(userId);
      res.json(buildCartResponse(items));
    } catch (error) {
      console.error('Error updating cart item:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid cart payload", issues: error.issues });
      }
      res.status(500).json({ message: "Error updating cart item" });
    }
  });

  app.delete("/api/cart/:productId", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const tenantPool = (req as any).tenantPool;
      const productId = parseInt(req.params.productId, 10);
      if (Number.isNaN(productId)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      if (tenantPool) {
        await tenantPool.query('DELETE FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, productId]);
        const items = await fetchTenantCartItemsWithProducts(tenantPool, userId);
        return res.json(buildCartResponse(items as CartItemWithProduct[]));
      }

      await storage.removeCartItem(userId, productId);
      const items = await storage.getCartItems(userId);
      res.json(buildCartResponse(items));
    } catch (error) {
      console.error('Error removing cart item:', error);
      res.status(500).json({ message: "Error removing cart item" });
    }
  });

  app.delete("/api/cart", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const tenantPool = (req as any).tenantPool;

      if (tenantPool) {
        await tenantPool.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
        return res.json(buildCartResponse());
      }

      await storage.clearCart(userId);
      res.json(buildCartResponse());
    } catch (error) {
      console.error('Error clearing cart:', error);
      res.status(500).json({ message: "Error clearing cart" });
    }
  });

  app.post("/api/cart/checkout", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const tenantPool = (req as any).tenantPool;
      const payload = cartCheckoutSchema.parse(req.body ?? {});
      const paymentProvider = payload.paymentProvider || 'stripe';
      const cartItems = tenantPool
        ? await fetchTenantCartItemsWithProducts(tenantPool, userId)
        : await storage.getCartItems(userId);

      if (cartItems.length === 0) {
        return res.status(400).json({ message: "Your cart is empty" });
      }

      const orderInput = cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      if (payload.paymentMethod !== 'card') {
        return res.status(400).json({ message: 'Card payment is required for checkout.' });
      }

      const { total, orderItems } = await prepareOrderFromItems(orderInput, tenantPool);
      const currency = process.env.STORE_CURRENCY || "EGP";

      const orderData: InsertOrder = {
        userId,
        status: 'pending',
        total,
        currency,
        paymentMethod: 'card',
        paymentStatus: 'pending',
        shippingAddress: payload.shippingAddress,
        shippingCity: payload.shippingCity,
        shippingCountry: payload.shippingCountry,
        shippingPhone: payload.shippingPhone,
        notes: payload.notes ?? null,
      };

      let orderId: number;
      if (tenantPool) {
        const orderResult = await tenantPool.query(
          `INSERT INTO orders (user_id, status, total, currency, payment_method, payment_status, shipping_address, shipping_city, shipping_country, shipping_phone, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            orderData.userId,
            orderData.status,
            orderData.total,
            orderData.currency,
            orderData.paymentMethod,
            orderData.paymentStatus,
            orderData.shippingAddress,
            orderData.shippingCity,
            orderData.shippingCountry,
            orderData.shippingPhone,
            orderData.notes,
          ]
        );
        const order = mapTenantStoreRow(orderResult.rows[0]);
        orderId = order.id;

        const values: any[] = [];
        const placeholders: string[] = [];
        orderItems.forEach((item, index) => {
          const base = index * 7;
          placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
          values.push(
            orderId,
            item.productId,
            item.productName,
            item.productPrice,
            item.productImageUrl,
            item.quantity,
            item.subtotal,
          );
        });
        await tenantPool.query(
          `INSERT INTO order_items (order_id, product_id, product_name, product_price, product_image_url, quantity, subtotal)
           VALUES ${placeholders.join(', ')}`,
          values
        );

      } else {
        const order = await storage.createOrder(orderData, orderItems);
        orderId = order.id;
      }

      const user = req.user as any;
      const tenant = (req as any).tenant as { id?: string; subdomain?: string; company_name?: string } | undefined;
      const requestMetadata = buildRequestMetadata(req);
      const totalCents = Math.round(total * 100);
      const itemsSummary = orderItems.map((item) => ({
        product_id: item.productId,
        product_name: item.productName,
        product_price: item.productPrice,
        quantity: item.quantity,
        subtotal: item.subtotal,
      }));

      const userMetadata = {
        customer_user_id: user.id,
        customer_email: user.email,
        customer_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
        customer_username: user.username,
        customer_role: user.role,
      };

      const platformMetadata = {
        payment_context: tenantPool ? 'tenant_store' : 'platform_store',
        payment_type: 'store_order',
        platform_host: req.headers.host,
        platform_domain: process.env.MAIN_DOMAIN,
        tenant_id: tenant?.id,
        tenant_subdomain: tenant?.subdomain,
        tenant_company_name: tenant?.company_name,
      };

      const orderMetadata = {
        order_id: orderId,
        order_total: total,
        order_currency: currency,
        order_item_count: orderItems.length,
        order_item_total_cents: totalCents,
        payment_provider: paymentProvider,
        shipping_address: payload.shippingAddress,
        shipping_city: payload.shippingCity,
        shipping_country: payload.shippingCountry,
        shipping_phone: payload.shippingPhone,
        order_notes: payload.notes ?? undefined,
        order_items: itemsSummary,
      };

      const stripeMetadata = mergeStripeMetadata(requestMetadata, userMetadata, platformMetadata, orderMetadata);

      const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https';
      const baseUrl = `${proto}://${req.headers.host}`;
      const successUrl = `${baseUrl}/orders?payment=success&order=${orderId}`;
      const cancelUrl = `${baseUrl}/cart?payment=cancelled&order=${orderId}`;

      const stripeItems = orderItems.map((item) => ({
        name: item.productName,
        amount: Math.max(0, Math.round(item.productPrice * 100)),
        quantity: item.quantity,
      }));

      const paypalCountryCode = payload.shippingCountry.trim().toUpperCase();
      const paypalCountry = paypalCountryCode.length === 2
        ? paypalCountryCode
        : paypalCountryCode.slice(0, 2);

      let sessionId: string;
      let checkoutUrl: string | null;
      let clientSecret: string | null;

      if (paymentProvider === 'stripe') {
        const session = tenantPool
          ? await createTenantCheckoutSession(tenantPool, {
              items: stripeItems,
              currency,
              successUrl,
              cancelUrl,
              returnUrl: successUrl,
              customerEmail: user.email,
              metadata: stripeMetadata,
              uiMode: 'embedded',
            })
          : await createPlatformCheckoutSession({
              items: stripeItems,
              currency,
              paymentType: 'store_order',
              successUrl,
              cancelUrl,
              returnUrl: successUrl,
              customerEmail: user.email,
              metadata: stripeMetadata,
              uiMode: 'embedded',
            });

        sessionId = session.sessionId;
        checkoutUrl = session.checkoutUrl;
        clientSecret = session.clientSecret;

        if (tenantPool) {
          await logTenantTransaction(tenantPool, {
            stripePaymentId: session.sessionId,
            stripeCheckoutSessionId: session.sessionId,
            customerUserId: user.id,
            orderId,
            amount: total,
            currency,
            status: 'pending',
            paymentType: 'store_order',
            metadata: stripeMetadata,
          });
        } else {
          await logPlatformTransaction({
            stripePaymentId: session.sessionId,
            stripeCheckoutSessionId: session.sessionId,
            tenantId: tenant?.id ?? null,
            amount: total,
            currency,
            status: 'pending',
            paymentType: 'store_order',
            metadata: stripeMetadata,
          });
        }
      } else if (paymentProvider === 'paypal') {
        const paypalItems = orderItems.map((item) => ({
          name: item.productName,
          unitAmount: formatPayPalAmount(Math.max(0, item.productPrice)),
          quantity: item.quantity,
        }));

        const paypalOrder = tenantPool
          ? await createTenantPayPalOrder(tenantPool, {
              amount: formatPayPalAmount(total),
              currency,
              customId: `order:${orderId}:${user.id}`,
              description: `Order #${orderId}`,
              items: paypalItems,
              shippingPreference: 'SET_PROVIDED_ADDRESS',
              shipping: {
                fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
                address: {
                  addressLine1: payload.shippingAddress,
                  adminArea2: payload.shippingCity,
                  countryCode: paypalCountry,
                },
              },
            })
          : await createPlatformPayPalOrder({
              amount: formatPayPalAmount(total),
              currency,
              customId: `order:${orderId}:${user.id}`,
              description: `Order #${orderId}`,
              items: paypalItems,
              shippingPreference: 'SET_PROVIDED_ADDRESS',
              shipping: {
                fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined,
                address: {
                  addressLine1: payload.shippingAddress,
                  adminArea2: payload.shippingCity,
                  countryCode: paypalCountry,
                },
              },
            });

        sessionId = paypalOrder.id;
        checkoutUrl = paypalOrder.links?.find((link: any) => link.rel === 'approve')?.href || null;
        clientSecret = null;

        if (tenantPool) {
          await logTenantTransaction(tenantPool, {
            stripePaymentId: sessionId,
            stripeCheckoutSessionId: sessionId,
            customerUserId: user.id,
            orderId,
            amount: total,
            currency,
            status: 'pending',
            paymentType: 'store_order',
            paymentProvider: 'paypal',
            paypalOrderId: sessionId,
            metadata: stripeMetadata,
          });
        } else {
          await logPlatformTransaction({
            stripePaymentId: sessionId,
            stripeCheckoutSessionId: sessionId,
            tenantId: tenant?.id ?? null,
            amount: total,
            currency,
            status: 'pending',
            paymentType: 'store_order',
            paymentProvider: 'paypal',
            paypalOrderId: sessionId,
            metadata: stripeMetadata,
          });
        }
      } else if (paymentProvider === 'paymob') {
        const paymobKeys = tenantPool ? await getTenantPaymobKeys(tenantPool) : await getPlatformPaymobKeys();
        const intention = tenantPool
          ? await createTenantPaymobIntention(tenantPool, {
              amount: totalCents,
              currency,
              paymentMethods: paymobKeys.integrationIds,
              items: orderItems.map((item) => ({
                name: item.productName,
                amount: Math.max(0, Math.round(item.productPrice * 100)),
                quantity: item.quantity,
              })),
              billingData: {
                first_name: user.firstName || '',
                last_name: user.lastName || '',
                email: user.email || undefined,
                phone_number: payload.shippingPhone || user.phone || user.phoneNumber || user.mobile || undefined,
                street: payload.shippingAddress,
                city: payload.shippingCity,
                country: payload.shippingCountry,
              },
              metadata: stripeMetadata,
              successUrl,
              failureUrl: cancelUrl,
              callbackUrl: `${baseUrl}${tenantPool ? '/api/paymob/webhook' : '/api/admin/paymob/webhook'}`,
            })
          : await createPlatformPaymobIntention({
              amount: totalCents,
              currency,
              paymentMethods: paymobKeys.integrationIds,
              items: orderItems.map((item) => ({
                name: item.productName,
                amount: Math.max(0, Math.round(item.productPrice * 100)),
                quantity: item.quantity,
              })),
              billingData: {
                first_name: user.firstName || '',
                last_name: user.lastName || '',
                email: user.email || undefined,
                phone_number: payload.shippingPhone || user.phone || user.phoneNumber || user.mobile || undefined,
                street: payload.shippingAddress,
                city: payload.shippingCity,
                country: payload.shippingCountry,
              },
              metadata: stripeMetadata,
              successUrl,
              failureUrl: cancelUrl,
              callbackUrl: `${baseUrl}/api/admin/paymob/webhook`,
            });

        sessionId = intention.id || `paymob-${Date.now()}`;
        checkoutUrl = intention.paymentUrl;
        clientSecret = intention.clientSecret;

        if (tenantPool) {
          await logTenantTransaction(tenantPool, {
            stripePaymentId: sessionId,
            stripeCheckoutSessionId: sessionId,
            customerUserId: user.id,
            orderId,
            amount: total,
            currency,
            status: 'pending',
            paymentType: 'store_order',
            paymentProvider: 'paymob',
            paymobIntentionId: intention.id || sessionId,
            metadata: stripeMetadata,
          });
        } else {
          await logPlatformTransaction({
            stripePaymentId: sessionId,
            stripeCheckoutSessionId: sessionId,
            tenantId: tenant?.id ?? null,
            amount: total,
            currency,
            status: 'pending',
            paymentType: 'store_order',
            paymentProvider: 'paymob',
            paymobIntentionId: intention.id || sessionId,
            metadata: stripeMetadata,
          });
        }
      }

      if (tenantPool) {
        await tenantPool.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
      } else {
        await storage.clearCart(userId);
      }

      res.status(201).json({
        orderId,
        sessionId,
        checkoutUrl,
        clientSecret,
        paymentProvider,
      });
    } catch (error) {
      console.error('Error during cart checkout:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid checkout data", issues: error.issues });
      }
      if ((error as Error)?.message === 'PLATFORM_PAYMENT_NOT_CONFIGURED') {
        return res.status(503).json({
          message: 'Payment gateway not configured. Please contact administrator.',
          code: 'PLATFORM_PAYMENT_NOT_CONFIGURED',
        });
      }
      if ((error as HttpError)?.status) {
        return res.status((error as HttpError).status as number).json({ message: (error as Error).message });
      }
      res.status(500).json({ message: "Error completing checkout" });
    }
  });

  // Orders routes
  // Get all orders for authenticated user
  app.get("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);

      if (tenantPool) {
        const orders = await fetchTenantOrdersWithItems(tenantPool, 'WHERE user_id = $1', [userId]);
        return res.json(orders);
      }

      const orders = await storage.getOrdersByUserId(userId);
      res.json(orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({ message: "Error fetching orders" });
    }
  });

  // Get single order with items
  app.get("/api/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      const orderId = parseInt(req.params.id);
      const order = tenantPool
        ? (await fetchTenantOrdersWithItems(tenantPool, 'WHERE id = $1', [orderId]))[0]
        : await storage.getOrderWithItems(orderId);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Verify user owns this order
      if (order.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(order);
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({ message: "Error fetching order" });
    }
  });

  // Create new order
  app.post("/api/orders", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const tenantPool = (req as any).tenantPool;
      const payload = directOrderSchema.parse(req.body ?? {});
      const { total, orderItems } = await prepareOrderFromItems(payload.items, tenantPool);
      const currency = process.env.STORE_CURRENCY || "EGP";
      const paymentMethod = payload.paymentMethod ?? "card";
      const orderData: InsertOrder = {
        userId,
        status: 'pending',
        total,
        currency,
        paymentMethod,
        paymentStatus: payload.paymentStatus ?? (paymentMethod === 'cod' ? 'pending' : 'pending'),
        shippingAddress: payload.shippingAddress || null,
        shippingCity: payload.shippingCity || null,
        shippingCountry: payload.shippingCountry || null,
        shippingPhone: payload.shippingPhone || null,
        notes: payload.notes || null,
      };

      if (tenantPool) {
        const orderResult = await tenantPool.query(
          `INSERT INTO orders (user_id, status, total, currency, payment_method, payment_status, shipping_address, shipping_city, shipping_country, shipping_phone, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING *`,
          [
            orderData.userId,
            orderData.status,
            orderData.total,
            orderData.currency,
            orderData.paymentMethod,
            orderData.paymentStatus,
            orderData.shippingAddress,
            orderData.shippingCity,
            orderData.shippingCountry,
            orderData.shippingPhone,
            orderData.notes,
          ]
        );
        const order = mapTenantStoreRow(orderResult.rows[0]);

        const values: any[] = [];
        const placeholders: string[] = [];
        orderItems.forEach((item, index) => {
          const base = index * 7;
          placeholders.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
          values.push(
            order.id,
            item.productId,
            item.productName,
            item.productPrice,
            item.productImageUrl,
            item.quantity,
            item.subtotal,
          );
        });
        await tenantPool.query(
          `INSERT INTO order_items (order_id, product_id, product_name, product_price, product_image_url, quantity, subtotal)
           VALUES ${placeholders.join(', ')}`,
          values
        );

        const fullOrder = await fetchTenantOrdersWithItems(tenantPool, 'WHERE id = $1', [order.id]);
        return res.status(201).json(fullOrder[0]);
      }

      const order = await storage.createOrder(orderData, orderItems);
      const fullOrder = await storage.getOrderWithItems(order.id);

      res.status(201).json(fullOrder);
    } catch (error) {
      console.error('Error creating order:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid order data", errors: error.errors });
      }
      if ((error as HttpError)?.status) {
        return res.status((error as HttpError).status as number).json({ message: (error as Error).message });
      }
      res.status(500).json({ message: "Error creating order" });
    }
  });

  // Update order status (admin/coach only for most statuses)
  app.patch("/api/orders/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const userRole = (req.user as any).role;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      const orderId = parseInt(req.params.id);
      const { status } = req.body;

      const order = tenantPool
        ? await tenantPool.query('SELECT * FROM orders WHERE id = $1', [orderId]).then((result) => result.rows[0] ? mapTenantStoreRow(result.rows[0]) : null)
        : await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Users can only cancel their own pending orders
      if (userRole === 'user') {
        if (order.userId !== userId) {
          return res.status(403).json({ message: "Access denied" });
        }
        if (status !== 'cancelled' || order.status !== 'pending') {
          return res.status(403).json({ message: "You can only cancel pending orders" });
        }
      }

      // Admin/coach can update to any status
      const updateData: Partial<Order> = { status };
      if (status === 'delivered' || status === 'cancelled') {
        updateData.completedAt = new Date();
      }

      if (tenantPool) {
        const completedAt = updateData.completedAt ?? null;
        const result = await tenantPool.query(
          'UPDATE orders SET status = $1, completed_at = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
          [updateData.status, completedAt, orderId]
        );
        const updatedOrder = await fetchTenantOrdersWithItems(tenantPool, 'WHERE id = $1', [orderId]);
        return res.json(updatedOrder[0] ?? mapTenantStoreRow(result.rows[0]));
      }

      await storage.updateOrder(orderId, updateData);
      const updatedOrder = await storage.getOrderWithItems(orderId);

      res.json(updatedOrder);
    } catch (error) {
      console.error('Error updating order:', error);
      res.status(500).json({ message: "Error updating order" });
    }
  });

  // Admin endpoint to get all orders
  app.get("/api/admin/orders", isAuthenticated, async (req, res) => {
    try {
      const userRole = (req.user as any).role;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      
      if ((userRole !== 'admin' && userRole !== 'super_admin') && userRole !== 'coach') {
        return res.status(403).json({ message: "Admin or coach access required" });
      }

      if (tenantPool) {
        const orders = await fetchTenantOrdersWithItems(tenantPool, '', []);
        return res.json(orders);
      }

      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error('Error fetching all orders:', error);
      res.status(500).json({ message: "Error fetching orders" });
    }
  });

  // Messages routes
  app.get("/api/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const otherUserId = req.query.userId as string;

      if (otherUserId) {
        const messages = await storage.getMessagesBetweenUsers(userId, parseInt(otherUserId));
        return res.json(messages);
      }

      const messages = await storage.getUserMessages(userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Error fetching messages" });
    }
  });

  // Admin endpoint to get all conversations grouped by users
  app.get("/api/admin/conversations", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);

      // Check if user is admin or coach
      if ((user.role !== 'admin' && user.role !== 'super_admin') && user.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get all users and group conversations
      const users = await storage.getAllUsers();
      const conversations = new Map();

      for (const dbUser of users) {
        // Skip admin users for conversations
        if (dbUser.role === 'admin') continue;

        const userMessages = await storage.getUserMessages(dbUser.id);
        if (userMessages.length > 0) {
          const messagesWithDetails = [];

          for (const message of userMessages) {
            const sender = await storage.getUser(message.senderId);
            const receiver = await storage.getUser(message.receiverId);

            messagesWithDetails.push({
              ...message,
              senderName: sender ? `${sender.firstName} ${sender.lastName}` : 'Unknown',
              receiverName: receiver ? `${receiver.firstName} ${receiver.lastName}` : 'Unknown',
              senderRole: sender?.role || 'user',
              receiverRole: receiver?.role || 'user'
            });
          }

          // Sort messages by date (oldest first for conversation flow)
          messagesWithDetails.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

          const lastMessage = messagesWithDetails[messagesWithDetails.length - 1];
          const unreadCount = messagesWithDetails.filter(m => !m.read && m.receiverId === user.id).length;

          conversations.set(dbUser.id, {
            userId: dbUser.id,
            userName: `${dbUser.firstName} ${dbUser.lastName}`,
            userRole: dbUser.role,
            messages: messagesWithDetails,
            lastMessage: lastMessage,
            unreadCount: unreadCount,
            lastMessageTime: lastMessage.sentAt
          });
        }
      }

      // Convert to array and sort by unread messages first, then by most recent activity
      const conversationArray = Array.from(conversations.values())
        .sort((a, b) => {
          // First priority: unread messages (unread conversations at top)
          if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
          if (a.unreadCount === 0 && b.unreadCount > 0) return 1;

          // Second priority: most recent activity
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        });

      res.json(conversationArray);
    } catch (error) {
      console.error('Error fetching admin conversations:', error);
      res.status(500).json({ message: "Error fetching conversations" });
    }
  });

  // Admin endpoint to get messages for a specific user conversation
  app.get("/api/admin/conversations/:userId", isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const targetUserId = parseInt(req.params.userId);

      // Check if user is admin or coach
      if ((user.role !== 'admin' && user.role !== 'super_admin') && user.role !== 'coach') {
        return res.status(403).json({ message: "Admin or coach privileges required" });
      }

      const messages = await storage.getMessagesBetweenUsers(user.id, targetUserId);
      const messagesWithDetails = [];

      for (const message of messages) {
        const sender = await storage.getUser(message.senderId);
        const receiver = await storage.getUser(message.receiverId);

        messagesWithDetails.push({
          ...message,
          senderName: sender ? `${sender.firstName} ${sender.lastName}` : 'Unknown',
          receiverName: receiver ? `${receiver.firstName} ${receiver.lastName}` : 'Unknown',
          senderRole: sender?.role || 'user',
          receiverRole: receiver?.role || 'user'
        });
      }

      // Sort by date (oldest first for conversation flow)
      messagesWithDetails.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

      res.json(messagesWithDetails);
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ message: "Error fetching conversation" });
    }
  });

  app.post("/api/messages", isAuthenticated, async (req, res) => {
    try {
      const sender = (req.user as any);
      const senderId = sender.id;
      const receiverId = req.body.receiverId;

      // Get receiver information to validate messaging rules
      const receiver = await storage.getUser(receiverId);
      if (!receiver) {
        return res.status(404).json({ message: "Receiver not found" });
      }

      // Messaging restrictions:
      // - Regular users can only message coaches
      // - Coaches can message anyone
      // - Admins can message anyone
      if (sender.role === 'user' && receiver.role !== 'coach') {
        return res.status(403).json({ 
          message: "You can only send messages to coaches" 
        });
      }

      const parsedData = insertMessageSchema.parse({
        ...req.body,
        senderId
      });

      const message = await storage.createMessage(parsedData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Error sending message" });
    }
  });

  app.patch("/api/messages/:id/read", isAuthenticated, async (req, res) => {
    try {
      const messageId = parseInt(req.params.id);
      const message = await storage.getMessage(messageId);

      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      // Check if the message is for the current user
      if (message.receiverId !== (req.user as any).id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updatedMessage = await storage.markMessageAsRead(messageId);
      if (updatedMessage) {
        res.json(updatedMessage);
      } else {
        res.status(500).json({ message: "Failed to mark message as read" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error updating message" });
    }
  });

  // Workouts routes
  app.get("/api/workouts", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const coachId = req.query.coachId as string;

      if (coachId) {
        const workouts = await storage.getWorkoutsByCoachId(parseInt(coachId));
        return res.json(workouts);
      }

      // If user is a coach or admin, return their workouts or all workouts
      if (currentUser.role === "coach") {
        const workouts = await storage.getWorkoutsByCoachId(currentUser.id);
        return res.json(workouts);
      }

      // If user is admin, return all workouts
      if ((currentUser.role === "admin" || currentUser.role === "super_admin")) {
        const workouts = await storage.getAllWorkouts();
        return res.json(workouts);
      }

      // For regular users, return all workouts from their coach
      if (currentUser.coachId) {
        const workouts = await storage.getWorkoutsByCoachId(currentUser.coachId);
        return res.json(workouts);
      }

      // If no coach assigned, return empty array
      res.json([]);
    } catch (error) {
      res.status(500).json({ message: "Error fetching workouts" });
    }
  });

  app.post("/api/workouts", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Only coaches can create workouts
      if (currentUser.role !== "coach") {
        return res.status(403).json({ message: "Only coaches can create workouts" });
      }

      const parsedData = insertWorkoutSchema.parse({
        ...req.body,
        coachId: currentUser.id
      });

      const workout = await storage.createWorkout(parsedData);
      res.status(201).json(workout);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Error creating workout" });
    }
  });

  app.get("/api/workouts/:id", isAuthenticated, async (req, res) => {
    try {
      const workoutId = parseInt(req.params.id);
      const workout = await storage.getWorkout(workoutId);

      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }

      res.json(workout);
    } catch (error) {
      res.status(500).json({ message: "Error fetching workout" });
    }
  });

  // Custom workouts endpoint for users to create their own workouts
  app.post("/api/custom-workouts", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Users can create custom workouts with their own ID as coachId
      const parsedData = insertWorkoutSchema.parse({
        ...req.body,
        coachId: currentUser.id // Use user's own ID for custom workouts
      });

      const workout = await storage.createWorkout(parsedData);
      res.status(201).json(workout);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Error creating custom workout" });
    }
  });

  // Get custom workouts for the current user
  app.get("/api/custom-workouts", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const workouts = await storage.getWorkoutsByCoachId(currentUser.id);
      res.json(workouts);
    } catch (error) {
      res.status(500).json({ message: "Error fetching custom workouts" });
    }
  });

  // Delete a custom workout
  app.delete("/api/custom-workouts/:id", isAuthenticated, async (req, res) => {
    try {
      const workoutId = parseInt(req.params.id);
      const currentUser = req.user as any;

      const workout = await storage.getWorkout(workoutId);
      if (!workout) {
        return res.status(404).json({ message: "Workout not found" });
      }

      // Check if the workout belongs to the current user (as coach/creator)
      if (workout.coachId !== currentUser.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const deleted = await storage.deleteWorkout(workoutId);
      if (deleted) {
        res.status(204).end();
      } else {
        res.status(500).json({ message: "Failed to delete workout" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error deleting workout" });
    }
  });

  // Quick add workout - Parse plain text and create weekly schedule for a specific user
  app.post("/api/quick-add-workout", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Only coaches and admins can quick add workouts
      if (currentUser.role !== "coach" && (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
        return res.status(403).json({ message: "Only coaches can quick add workouts" });
      }

      const { userId, workoutText, title, description, focus } = req.body;

      if (!userId || !workoutText) {
        return res.status(400).json({ message: "userId and workoutText are required" });
      }

      // Import WorkoutParser from shared
      const { WorkoutParser } = await import("@shared/workoutParser");

      // Parse the plain text into a weekly schedule
      let weeklySchedule = WorkoutParser.parseWeeklySchedule(workoutText, {
        focus: focus || "Quick add weekly workout"
      });

      // Fallback: if parser found no structured workouts, treat each non-empty
      // line as a plain exercise entry under a single day so coaches can paste
      // freeform workout descriptions without following the strict format.
      if (!weeklySchedule.workouts || weeklySchedule.workouts.length === 0) {
        const rawLines: string[] = workoutText
          .trim()
          .split('\n')
          .map((l: string) => l.trim())
          .filter((l: string) => l.length > 0);

        if (rawLines.length === 0) {
          return res.status(400).json({ message: "Workout text is empty" });
        }

        weeklySchedule = {
          focus: focus || "Custom workout schedule",
          workouts: [{
            day: title || "Day 1",
            type: "Full Body",
            duration: `${Math.ceil(rawLines.length * 4)} min`,
            exercises: rawLines,
            notes: ""
          }]
        };
      }

      // Calculate workout days from the parsed schedule
      const workoutDays = weeklySchedule.workouts.length;
      const avgDuration = weeklySchedule.workouts.length > 0 
        ? weeklySchedule.workouts[0].duration 
        : "45 minutes";

      // Create or update user plan with the weekly schedule
      const userPlanData = insertUserPlanSchema.parse({
        userId: parseInt(userId),
        coachId: currentUser.id,
        title: title || `Quick Add Workout - ${new Date().toLocaleDateString()}`,
        description: description || `Weekly workout plan with ${workoutDays} days`,
        weeklyFocus: weeklySchedule.focus,
        goals: {
          workoutDays,
          workoutDuration: avgDuration,
          exercises: [],
          workoutTips: []
        },
        weeklySchedule
      });

      const userPlan = await createUserPlanForRequest(req, userPlanData);

      res.status(201).json({
        userPlan,
        message: "Weekly workout schedule created successfully"
      });
    } catch (error) {
      console.error("Error in quick-add-workout:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Error creating quick add workout" });
    }
  });

  // YouTube video search endpoint
  app.get("/api/youtube/search", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      
      if (!query) {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }

      const axios = await import('axios');
      
      // Search YouTube using the oEmbed endpoint and scraping approach
      // Since we don't have YouTube API key, we'll use a workaround with YouTube search URL
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAM%253D`;
      
      try {
        const response = await axios.default.get(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });

        const html = response.data;
        
        // Extract video data from the initial data in the page
        const match = html.match(/var ytInitialData = ({.+?});/);
        if (match && match[1]) {
          const data = JSON.parse(match[1]);
          
          // Navigate through the YouTube data structure to find videos
          const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
          
          if (contents && contents.length > 0) {
            const itemSection = contents[0]?.itemSectionRenderer?.contents;
            
            if (itemSection) {
              // Find the first video renderer (skip ads and other content)
              for (const item of itemSection) {
                if (item.videoRenderer) {
                  const video = item.videoRenderer;
                  const videoId = video.videoId;
                  const title = video.title?.runs?.[0]?.text || '';
                  const viewCount = video.viewCountText?.simpleText || '';
                  
                  return res.json({
                    videoId,
                    title,
                    viewCount,
                    embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0&sp=CAM%253D`
                  });
                }
              }
            }
          }
        }
        
        // Fallback: return a search URL if we can't parse the video
        return res.json({
          videoId: null,
          title: query,
          viewCount: 'N/A',
          embedUrl: null,
          searchUrl: searchUrl
        });
        
      } catch (error) {
        console.error('Error fetching YouTube data:', error);
        // Return search URL as fallback
        return res.json({
          videoId: null,
          title: query,
          viewCount: 'N/A',
          embedUrl: null,
          searchUrl: searchUrl
        });
      }
      
    } catch (error) {
      console.error('YouTube search error:', error);
      res.status(500).json({ message: "Error searching YouTube" });
    }
  });

  // User Workouts (scheduled workouts) routes
  app.get("/api/user-workouts", isAuthenticated, async (req, res) => {
    try {
      const currentUser = (req.user as any);
      const userIdParam = req.query.userId as string;
      const dateParam = req.query.date as string;

      // Allow admins to query other users' workouts
      const targetUserId = userIdParam && (currentUser.role === 'admin' || currentUser.role === 'super_admin') 
        ? parseInt(userIdParam) 
        : currentUser.id;

      if (dateParam) {
        const date = new Date(dateParam);
        if (isNaN(date.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }

        const userWorkouts = await getUserWorkoutsByDateForRequest(req, targetUserId, date);
        return res.json(userWorkouts);
      }

      const userWorkouts = await getUserWorkoutsByUserIdForRequest(req, targetUserId);
      res.json(userWorkouts);
    } catch (error) {
      res.status(500).json({ message: "Error fetching scheduled workouts" });
    }
  });

  app.post("/api/user-workouts", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const parsedData = insertUserWorkoutSchema.parse({
        ...req.body,
        userId
      });

      const userWorkout = await createUserWorkoutForRequest(req, parsedData);
      res.status(201).json(userWorkout);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Error scheduling workout" });
    }
  });

  app.patch("/api/user-workouts/:id/complete", isAuthenticated, async (req, res) => {
    try {
      const userWorkoutId = parseInt(req.params.id);
      const userWorkout = await getUserWorkoutForRequest(req, userWorkoutId);

      if (!userWorkout) {
        return res.status(404).json({ message: "Scheduled workout not found" });
      }

      // Check if the workout belongs to the current user
      if (userWorkout.userId !== (req.user as any).id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const completedAt = req.body.completedAt ? new Date(req.body.completedAt) : new Date();

      const updatedUserWorkout = await markUserWorkoutCompleteForRequest(req, userWorkoutId, completedAt);
      if (updatedUserWorkout) {
        res.json(updatedUserWorkout);
      } else {
        res.status(500).json({ message: "Failed to mark workout as complete" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error updating workout" });
    }
  });

  app.delete("/api/user-workouts/:id", isAuthenticated, async (req, res) => {
    try {
      const userWorkoutId = parseInt(req.params.id);
      const uw = await getUserWorkoutForRequest(req, userWorkoutId);
      if (!uw) return res.status(404).json({ message: "Scheduled workout not found" });
      const currentUser = req.user as any;
      if (uw.userId !== currentUser.id && (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const ok = await deleteUserWorkoutForRequest(req, userWorkoutId);
      if (ok) return res.status(204).end();
      return res.status(500).json({ message: "Failed to delete scheduled workout" });
    } catch (error) {
      console.error('Error deleting scheduled workout:', error);
      return res.status(500).json({ message: "Error deleting scheduled workout" });
    }
  });

  // User Plans routes
  app.get("/api/user-plans", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const latestOnly = req.query.latest === "true";

      if (latestOnly) {
        const plan = await getLatestUserPlanForRequest(req, userId);
        console.log(`Latest plan for user ${userId}:`, plan?.id, plan?.title, plan?.weeklySchedule ? 'HAS weekly schedule' : 'NO weekly schedule');

        // Disable caching for latest plan requests to ensure fresh data
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        if (plan) {
          // Ensure JSON fields are properly parsed
          const parsedPlan = {
            ...plan,
            goals: safeParseJSON(plan.goals),
            weeklySchedule: safeParseJSON(plan.weeklySchedule),
          };
          return res.json(parsedPlan);
        }

        return res.json(null);
      }

      // Disable caching to avoid stale plan lists after changes
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const plans = await getUserPlansByUserIdForRequest(req, userId);
      // Ensure JSON fields are properly parsed
      const parsedPlans = plans.map(plan => ({
        ...plan,
        goals: safeParseJSON(plan.goals),
        weeklySchedule: safeParseJSON(plan.weeklySchedule),
      }));
      res.json(parsedPlans);
    } catch (error) {
      res.status(500).json({ message: "Error fetching user plans" });
    }
  });

  app.post("/api/user-plans", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Only coaches and admins can create plans
      if (currentUser.role !== "coach" && (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
        return res.status(403).json({ message: "Only coaches and admins can create plans" });
      }

      const parsedData = insertUserPlanSchema.parse({
        ...req.body,
        coachId: currentUser.id
      });

      // Check if there's an existing plan for this user by this coach
      // This prevents duplicate entries when manually creating nutrition and workout plans separately
      const existingPlans = await getUserPlansByUserIdForRequest(req, parsedData.userId);
      const existingPlan = existingPlans.find(p => p.coachId === currentUser.id);

      let plan: any;
      
      if (existingPlan) {
        // Merge the new data with existing plan
        const existingGoals = safeParseJSON(existingPlan.goals) || {};
        const existingSchedule = safeParseJSON(existingPlan.weeklySchedule);
        const newGoals = parsedData.goals || {};
        const newSchedule = parsedData.weeklySchedule;

        // Merge goals - new data takes precedence but preserve existing fields
        const mergedGoals = { ...(existingGoals as object), ...(newGoals as object) };
        
        // For weeklySchedule, use new if provided, otherwise keep existing
        const mergedSchedule = newSchedule !== undefined ? newSchedule : existingSchedule;

        // Update the existing plan
        plan = await updateUserPlanForRequest(req, existingPlan.id, {
          title: parsedData.title,
          description: parsedData.description,
          weeklyFocus: parsedData.weeklyFocus,
          goals: mergedGoals,
          weeklySchedule: mergedSchedule,
        });
      } else {
        // No existing plan, create new one
        plan = await createUserPlanForRequest(req, parsedData);
      }
      
      // Update daily stats goals for the user when plan is created/updated
      try {
        await updateUserDailyStatsGoalsForRequest(req, plan.userId, plan);
      } catch (err) {
        console.error('Failed to update daily stats goals:', err);
        // Continue with plan creation even if stats update fails
      }

      // Ensure JSON fields are properly parsed before sending response
      const parsedPlan = {
        ...plan,
        goals: safeParseJSON(plan.goals),
        weeklySchedule: safeParseJSON(plan.weeklySchedule),
      };

      res.status(201).json(parsedPlan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: "Error creating user plan" });
    }
  });

  app.get("/api/user-plans/:userId", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      // Disable caching to avoid stale plan lists after changes
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      const plans = await getUserPlansByUserIdForRequest(req, userId);
      // Ensure JSON fields are properly parsed
      const parsedPlans = plans.map(plan => ({
        ...plan,
        goals: safeParseJSON(plan.goals),
        weeklySchedule: safeParseJSON(plan.weeklySchedule),
      }));
      res.json(parsedPlans);
    } catch (error) {
      res.status(500).json({ message: "Error fetching user plans" });
    }
  });

  app.patch("/api/user-plans/:id", isAuthenticated, async (req, res) => {
    try {
      const planId = parseInt(req.params.id);
      const currentUser = req.user as any;

      console.log(`Updating plan ${planId} for user ${currentUser.id}`);

      const plan = await getUserPlanForRequest(req, planId);
      if (!plan) {
        console.log(`Plan ${planId} not found`);
        return res.status(404).json({ message: "User plan not found" });
      }

      // Only the coach who created the plan or an admin can update it
      if (plan.coachId !== currentUser.id && (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
        console.log(`Access denied for user ${currentUser.id} to update plan ${planId}`);
        return res.status(403).json({ message: "Forbidden" });
      }

      // Merge goals and weeklySchedule to preserve existing data
      const existingGoals = safeParseJSON(plan.goals) || {};
      const existingSchedule = safeParseJSON(plan.weeklySchedule);
      const newGoals = req.body.goals || {};
      const newSchedule = req.body.weeklySchedule;

      // Merge goals - new data takes precedence but preserve existing fields
      const mergedGoals = { ...(existingGoals as object), ...(newGoals as object) };
      
      // For weeklySchedule, use new if provided, otherwise keep existing
      const mergedSchedule = newSchedule !== undefined ? newSchedule : existingSchedule;

      // Create update payload with merged data
      const updatePayload = {
        ...req.body,
        goals: mergedGoals,
        weeklySchedule: mergedSchedule,
      };

      const updatedPlan = await updateUserPlanForRequest(req, planId, updatePayload);
      if (updatedPlan) {
        console.log(`Plan ${planId} updated successfully`);
        
        // Update daily stats goals for the user when plan is updated
        await updateUserDailyStatsGoalsForRequest(req, updatedPlan.userId, updatedPlan);

        // Ensure JSON fields are properly parsed before sending response
        const parsedUpdatedPlan = {
          ...updatedPlan,
          goals: safeParseJSON(updatedPlan.goals),
          weeklySchedule: safeParseJSON(updatedPlan.weeklySchedule),
        };
        
        // Ensure we're sending a proper JSON response
        return res.status(200).json(parsedUpdatedPlan);
      } else {
        console.log(`Failed to update plan ${planId}`);
        return res.status(500).json({ message: "Failed to update user plan" });
      }
    } catch (error) {
      console.error('Error updating user plan:', error);
      return res.status(500).json({ message: "Error updating user plan" });
    }
  });

  app.delete("/api/user-plans/:id", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const planId = parseInt(req.params.id);
      const plan = await getUserPlanForRequest(req, planId);
      if (!plan) return res.status(404).json({ message: "User plan not found" });

      if (plan.coachId !== currentUser.id && (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const ok = await deleteUserPlanForRequest(req, planId);
      if (ok) return res.status(204).end();
      return res.status(500).json({ message: "Failed to delete user plan" });
    } catch (error) {
      console.error('Error deleting user plan:', error);
      return res.status(500).json({ message: "Error deleting user plan" });
    }
  });

  // Coach-scoped endpoints
  // List users assigned to current coach (or by coachId for admin)
  // Minimal assistant URL provider for AI plan generation (no OpenAI call yet)
  app.get("/api/coach/assistant-url", isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const settings = await getAiSettingsForRequest(req);
      const planSettings = settings.plans || {};
      const assistantUrl = planSettings.assistantUrl || (planSettings.assistantId
        ? `https://platform.openai.com/assistants/${encodeURIComponent(planSettings.assistantId)}`
        : null);
      res.json({ assistantUrl });
    } catch (err) {
      res.status(500).json({ assistantUrl: null });
    }
  });

  // AI: Generate plan via OpenAI Assistants API and save it
  app.post("/api/coach/ai/generate-plan", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { userId, planType = 'nutrition' } = req.body || {};
      const aiSettings = await getAiSettingsForRequest(req);
      const planConfig = getAiFeatureConfig(aiSettings, 'plans');
      if (!planConfig) {
        return res.status(400).json(buildAiNotConfiguredResponse('plans'));
      }
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const targetUserId = parseInt(String(userId));
      const usersDb = resolveDb(req);
      const [targetUser] = await usersDb.select().from(users).where(eq(users.id, targetUserId));
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      
      // Allow users to generate plans for themselves, or coaches/admins to generate for their clients
      const isGeneratingForSelf = currentUser.id === targetUserId;
      const isCoachForUser = currentUser.role === 'coach' && targetUser.coachId === currentUser.id;
      const isAdmin = (currentUser.role === 'admin' || currentUser.role === 'super_admin');
      
      if (!isGeneratingForSelf && !isCoachForUser && !isAdmin) {
        return res.status(403).json({ message: "Access denied. You can only generate plans for yourself or your clients." });
      }

      if (currentUser?.role === 'user') {
        const scope = buildScopeFromRequest(req);
        await getOrCreateAccountWithBalance(scope, targetUserId);
        const consumeResult = await consumeCredits(scope, {
          userId: targetUserId,
          actionKey: 'ai_generate_plan',
        });

        if ('insufficient' in consumeResult) {
          const language = getRequestLanguage(req);
          return res.status(402).json({ message: getInsufficientCreditsMessage(language), balance: consumeResult.balance });
        }
      }

      const assistantId = planConfig.assistantId || '';
      const openai = new OpenAI({ apiKey: planConfig.apiKey as string });
      const model = planConfig.model || 'gpt-5-mini-2025-08-07';

      // Build profile from stored fields (nulls allowed)
      const profile = {
        physical: {
          height: targetUser.height ?? null,
          weight: targetUser.weight ?? null,
          age: targetUser.age ?? null,
          gender: targetUser.gender ?? null,
          bodyFatPct: (targetUser as any).bodyFatPct ?? null,
          muscleMass: (targetUser as any).muscleMass ?? null,
        },
        health: {
          medicalHistory: targetUser.medicalHistory ?? null,
          medicalHistoryDetails: targetUser.medicalHistoryDetails ?? null,
          hasAllergies: targetUser.hasAllergies ?? null,
          allergyDetails: targetUser.allergyDetails ?? null,
          injuries: (targetUser as any).injuries ?? null,
        },
        training: {
          frequencyPerWeek: targetUser.trainingDaysPerWeek ?? null,
          experienceLevel: targetUser.trainingLevel ?? null,
          workoutLocation: targetUser.workoutLocation ?? null,
          programPreference: targetUser.preferredProgram ?? null,
        },
        goals: {
          main: targetUser.fitnessGoal ?? null,
        },
        nutrition: {
          dailyMeals: targetUser.dailyMeals ?? null,
          preferredCarbs: targetUser.preferredCarbs ?? null,
          preferredProteins: targetUser.preferredProteins ?? null,
          preferredLegumes: targetUser.preferredLegumes ?? null,
          preferredVegetables: targetUser.preferredVegetables ?? null,
          preferredDairy: targetUser.preferredDairy ?? null,
          preferredFats: targetUser.preferredFats ?? null,
          preferredFruits: targetUser.preferredFruits ?? null,
          dietaryRestrictions: (targetUser as any).dietaryRestrictions ?? null,
          preferredCuisines: (targetUser as any).preferredCuisines ?? null,
          likes: (targetUser as any).likes ?? null,
          dislikes: (targetUser as any).dislikes ?? null,
        },
        lifestyle: {
          dailyRoutine: targetUser.dailyRoutine ?? null,
          jobType: targetUser.workType ?? null,
          workIntensity: targetUser.workIntensity ?? null,
          sleepHours: (targetUser as any).sleepHours ?? null,
          stressLevel: (targetUser as any).stressLevel ?? null,
        },
      };

      const nutritionShape = `{
  "title": string,
  "description": string,
  "calories": number,
  "macros": { "protein": number, "carbs": number, "fat": number },
  "meals": [
    { "name": "breakfast", "items": [string] },
    { "name": "lunch", "items": [string] },
    { "name": "dinner", "items": [string] },
    { "name": "snacks", "items": [string] }
  ],
  "tips": ["Supplement or hydration advice and any special recommendations - MUST be in Arabic only"]
}`;

      const workoutShape = `{
  "title": string,
  "description": string,
  "weeklyFocus": string,
  "workoutDays": number,
  "averageDuration": string, // e.g., "45 min"
  "schedule": [
    { "day": "Monday", "type": "Upper Body|Lower Body|Full Body|Cardio|Core|Push|Pull|Legs", "duration": "45 min", "exercises": ["Bench Press - 4x8", "Pull-ups - 3x10"], "notes": string }
  ],
  "tips": ["Warm-up, form cues, recovery notes - MUST be in Arabic only"]
}`;

      const userPrompt = planType === 'workout'
        ? `Act as a certified strength and conditioning coach. Create a weekly workout plan strictly as compact JSON. No extra prose.
User profile (JSON): ${JSON.stringify(profile)}

Return JSON with this exact shape for workout:
${workoutShape}

Rules:
- Match training level, preferred environment, and goals.
- Use clear sets x reps format in exercises like "Squat - 4x8".
- Distribute days across the week without exceeding workoutDays.
- All user-facing text MUST be in Arabic (title, description, weeklyFocus, day, type, duration, exercises, notes, tips).
- Keep output as pure JSON only.`
  : `Act as a certified nutrition coach. Create a nutrition plan strictly as compact JSON. No extra prose.
User profile (JSON): ${JSON.stringify(profile)}

Return JSON with this exact shape for nutrition:
${nutritionShape}

Rules:
- Numbers must be realistic for the profile.
- Meals should match preferences and restrictions.
- All user-facing text MUST be in Arabic (title, description, meal names, meal items, tips).
- Keep output as pure JSON only.`;

      // Helper to prune undefined recursively from objects before storing as JSON
      const pruneUndefinedDeep = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(pruneUndefinedDeep);
        if (obj && typeof obj === 'object') {
          const out: any = {};
          for (const [k, v] of Object.entries(obj)) {
            if (v === undefined) continue;
            out[k] = pruneUndefinedDeep(v as any);
          }
          return out;
        }
        return obj;
      };

      // Try Assistants first when assistantId is configured, else fall back to Responses API
      let raw = '' as string;
      let parsed: any = null;
      let threadId: string | undefined;

      const tryAssistants = async () => {
        const thread = await openai.beta.threads.create();
        threadId = thread.id;
        try { console.log('AI generate thread id:', thread.id); } catch {}
        await openai.beta.threads.messages.create(thread.id, { role: 'user', content: userPrompt });
        const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistantId });
        let status = run.status;
        const start = Date.now();
        while (status !== 'completed') {
          if (status === 'failed' || status === 'cancelled' || status === 'expired') {
            throw new Error(`Assistant run ${status}`);
          }
          if (Date.now() - start > 60000) {
            throw new Error('Assistant run timed out');
          }
          await new Promise(r => setTimeout(r, 1000));
          // The SDK typings vary across versions; cast to any to avoid compile-time incompatibilities
          const rRun: any = await (openai as any).beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
          status = (rRun as any).status as typeof status;
        }
        const messages = await openai.beta.threads.messages.list(thread.id);
        const firstAssistant = messages.data.find((m: any) => m.role === 'assistant');
        const textBlocks = (firstAssistant?.content || []).filter((c: any) => c.type === 'text');
        raw = textBlocks.map((t: any) => t.text?.value || '').join('\n');
        try {
          parsed = JSON.parse(raw);
        } catch {
          const match = raw.match(/\{[\s\S]*\}/);
          parsed = match ? JSON.parse(match[0]) : null;
        }
        if (!parsed) throw new Error('Assistant response not in JSON format');
      };

      const tryResponses = async () => {
        // Use modern Responses API to generate JSON without threads
        const resp = await openai.responses.create({
          model,
          input: userPrompt,
        });
        // The SDK exposes a convenience to get text
        const asText = (resp as any).output_text || '';
        raw = asText || '';
        if (!raw) {
          // Fallback: dig into content blocks
          const content = (resp as any).output || (resp as any).content || [];
          const txt = Array.isArray(content) ? content.map((c: any) => c?.text || c?.content || '').join('\n') : '';
          raw = String(txt || '');
        }
        try {
          parsed = JSON.parse(raw);
        } catch {
          const match = raw.match(/\{[\s\S]*\}/);
          parsed = match ? JSON.parse(match[0]) : null;
        }
        if (!parsed) throw new Error('Model response not in JSON format');
      };

      try {
        if (assistantId) {
          await tryAssistants();
        } else {
          await tryResponses();
        }
      } catch (assistErr) {
        const assistMsg = (assistErr as any)?.message || String(assistErr);
        console.warn('Assistants path failed or unavailable, falling back to Responses API:', assistMsg);
        try {
          await tryResponses();
        } catch (respErr) {
          const respMsg = (respErr as any)?.message || String(respErr);
          console.error('Responses path also failed:', respMsg);
          const statusCode = String(respMsg || '').includes('timed out') ? 504 : 502;
          return res.status(statusCode as any).json({ message: respMsg || 'AI response failed' });
        }
      }

      // Map to our plan schema depending on type
      let planPayloadBase: any;
      if (planType === 'workout') {
        // Build weekly schedule
        const schedule = Array.isArray(parsed.schedule) ? parsed.schedule : [];
        const workouts = schedule.map((it: any) => ({
          day: String(it?.day || ''),
          type: String(it?.type || 'Full Body'),
          duration: String(it?.duration || ''),
          exercises: Array.isArray(it?.exercises) ? it.exercises.map((e: any) => String(e)) : [],
          notes: it?.notes ? String(it.notes) : ''
        }));
        planPayloadBase = {
          userId: targetUserId,
          coachId: currentUser.id,
          title: parsed.title || 'AI Workout Plan',
          description: parsed.description || 'Generated by AI',
          weeklyFocus: parsed.weeklyFocus ? String(parsed.weeklyFocus) : undefined,
          goals: pruneUndefinedDeep({
            workoutDays: typeof parsed.workoutDays === 'number' ? parsed.workoutDays : undefined,
            workoutDuration: parsed.averageDuration ? String(parsed.averageDuration) : undefined,
            tips: Array.isArray(parsed.tips) ? parsed.tips : []
          }),
          weeklySchedule: {
            focus: parsed.weeklyFocus ? String(parsed.weeklyFocus) : (parsed.title || 'General Fitness'),
            workouts
          }
        };
      } else {
        const mealsArray = Array.isArray(parsed.meals)
          ? parsed.meals.flatMap((m: any) => {
              const n = m?.name ? String(m.name) : 'meal';
              const items = Array.isArray(m?.items) ? m.items : [];
              return items.map((it: any) => `${n}: ${String(it)}`);
            })
          : [];
        planPayloadBase = {
          userId: targetUserId,
          coachId: currentUser.id,
          title: parsed.title || 'AI Nutrition Plan',
          description: parsed.description || 'Generated by AI',
          goals: pruneUndefinedDeep({
            calories: parsed.calories ?? undefined,
            protein: parsed.macros?.protein ?? undefined,
            carbs: parsed.macros?.carbs ?? undefined,
            fat: parsed.macros?.fat ?? undefined,
            meals: mealsArray,
            tips: Array.isArray(parsed.tips) ? parsed.tips : [],
          }),
          weeklyFocus: parsed.weeklyFocus ? String(parsed.weeklyFocus) : undefined,
        };
      }

    const parsedData = insertUserPlanSchema.parse(planPayloadBase);
    const created = await createUserPlanForRequest(req, parsedData);
    
    // Update daily stats goals for the user when plan is created
    try {
      await updateUserDailyStatsGoalsForRequest(req, created.userId, created);
    } catch (err) {
      console.error('Failed to update daily stats goals:', err);
      // Continue with plan creation even if stats update fails
    }

      return res.status(201).json({
        plan: created,
        assistant: {
          threadId,
          raw,
          parsed,
        }
      });
    } catch (error: any) {
      if (error?.name === 'ZodError') {
        try { console.error('AI plan ZodError:', error.errors); } catch {}
        return res.status(400).json({ message: 'Invalid plan payload', errors: error.errors });
      }
      console.error('AI generate plan error:', error);
      return res.status(500).json({ message: error?.message || 'Failed to generate plan' });
    }
  });
  
  // AI: Generate BOTH nutrition and workout plans in a single call
  app.post("/api/coach/ai/generate-both", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const { userId } = req.body || {};
      const aiSettings = await getAiSettingsForRequest(req);
      const planConfig = getAiFeatureConfig(aiSettings, 'plans');
      if (!planConfig) {
        return res.status(400).json(buildAiNotConfiguredResponse('plans'));
      }
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const targetUserId = parseInt(String(userId));
      const usersDb = resolveDb(req);
      const [targetUser] = await usersDb.select().from(users).where(eq(users.id, targetUserId));
      if (!targetUser) return res.status(404).json({ message: "User not found" });
      
      // Allow users to generate plans for themselves, or coaches/admins to generate for their clients
      const isGeneratingForSelf = currentUser.id === targetUserId;
      const isCoachForUser = currentUser.role === 'coach' && targetUser.coachId === currentUser.id;
      const isAdmin = (currentUser.role === 'admin' || currentUser.role === 'super_admin');
      
      if (!isGeneratingForSelf && !isCoachForUser && !isAdmin) {
        return res.status(403).json({ message: "Access denied. You can only generate plans for yourself or your clients." });
      }

      if (currentUser?.role === 'user') {
        const scope = buildScopeFromRequest(req);
        await getOrCreateAccountWithBalance(scope, targetUserId);
        const consumeResult = await consumeCredits(scope, {
          userId: targetUserId,
          actionKey: 'ai_generate_plan',
        });

        if ('insufficient' in consumeResult) {
          const language = getRequestLanguage(req);
          return res.status(402).json({ message: getInsufficientCreditsMessage(language), balance: consumeResult.balance });
        }
      }

      const assistantId = planConfig.assistantId || '';
      const openai = new OpenAI({ apiKey: planConfig.apiKey as string });
      const useAssistants = !!assistantId && /^asst_/.test(assistantId);
      const model = planConfig.model || 'gpt-5-mini-2025-08-07';
      const startedAt = Date.now();
      const maxDurationMs = 80000;
      const assertTimeLeft = () => {
        if (Date.now() - startedAt > maxDurationMs) {
          throw Object.assign(new Error('AI generation timed out'), { statusCode: 504, timedOut: true });
        }
      };

      const profile = {
        physical: {
          height: targetUser.height ?? null,
          weight: targetUser.weight ?? null,
          age: targetUser.age ?? null,
          gender: targetUser.gender ?? null,
          bodyFatPct: (targetUser as any).bodyFatPct ?? null,
          muscleMass: (targetUser as any).muscleMass ?? null,
        },
        health: {
          medicalHistory: targetUser.medicalHistory ?? null,
          medicalHistoryDetails: targetUser.medicalHistoryDetails ?? null,
          hasAllergies: targetUser.hasAllergies ?? null,
          allergyDetails: targetUser.allergyDetails ?? null,
          injuries: (targetUser as any).injuries ?? null,
        },
        training: {
          frequencyPerWeek: targetUser.trainingDaysPerWeek ?? null,
          experienceLevel: targetUser.trainingLevel ?? null,
          workoutLocation: targetUser.workoutLocation ?? null,
          programPreference: targetUser.preferredProgram ?? null,
        },
        goals: { main: targetUser.fitnessGoal ?? null },
        nutrition: {
          dailyMeals: targetUser.dailyMeals ?? null,
          preferredCarbs: targetUser.preferredCarbs ?? null,
          preferredProteins: targetUser.preferredProteins ?? null,
          preferredLegumes: targetUser.preferredLegumes ?? null,
          preferredVegetables: targetUser.preferredVegetables ?? null,
          preferredDairy: targetUser.preferredDairy ?? null,
          preferredFats: targetUser.preferredFats ?? null,
          preferredFruits: targetUser.preferredFruits ?? null,
          dietaryRestrictions: (targetUser as any).dietaryRestrictions ?? null,
          preferredCuisines: (targetUser as any).preferredCuisines ?? null,
          likes: (targetUser as any).likes ?? null,
          dislikes: (targetUser as any).dislikes ?? null,
        },
        lifestyle: {
          dailyRoutine: targetUser.dailyRoutine ?? null,
          jobType: targetUser.workType ?? null,
          workIntensity: targetUser.workIntensity ?? null,
          sleepHours: (targetUser as any).sleepHours ?? null,
          stressLevel: (targetUser as any).stressLevel ?? null,
        },
      };

      try {
        console.log('[AI] generate-both target user:', {
          targetUserId,
          coachId: currentUser.id,
          useAssistants,
          hasAssistantId: !!assistantId,
        });
      } catch {}

      const nutritionShape = `{
  "title": string,
  "description": string,
  "calories": number,
  "macros": { "protein": number, "carbs": number, "fat": number },
  "meals": [
    { "name": "breakfast", "items": [string] },
    { "name": "lunch", "items": [string] },
    { "name": "dinner", "items": [string] },
    { "name": "snacks", "items": [string] }
  ],
  "tips": ["Supplement or hydration advice and any special recommendations - MUST be in Arabic only"]
}`;

      const workoutShape = `{
  "title": string,
  "description": string,
  "weeklyFocus": string,
  "workoutDays": number,
  "averageDuration": string,
  "schedule": [
    { "day": "Monday", "type": "Upper Body|Lower Body|Full Body|Cardio|Core|Push|Pull|Legs", "duration": "45 min", "exercises": ["Bench Press - 4x8"], "notes": string }
  ],
  "tips": ["Warm-up, form cues, recovery notes - MUST be in Arabic only"]
}`;

      const pruneUndefinedDeep = (obj: any): any => {
        if (Array.isArray(obj)) return obj.map(pruneUndefinedDeep);
        if (obj && typeof obj === 'object') {
          const out: any = {};
          for (const [k, v] of Object.entries(obj)) {
            if (v === undefined) continue;
            out[k] = pruneUndefinedDeep(v as any);
          }
          return out;
        }
        return obj;
      };

      // JSON Schemas for structured output
      const nutritionJsonSchema: any = {
        name: 'nutrition_plan_schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            calories: { type: 'number' },
            macros: {
              type: 'object',
              additionalProperties: false,
              properties: {
                protein: { type: 'number' },
                carbs: { type: 'number' },
                fat: { type: 'number' }
              },
              required: ['protein','carbs','fat']
            },
            meals: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  items: { type: 'array', items: { type: 'string' } }
                },
                required: ['name','items']
              },
              minItems: 1
            },
            tips: { type: 'array', items: { type: 'string' } },
            weeklyFocus: { type: 'string' }
          },
          required: ['title','description','calories','macros','meals']
        },
        strict: true
      };

      const workoutJsonSchema: any = {
        name: 'workout_plan_schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            weeklyFocus: { type: 'string' },
            workoutDays: { type: 'number' },
            averageDuration: { type: 'string' },
            schedule: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  day: { type: 'string' },
                  type: { type: 'string' },
                  duration: { type: 'string' },
                  exercises: { type: 'array', items: { type: 'string' } },
                  notes: { type: 'string' }
                },
                required: ['day','type','duration','exercises']
              },
              minItems: 1
            },
            tips: { type: 'array', items: { type: 'string' } }
          },
          required: ['title','description','weeklyFocus','workoutDays','averageDuration','schedule']
        },
        strict: true
      };

      // Combined schema to request BOTH plans in one response
      const combinedJsonSchema: any = {
        name: 'combined_plan_schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            nutrition: nutritionJsonSchema.schema,
            workout: workoutJsonSchema.schema
          },
          required: ['nutrition','workout']
        },
        strict: true
      };

      const generateOne = async (planType: 'nutrition' | 'workout') => {
        let raw = '' as string;
        let parsed: any = null;
        let threadId: string | undefined;

        const userPrompt = planType === 'workout'
          ? `Act as a certified strength and conditioning coach. Create a weekly workout plan strictly as compact JSON. No extra prose.
User profile (JSON): ${JSON.stringify(profile)}

Return JSON with this exact shape for workout:\n${workoutShape}\n\nRules:\n- Match training level, preferred environment, and goals.\n- Use clear sets x reps format like "Squat - 4x8".\n- Distribute days across the week without exceeding workoutDays.\n- All user-facing text MUST be in Arabic (title, description, weeklyFocus, day, type, duration, exercises, notes, tips).\n- Output pure JSON only.`
          : `Act as a certified nutrition coach. Create a nutrition plan strictly as compact JSON. No extra prose.
User profile (JSON): ${JSON.stringify(profile)}

Return JSON with this exact shape for nutrition:\n${nutritionShape}\n\nRules:\n- Numbers must be realistic.\n- Meals must match preferences / restrictions.\n- All user-facing text MUST be in Arabic (title, description, meal names, meal items, tips).\n- Output pure JSON only.`;

        const tryAssistants = async () => {
          assertTimeLeft();
          const thread = await openai.beta.threads.create();
          threadId = (thread as any)?.id;
          if (!threadId) throw new Error('Assistant thread creation returned no id');
          try { console.log('AI generate BOTH thread id:', thread.id, 'type:', planType); } catch {}
          await openai.beta.threads.messages.create(thread.id, { role: 'user', content: userPrompt });
          const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistantId });
          let status = run.status; const start = Date.now();
          while (status !== 'completed') {
            if (status === 'failed' || status === 'cancelled' || status === 'expired') throw new Error(`Assistant run ${status}`);
            if (Date.now() - start > 30000) throw new Error('Assistant run timed out');
            assertTimeLeft();
            await new Promise(r => setTimeout(r, 1000));
            const rRun: any = await (openai as any).beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
            status = (rRun as any).status as typeof status;
          }
          const messages = await openai.beta.threads.messages.list(thread.id);
          const firstAssistant = messages.data.find((m: any) => m.role === 'assistant');
          const textBlocks = (firstAssistant?.content || []).filter((c: any) => c.type === 'text');
          raw = textBlocks.map((t: any) => t.text?.value || '').join('\n');
          try { parsed = JSON.parse(raw); } catch { const match = raw.match(/\{[\s\S]*\}/); parsed = match ? JSON.parse(match[0]) : null; }
          if (!parsed) throw new Error('Assistant response not in JSON format');
        };

        const tryResponses = async () => {
          assertTimeLeft();
          const modelCandidates = [
            model,
            'gpt-4o',
            'gpt-4.1-mini'
          ];

          let lastErr: any = null;
          for (const model of modelCandidates) {
            // Attempt strict json_schema first, then fallback to json_object
            for (const fmt of ['json_schema', 'json_object'] as const) {
              try {
                const resp = await openai.responses.create({
                  model,
                  input: userPrompt,
                  text: {
                    format: fmt === 'json_schema'
                      ? ({ type: 'json_schema', json_schema: planType === 'workout' ? workoutJsonSchema : nutritionJsonSchema } as any)
                      : ({ type: 'json_object' } as any)
                  }
                } as any);
                const asText = (resp as any).output_text || '';
                raw = asText || '';
                if (!raw) {
                  const content = (resp as any).output || (resp as any).content || [];
                  const txt = Array.isArray(content) ? content.map((c: any) => c?.text || c?.content || '').join('\n') : '';
                  raw = String(txt || '');
                }
                try { parsed = JSON.parse(raw); } catch {
                  // Fallback: try to extract first fenced or brace JSON block
                  const codeFence = raw.match(/```(?:json)?\n([\s\S]*?)\n```/i);
                  const brace = raw.match(/\{[\s\S]*\}/);
                  const cand = codeFence?.[1] || brace?.[0] || '';
                  parsed = cand ? JSON.parse(cand) : null;
                }
                if (!parsed) throw new Error('Model response not in JSON format');
                // Success
                return;
              } catch (err: any) {
                lastErr = err;
                const msg = String(err?.message || err);
                // If schema unsupported or rate limited, continue to next fmt/model
                if (/rate limit|429|temporarily unavailable|timeout/i.test(msg)) {
                  await new Promise(r => setTimeout(r, 1200));
                  continue;
                }
                // Try fallback path on json_schema-specific errors
                continue;
              }
            }
          }
          throw lastErr || new Error('Responses API attempt failed');
        };

        const attemptWithRetries = async () => {
          let attempts = 0;
          let lastErr: any = null;
          while (attempts < 2) {
            attempts++;
            try {
              assertTimeLeft();
              if (useAssistants) await tryAssistants(); else await tryResponses();
              return; // success
            } catch (e: any) {
              lastErr = e;
              const msg = String(e?.message || e);
              console.warn(`AI gen attempt ${attempts} failed for ${planType}:`, msg);
              // Switch path immediately after first failure if assistants are set
              if (useAssistants && attempts === 1) {
                try { await tryResponses(); return; } catch (e2: any) { lastErr = e2; }
              }
              if (/rate limit|429|temporarily unavailable|timeout/i.test(msg)) {
                await new Promise(r => setTimeout(r, 1500));
                continue;
              }
              // Non-retryable error
              break;
            }
          }
          const msg = String(lastErr?.message || lastErr || 'AI response failed');
          const statusCode = /timed out/i.test(msg) ? 504 : 502;
          throw Object.assign(new Error(msg), { statusCode });
        };

  await attemptWithRetries();

        // Map payload
        let planPayload: any;
        if (planType === 'workout') {
          const schedule = Array.isArray(parsed.schedule) ? parsed.schedule : [];
          const workouts = schedule.map((it: any) => ({
            day: String(it?.day || ''),
            type: String(it?.type || 'Full Body'),
            duration: String(it?.duration || ''),
            exercises: Array.isArray(it?.exercises) ? it.exercises.map((e: any) => String(e)) : [],
            notes: it?.notes ? String(it.notes) : ''
          }));
          planPayload = {
            userId: targetUserId,
            coachId: currentUser.id,
            title: parsed.title || 'AI Workout Plan',
            description: parsed.description || 'Generated by AI',
            weeklyFocus: parsed.weeklyFocus ? String(parsed.weeklyFocus) : undefined,
            goals: pruneUndefinedDeep({
              workoutDays: typeof parsed.workoutDays === 'number' ? parsed.workoutDays : undefined,
              workoutDuration: parsed.averageDuration ? String(parsed.averageDuration) : undefined,
              tips: Array.isArray(parsed.tips) ? parsed.tips : []
            }),
            weeklySchedule: {
              focus: parsed.weeklyFocus ? String(parsed.weeklyFocus) : (parsed.title || 'General Fitness'),
              workouts
            }
          };
        } else {
          const mealsArray = Array.isArray(parsed.meals)
            ? parsed.meals.flatMap((m: any) => {
                const n = m?.name ? String(m.name) : 'meal';
                const items = Array.isArray(m?.items) ? m.items : [];
                return items.map((it: any) => `${n}: ${String(it)}`);
              })
            : [];
          planPayload = {
            userId: targetUserId,
            coachId: currentUser.id,
            title: parsed.title || 'AI Nutrition Plan',
            description: parsed.description || 'Generated by AI',
            goals: pruneUndefinedDeep({
              calories: parsed.calories ?? undefined,
              protein: parsed.macros?.protein ?? undefined,
              carbs: parsed.macros?.carbs ?? undefined,
              fat: parsed.macros?.fat ?? undefined,
              meals: mealsArray,
              tips: Array.isArray(parsed.tips) ? parsed.tips : [],
            }),
            weeklyFocus: parsed.weeklyFocus ? String(parsed.weeklyFocus) : undefined,
          };
        }

        const parsedData = insertUserPlanSchema.parse(planPayload);
        const created = await createUserPlanForRequest(req, parsedData);
        return created;
      };

      // Try requesting BOTH nutrition and workout in a single AI call
      const generateCombined = async () => {
        let raw = '' as string;
        let parsed: any = null;
        let threadId: string | undefined;

        const combinedPrompt = `Act as a certified nutrition and strength coach. Based on the user profile JSON below, create BOTH a nutrition plan and a workout plan.
      Return a SINGLE JSON object with two top-level keys exactly: "nutrition" and "workout". No extra prose.

      User profile (JSON): ${JSON.stringify(profile)}

      Nutrition JSON shape:\n${nutritionShape}\n
      Workout JSON shape:\n${workoutShape}\n
      Rules:\n- Match user's level, environment, preferences, and restrictions.\n- All user-facing text MUST be in Arabic (nutrition and workout titles, descriptions, meal names/items, schedule fields, tips).\n- Output pure JSON only with keys { nutrition, workout }.`;

        const tryAssistantsCombined = async () => {
          assertTimeLeft();
          const thread = await openai.beta.threads.create();
          threadId = (thread as any)?.id;
          if (!threadId) throw new Error('Assistant thread creation returned no id');
          try { console.log('AI generate BOTH (combined) thread id:', thread.id); } catch {}
          await openai.beta.threads.messages.create(thread.id, { role: 'user', content: combinedPrompt });
          const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistantId });
          let status = run.status; const start = Date.now();
          while (status !== 'completed') {
            if (status === 'failed' || status === 'cancelled' || status === 'expired') throw new Error(`Assistant run ${status}`);
            if (Date.now() - start > 30000) throw new Error('Assistant run timed out');
            assertTimeLeft();
            await new Promise(r => setTimeout(r, 1000));
            const rRun: any = await (openai as any).beta.threads.runs.retrieve(run.id, { thread_id: thread.id });
            status = (rRun as any).status as typeof status;
          }
          const messages = await openai.beta.threads.messages.list(thread.id);
          const firstAssistant = messages.data.find((m: any) => m.role === 'assistant');
          const textBlocks = (firstAssistant?.content || []).filter((c: any) => c.type === 'text');
          raw = textBlocks.map((t: any) => t.text?.value || '').join('\n');
          try { parsed = JSON.parse(raw); } catch {
            const codeFence = raw.match(/```(?:json)?\n([\s\S]*?)\n```/i);
            const brace = raw.match(/\{[\s\S]*\}/);
            const cand = codeFence?.[1] || brace?.[0] || '';
            parsed = cand ? JSON.parse(cand) : null;
          }
          if (!parsed) throw new Error('Assistant response not in JSON format');
        };

        const tryResponsesCombined = async () => {
          assertTimeLeft();
          const modelCandidates = [
            model,
            'gpt-4o',
            'gpt-4.1-mini'
          ];
          let lastErr: any = null;
          for (const model of modelCandidates) {
            for (const fmt of ['json_schema', 'json_object'] as const) {
              try {
                const resp = await openai.responses.create({
                  model,
                  input: combinedPrompt,
                  text: {
                    format: fmt === 'json_schema'
                      ? ({ type: 'json_schema', json_schema: combinedJsonSchema } as any)
                      : ({ type: 'json_object' } as any)
                  }
                } as any);
                const asText = (resp as any).output_text || '';
                raw = asText || '';
                if (!raw) {
                  const content = (resp as any).output || (resp as any).content || [];
                  const txt = Array.isArray(content) ? content.map((c: any) => c?.text || c?.content || '').join('\n') : '';
                  raw = String(txt || '');
                }
                try { parsed = JSON.parse(raw); } catch {
                  const codeFence = raw.match(/```(?:json)?\n([\s\S]*?)\n```/i);
                  const brace = raw.match(/\{[\s\S]*\}/);
                  const cand = codeFence?.[1] || brace?.[0] || '';
                  parsed = cand ? JSON.parse(cand) : null;
                }
                if (!parsed) throw new Error('Model response not in JSON format');
                return; // success
              } catch (err: any) {
                lastErr = err;
                const msg = String(err?.message || err);
                if (/rate limit|429|temporarily unavailable|timeout/i.test(msg)) {
                  await new Promise(r => setTimeout(r, 1200));
                }
                continue;
              }
            }
          }
          throw lastErr || new Error('Responses API combined attempt failed');
        };

        // Attempt assistants then responses
        try {
          if (useAssistants) await tryAssistantsCombined(); else await tryResponsesCombined();
        } catch (e) {
          await tryResponsesCombined();
        }

        const nutritionParsed = parsed?.nutrition;
        const workoutParsed = parsed?.workout;
        if (!nutritionParsed && !workoutParsed) throw new Error('Combined output missing nutrition and workout');

        const created: { nutrition?: any; workout?: any } = {};

        // Create nutrition plan first
        if (nutritionParsed) {
          const mealsArray = Array.isArray(nutritionParsed.meals)
            ? nutritionParsed.meals.flatMap((m: any) => {
                const n = m?.name ? String(m.name) : 'meal';
                const items = Array.isArray(m?.items) ? m.items : [];
                return items.map((it: any) => `${n}: ${String(it)}`);
              })
            : [];
          const payload = insertUserPlanSchema.parse({
            userId: targetUserId,
            coachId: currentUser.id,
            title: nutritionParsed.title || 'AI Nutrition Plan',
            description: nutritionParsed.description || 'Generated by AI',
            weeklyFocus: nutritionParsed.weeklyFocus ? String(nutritionParsed.weeklyFocus) : undefined,
            goals: pruneUndefinedDeep({
              calories: nutritionParsed.calories ?? undefined,
              protein: nutritionParsed.macros?.protein ?? undefined,
              carbs: nutritionParsed.macros?.carbs ?? undefined,
              fat: nutritionParsed.macros?.fat ?? undefined,
              meals: mealsArray,
              tips: Array.isArray(nutritionParsed.tips) ? nutritionParsed.tips : [],
            })
          });
          created.nutrition = await createUserPlanForRequest(req, payload);
        }

        // Update the same entry with workout data instead of creating a new entry
        if (workoutParsed && created.nutrition) {
          const schedule = Array.isArray(workoutParsed.schedule) ? workoutParsed.schedule : [];
          const workouts = schedule.map((it: any) => ({
            day: String(it?.day || ''),
            type: String(it?.type || 'Full Body'),
            duration: String(it?.duration || ''),
            exercises: Array.isArray(it?.exercises) ? it.exercises.map((e: any) => String(e)) : [],
            notes: it?.notes ? String(it.notes) : ''
          }));
          
          // Merge workout data into existing nutrition plan
          const existingGoals = (created.nutrition.goals || {}) as any;
          const updatedGoals = {
            ...existingGoals,
            workoutDays: typeof workoutParsed.workoutDays === 'number' ? workoutParsed.workoutDays : undefined,
            workoutDuration: workoutParsed.averageDuration ? String(workoutParsed.averageDuration) : undefined,
            tips: [...(Array.isArray(existingGoals.tips) ? existingGoals.tips : []), ...(Array.isArray(workoutParsed.tips) ? workoutParsed.tips : [])]
          };
          
          const updateData = {
            title: `${created.nutrition.title} + ${workoutParsed.title || 'Workout Plan'}`,
            description: `${created.nutrition.description}\n\nWorkout: ${workoutParsed.description || 'Generated by AI'}`,
            weeklyFocus: workoutParsed.weeklyFocus ? String(workoutParsed.weeklyFocus) : created.nutrition.weeklyFocus,
            goals: pruneUndefinedDeep(updatedGoals),
            weeklySchedule: { focus: workoutParsed.weeklyFocus ? String(workoutParsed.weeklyFocus) : (workoutParsed.title || 'General Fitness'), workouts }
          };
          
          const updated = await updateUserPlanForRequest(req, created.nutrition.id, updateData);
          created.workout = updated;
          created.nutrition = updated; // Update reference to reflect the combined plan
        }

        return created;
      };

      // First attempt a single combined generation
      const results: any = { nutrition: null, workout: null, errors: {} as any };
      try {
        const combined = await generateCombined();
        results.nutrition = combined.nutrition || null;
        results.workout = combined.workout || null;
      } catch (e: any) {
        results.errors.combined = e?.message || 'combined failed';
      }

      // Fill any missing side(s) with per-type generation in parallel
      const tasks: Array<Promise<any>> = [];
      const types: Array<'nutrition' | 'workout'> = [];
      if (!results.nutrition) { tasks.push(generateOne('nutrition')); types.push('nutrition'); }
      if (!results.workout) { tasks.push(generateOne('workout')); types.push('workout'); }
      if (tasks.length) {
        const settled = await Promise.allSettled(tasks);
        settled.forEach((s, idx) => {
          const t = types[idx];
          if (s.status === 'fulfilled') results[t] = s.value; else results.errors[t] = (s as any).reason?.message || 'failed';
        });
      }

      // If nutrition exists but workout doesn't, update the nutrition entry with workout data
      if (!results.workout && results.nutrition) {
        try {
          const workoutPlan = await generateOne('workout');
          // Update the existing nutrition plan with workout data
          const existingGoals = (results.nutrition.goals || {}) as any;
          const workoutGoals = (workoutPlan.goals || {}) as any;
          const updatedGoals = {
            ...existingGoals,
            workoutDays: workoutGoals.workoutDays,
            workoutDuration: workoutGoals.workoutDuration,
            tips: [...(Array.isArray(existingGoals.tips) ? existingGoals.tips : []), ...(Array.isArray(workoutGoals.tips) ? workoutGoals.tips : [])]
          };
          
          const updateData = {
            title: `${results.nutrition.title} + ${workoutPlan.title}`,
            description: `${results.nutrition.description}\n\nWorkout: ${workoutPlan.description}`,
            weeklyFocus: workoutPlan.weeklyFocus || results.nutrition.weeklyFocus,
            goals: pruneUndefinedDeep(updatedGoals),
            weeklySchedule: workoutPlan.weeklySchedule
          };
          
          const updated = await updateUserPlanForRequest(req, results.nutrition.id, updateData);
          results.workout = updated;
          results.nutrition = updated;
        } catch (e: any) {
          results.errors.workout = e?.message || 'failed to generate workout';
        }
      }

      // Optional local fallback if AI fully fails or partially fails
      const allowLocalFallback = (process.env.ALLOW_LOCAL_AI_FALLBACK ?? 'true').toLowerCase() !== 'false';
      const makeNutritionFallback = () => {
        const weight = Number((targetUser as any).weight) || 70;
        const calories = Math.round(weight * 30); // simple heuristic kcal/day
        const protein = Math.round(weight * 1.6);
        const fat = Math.round((calories * 0.25) / 9);
        const carbs = Math.max(0, Math.round((calories - (protein * 4 + fat * 9)) / 4));
        const meals = [
          'breakfast: oats with milk and banana',
          'lunch: grilled chicken, rice, salad',
          'dinner: baked fish, potatoes, steamed veggies',
          'snacks: yogurt, nuts, fruit'
        ];
        return insertUserPlanSchema.parse({
          userId: targetUserId,
          coachId: currentUser.id,
          title: 'Starter Nutrition Plan',
          description: 'Auto-generated fallback plan',
          weeklyFocus: 'Consistency and balance',
          goals: { calories, protein, carbs, fat, meals, tips: ['Hydrate 2-3L/day', 'Prioritize whole foods'] }
        });
      };
      const makeWorkoutFallback = () => {
        const workoutDays = Number((targetUser as any).trainingDaysPerWeek) || 3;
        const duration = '45 min';
        const scheduleDays = ['Monday','Wednesday','Friday','Saturday'].slice(0, Math.max(2, Math.min(4, workoutDays)));
        const workouts = scheduleDays.map((day) => ({
          day,
          type: 'Full Body',
          duration,
          exercises: ['Squat - 3x10','Push-ups - 3x12','Rows - 3x10','Plank - 3x30s'],
          notes: 'Light to moderate intensity; focus on form'
        }));
        return insertUserPlanSchema.parse({
          userId: targetUserId,
          coachId: currentUser.id,
          title: 'Starter Workout Plan',
          description: 'Auto-generated fallback plan',
          weeklyFocus: 'Full body strength and conditioning',
          goals: { workoutDays: scheduleDays.length, workoutDuration: duration, tips: ['Warm-up 5-10 min', 'Cool down and stretch'] },
          weeklySchedule: { focus: 'Full Body', workouts }
        });
      };

      if (allowLocalFallback) {
        try {
          if (!results.nutrition) {
            const nf = makeNutritionFallback();
            const createdN = await createUserPlanForRequest(req, nf);
            results.nutrition = createdN;
            results.errors.nutrition = undefined;
            console.warn('AI nutrition failed; used local fallback');
          }
          if (!results.workout) {
            const wf = makeWorkoutFallback();
            // If nutrition already exists, update it with workout data
            if (results.nutrition) {
              const existingGoals = (results.nutrition.goals || {}) as any;
              const workoutGoals = (wf.goals || {}) as any;
              const updatedGoals = {
                ...existingGoals,
                workoutDays: workoutGoals.workoutDays,
                workoutDuration: workoutGoals.workoutDuration,
                tips: [...(Array.isArray(existingGoals.tips) ? existingGoals.tips : []), ...(Array.isArray(workoutGoals.tips) ? workoutGoals.tips : [])]
              };
              
              const updateData = {
                title: `${results.nutrition.title} + ${wf.title}`,
                description: `${results.nutrition.description}\n\nWorkout: ${wf.description}`,
                weeklyFocus: wf.weeklyFocus || results.nutrition.weeklyFocus,
                goals: pruneUndefinedDeep(updatedGoals),
                weeklySchedule: wf.weeklySchedule
              };
              
              const updated = await updateUserPlanForRequest(req, results.nutrition.id, updateData);
              results.workout = updated;
              results.nutrition = updated;
            } else {
              // No nutrition plan exists, create workout-only plan
              const createdW = await createUserPlanForRequest(req, wf);
              results.workout = createdW;
            }
            results.errors.workout = undefined;
            console.warn('AI workout failed; used local fallback');
          }
        } catch (e) {
          console.error('Local fallback creation error:', e);
        }
      }

      if (!results.nutrition && !results.workout) {
        console.error('AI generate-both both failed:', results.errors);
        return res.status(502).json({ message: 'Failed to generate both plans', errors: results.errors });
      }
      
      // Update daily stats goals with the nutrition plan's macros
      if (results.nutrition) {
        try {
          await updateUserDailyStatsGoalsForRequest(req, targetUserId, results.nutrition);
        } catch (err) {
          console.error('Failed to update daily stats goals:', err);
          // Continue returning the plan even if stats update fails
        }
      }
      
      return res.status(201).json(results);
    } catch (error: any) {
      console.error('AI generate-both error:', error);
      if (error?.statusCode === 504 || error?.timedOut) {
        return res.status(504).json({ message: 'AI generation timed out. Please try again.' });
      }
      return res.status(500).json({ message: 'Failed to generate both plans' });
    }
  });
  app.get("/api/coach/my-users", isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      // Admin can pass coachId to query others; coach always uses own id
      const coachIdParam = req.query.coachId as string | undefined;
      const targetCoachId = (currentUser.role === 'admin' || currentUser.role === 'super_admin') && coachIdParam ? parseInt(coachIdParam) : currentUser.id;
      if (Number.isNaN(targetCoachId)) {
        return res.status(400).json({ message: 'Invalid coachId' });
      }

      let allUsers: any[];
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      if (tenantPool) {
        // Tenant request: query tenant DB directly
        const result = await tenantPool.query(
          'SELECT * FROM users WHERE coach_id = $1',
          [targetCoachId]
        );
        allUsers = result.rows.map(mapTenantUserRow);
      } else {
        allUsers = await storage.getUsersByCoachId(targetCoachId);
      }

      // Safety: only return trainees (exclude admins/coaches)
      const myUsers = allUsers.filter((u: any) => u.role !== 'admin' && u.role !== 'coach');
      const sanitized = myUsers.map(({ password, ...rest }: any) => rest);
      return res.json(sanitized);
    } catch (error) {
      console.error('Error fetching coach users:', error);
      return res.status(500).json({ message: 'Error fetching coach users' });
    }
  });

  // GET /api/coach/assigned-plans – all plans created by this coach with trainee info
  app.get("/api/coach/assigned-plans", isAuthenticated, isCoachOrAdmin, async (req: Request, res: Response) => {
    try {
      const currentUser = req.user as any;
      const coachId = currentUser.id;

      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);

      let plans: any[];
      if (tenantPool) {
        const result = await tenantPool.query(`
          SELECT
            up.*,
            u.username        AS trainee_username,
            u.first_name      AS trainee_first_name,
            u.last_name       AS trainee_last_name,
            u.email           AS trainee_email
          FROM user_plans up
          LEFT JOIN users u ON u.id = up.user_id
          WHERE up.coach_id = $1
          ORDER BY up.created_at DESC
        `, [coachId]);
        plans = result.rows;
      } else {
        // Central DB using drizzle – raw SQL via db.execute
        const result = await db.execute(sql`
          SELECT
            up.*,
            u.username        AS trainee_username,
            u.first_name      AS trainee_first_name,
            u.last_name       AS trainee_last_name,
            u.email           AS trainee_email
          FROM user_plans up
          LEFT JOIN users u ON u.id = up.user_id
          WHERE up.coach_id = ${coachId}
          ORDER BY up.created_at DESC
        `);
        plans = (result as any).rows || result;
      }

      const parsed = plans.map((p: any) => ({
        ...p,
        goals: safeParseJSON(p.goals),
        weeklySchedule: safeParseJSON(p.weekly_schedule ?? p.weeklySchedule),
      }));

      return res.json(parsed);
    } catch (error) {
      console.error('Error fetching coach assigned plans:', error);
      return res.status(500).json({ message: 'Error fetching assigned plans' });
    }
  });
  // Helper: resolve content_library item (supports tenant pool)
  const getContentLibraryItemTenant = async (req: any, id: number) => {
    const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
    if (tenantPool) {
      const r = await tenantPool.query('SELECT * FROM content_library WHERE id = $1 LIMIT 1', [id]);
      return r.rows.length ? mapTenantRow(r.rows[0]) : null;
    }
    return storage.getContentLibraryItem(id);
  };

  // Helper: build tenant content_library update SQL (camelCase → snake_case)
  const updateContentLibraryTenant = async (tenantPool: any, id: number, update: Record<string, any>) => {
    const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(update)) {
      if (value !== undefined) {
        setClauses.push(`${camelToSnake(key)} = $${idx}`);
        values.push(value);
        idx++;
      }
    }
    setClauses.push('updated_at = NOW()');
    values.push(id);
    const r = await tenantPool.query(
      `UPDATE content_library SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return r.rows.length ? mapTenantRow(r.rows[0]) : null;
  };

  app.get('/api/coach/videos', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const coachIdParam = req.query.coachId as string | undefined;
      const targetCoachId = (currentUser.role === 'admin' || currentUser.role === 'super_admin') && coachIdParam ? parseInt(coachIdParam) : currentUser.id;
      if (Number.isNaN(targetCoachId)) {
        return res.status(400).json({ message: 'Invalid coachId' });
      }
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      if (tenantPool) {
        const result = await tenantPool.query(
          "SELECT * FROM content_library WHERE coach_id = $1 AND type = 'video'",
          [targetCoachId]
        );
        return res.json(result.rows.map(mapTenantRow));
      }
      const items = await storage.getContentLibraryByCoachId(targetCoachId);
      return res.json((items || []).filter((i: any) => i.type === 'video'));
    } catch (error) {
      console.error('Error fetching coach videos:', error);
      return res.status(500).json({ message: 'Error fetching coach videos' });
    }
  });

  app.post('/api/coach/videos', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const coachId = (currentUser.role === 'admin' || currentUser.role === 'super_admin') && req.body?.coachId ? parseInt(req.body.coachId) : currentUser.id;
      if (Number.isNaN(coachId)) {
        return res.status(400).json({ message: 'Invalid coachId' });
      }
      const payload = insertContentLibrarySchema.parse({ ...req.body, type: 'video', coachId });
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      if (tenantPool) {
        const result = await tenantPool.query(
          'INSERT INTO content_library (coach_id, title, description, type, url, thumbnail_url, category, tags, duration) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
          [coachId, payload.title, payload.description ?? null, 'video', payload.url, payload.thumbnailUrl ?? null, payload.category, payload.tags ?? [], payload.duration ?? null]
        );
        return res.status(201).json(mapTenantRow(result.rows[0]));
      }
      const created = await storage.createContentLibraryItem(payload);
      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      console.error('Error creating coach video:', error);
      return res.status(500).json({ message: 'Error creating coach video' });
    }
  });

  app.patch('/api/coach/videos/:id', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      const item = await getContentLibraryItemTenant(req, id);
      if (!item) return res.status(404).json({ message: 'Video not found' });
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && item.coachId !== currentUser.id) return res.status(403).json({ message: 'Forbidden' });
      const update: any = { ...req.body, type: 'video' };
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) delete update.coachId;
      if (tenantPool) {
        const updated = await updateContentLibraryTenant(tenantPool, id, update);
        return res.json(updated);
      }
      const updated = await storage.updateContentLibraryItem(id, update);
      return res.json(updated);
    } catch (error) {
      console.error('Error updating coach video:', error);
      return res.status(500).json({ message: 'Error updating coach video' });
    }
  });

  app.delete('/api/coach/videos/:id', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      const item = await getContentLibraryItemTenant(req, id);
      if (!item) return res.status(404).json({ message: 'Video not found' });
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && item.coachId !== currentUser.id) return res.status(403).json({ message: 'Forbidden' });
      if (tenantPool) {
        await tenantPool.query('DELETE FROM content_library WHERE id = $1', [id]);
        return res.status(204).end();
      }
      const ok = await storage.deleteContentLibraryItem(id);
      if (ok) return res.status(204).end();
      return res.status(500).json({ message: 'Failed to delete video' });
    } catch (error) {
      console.error('Error deleting coach video:', error);
      return res.status(500).json({ message: 'Error deleting coach video' });
    }
  });

  // Coach certificate CRUD (store as content_library type=image, category=certificate)
  app.get('/api/coach/certificates', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const coachIdParam = req.query.coachId as string | undefined;
      const targetCoachId = (currentUser.role === 'admin' || currentUser.role === 'super_admin') && coachIdParam ? parseInt(coachIdParam) : currentUser.id;
      if (Number.isNaN(targetCoachId)) {
        return res.status(400).json({ message: 'Invalid coachId' });
      }
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      if (tenantPool) {
        const result = await tenantPool.query(
          "SELECT * FROM content_library WHERE coach_id = $1 AND type = 'image' AND category = 'certificate'",
          [targetCoachId]
        );
        return res.json(result.rows.map(mapTenantRow));
      }
      const items = await storage.getContentLibraryByCoachId(targetCoachId);
      const certs = (items || []).filter((i: any) => i.type === 'image' && i.category === 'certificate');
      return res.json(certs);
    } catch (error) {
      console.error('Error fetching coach certificates:', error);
      return res.status(500).json({ message: 'Error fetching coach certificates' });
    }
  });

  app.post('/api/coach/certificates', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const coachId = (currentUser.role === 'admin' || currentUser.role === 'super_admin') && req.body?.coachId ? parseInt(req.body.coachId) : currentUser.id;
      if (Number.isNaN(coachId)) {
        return res.status(400).json({ message: 'Invalid coachId' });
      }
      const payload = insertContentLibrarySchema.parse({ ...req.body, type: 'image', category: 'certificate', coachId });
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      if (tenantPool) {
        const result = await tenantPool.query(
          "INSERT INTO content_library (coach_id, title, description, type, url, thumbnail_url, category, tags, duration) VALUES ($1,$2,$3,'image',$4,$5,'certificate',$6,$7) RETURNING *",
          [coachId, payload.title, payload.description ?? null, payload.url, payload.thumbnailUrl ?? null, payload.tags ?? [], payload.duration ?? null]
        );
        return res.status(201).json(mapTenantRow(result.rows[0]));
      }
      const created = await storage.createContentLibraryItem(payload);
      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      console.error('Error creating coach certificate:', error);
      return res.status(500).json({ message: 'Error creating coach certificate' });
    }
  });

  app.patch('/api/coach/certificates/:id', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      const item = await getContentLibraryItemTenant(req, id);
      if (!item) return res.status(404).json({ message: 'Certificate not found' });
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && item.coachId !== currentUser.id) return res.status(403).json({ message: 'Forbidden' });
      const update: any = { ...req.body, type: 'image', category: 'certificate' };
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) delete update.coachId;
      if (tenantPool) {
        const updated = await updateContentLibraryTenant(tenantPool, id, update);
        return res.json(updated);
      }
      const updated = await storage.updateContentLibraryItem(id, update);
      return res.json(updated);
    } catch (error) {
      console.error('Error updating coach certificate:', error);
      return res.status(500).json({ message: 'Error updating coach certificate' });
    }
  });

  app.delete('/api/coach/certificates/:id', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      const item = await getContentLibraryItemTenant(req, id);
      if (!item) return res.status(404).json({ message: 'Certificate not found' });
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && item.coachId !== currentUser.id) return res.status(403).json({ message: 'Forbidden' });
      if (tenantPool) {
        await tenantPool.query('DELETE FROM content_library WHERE id = $1', [id]);
        return res.status(204).end();
      }
      const ok = await storage.deleteContentLibraryItem(id);
      if (ok) return res.status(204).end();
      return res.status(500).json({ message: 'Failed to delete certificate' });
    } catch (error) {
      console.error('Error deleting coach certificate:', error);
      return res.status(500).json({ message: 'Error deleting coach certificate' });
    }
  });

  // Bulk-assign all existing videos to current coach (or admin-specified coach)
  app.post('/api/coach/videos/assign-all-to-me', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      let targetCoachId: number;
      if ((currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
        // Admin can specify a target coachId via body or query
        const bodyCoachId = req.body?.coachId;
        const queryCoachId = req.query?.coachId as string | undefined;
        const pick = bodyCoachId ?? (queryCoachId ? parseInt(queryCoachId) : undefined);
        if (!pick || Number.isNaN(Number(pick))) {
          return res.status(400).json({ message: 'coachId is required for admin' });
        }
        targetCoachId = Number(pick);
      } else {
        // Coaches can only assign to themselves
        targetCoachId = currentUser.id;
      }

      const all = await storage.getAllContentLibrary();
      const videos = (all || []).filter((i: any) => i.type === 'video');
      let updated = 0;
      for (const v of videos) {
        if (v.coachId !== targetCoachId) {
          await storage.updateContentLibraryItem(v.id, { coachId: targetCoachId });
          updated++;
        }
      }
      return res.json({ updated, targetCoachId });
    } catch (error) {
      console.error('Error assigning videos to coach:', error);
      return res.status(500).json({ message: 'Error assigning videos to coach' });
    }
  });

  // Coach-scoped user management (update/delete only assigned trainees)
  app.patch('/api/coach/users/:id', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const targetUserId = parseInt(req.params.id);
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      if (tenantPool) (req as any).tenantPool = tenantPool;

      let targetUser: any;
      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [targetUserId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        targetUser = mapTenantUserRow(result.rows[0]);
      } else {
        targetUser = await storage.getUser(targetUserId);
        if (!targetUser) return res.status(404).json({ message: 'User not found' });
      }

      // Only allow if admin or coach assigned to that user
      const isAllowed = (currentUser.role === 'admin' || currentUser.role === 'super_admin') || targetUser.coachId === currentUser.id;
      if (!isAllowed) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Only allow a safe subset of fields to be updated here
      const allowedFields = new Set(['firstName', 'lastName', 'whatsappWithCode', 'phoneNumber']);
      const rawData = { ...req.body } as Record<string, any>;
      const updateData: Record<string, any> = {};
      Object.entries(rawData).forEach(([key, value]) => {
        if (!allowedFields.has(key)) return;
        // CRITICAL: Never set email or username to NULL - these are authentication fields
        if (value === '' && (key === 'email' || key === 'username')) return;
        if (value === '') { updateData[key] = null; return; }
        if (typeof value === 'string') {
          const lower = value.toLowerCase();
          if (lower === 'true') { updateData[key] = true; return; }
          if (lower === 'false') { updateData[key] = false; return; }
          if (/^-?\d+(?:\.\d+)?$/.test(value)) {
            const num = value.includes('.') ? parseFloat(value) : parseInt(value, 10);
            updateData[key] = num;
            return;
          }
        }
        updateData[key] = value;
      });

      // Prevent empty updates
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'No data to update' });
      }

      if (tenantPool) {
        const camelToSnake = (str: string) => str.replace(/[A-Z]/g, (l: string) => `_${l.toLowerCase()}`);
        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;
        for (const [key, value] of Object.entries(updateData)) {
          setClauses.push(`${camelToSnake(key)} = $${idx}`);
          values.push(value);
          idx++;
        }
        setClauses.push(`updated_at = NOW()`);
        values.push(targetUserId);
        const updateResult = await tenantPool.query(
          `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
          values
        );
        if (updateResult.rows.length === 0) return res.status(500).json({ message: 'Failed to update user' });
        const { password, ...userData } = mapTenantUserRow(updateResult.rows[0]);
        return res.json(userData);
      } else {
        const updated = await storage.updateUser(targetUserId, updateData);
        if (!updated) return res.status(500).json({ message: 'Failed to update user' });
        const { password, ...userData } = updated;
        return res.json(userData);
      }
    } catch (error) {
      console.error('Error updating coach user:', error);
      return res.status(500).json({ message: 'Error updating user' });
    }
  });

  // Unassign user from coach (coach can remove their assignment)
  app.patch('/api/coach/users/:id/unassign', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const targetUserId = parseInt(req.params.id);
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      if (tenantPool) (req as any).tenantPool = tenantPool;

      let targetUser: any;
      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [targetUserId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        targetUser = mapTenantUserRow(result.rows[0]);
      } else {
        targetUser = await storage.getUser(targetUserId);
        if (!targetUser) return res.status(404).json({ message: 'User not found' });
      }

      // Disallow unassigning admins/coaches through this route
      if (targetUser.role === 'admin' || targetUser.role === 'coach') {
        return res.status(400).json({ message: 'Cannot unassign admin or coach accounts via this route' });
      }

      // Only allow if admin or coach assigned to that user
      const isAllowed = (currentUser.role === 'admin' || currentUser.role === 'super_admin') || targetUser.coachId === currentUser.id;
      if (!isAllowed) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Unassign by setting coachId to null
      if (tenantPool) {
        const updateResult = await tenantPool.query(
          'UPDATE users SET coach_id = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
          [targetUserId]
        );
        if (updateResult.rows.length === 0) return res.status(500).json({ message: 'Failed to unassign user' });
        const { password, ...userData } = mapTenantUserRow(updateResult.rows[0]);
        return res.status(200).json(userData);
      } else {
        const updatedUser = await storage.updateUser(targetUserId, { coachId: null });
        return res.status(200).json(updatedUser);
      }
    } catch (error) {
      console.error('Error unassigning user from coach:', error);
      return res.status(500).json({ message: 'Error unassigning user' });
    }
  });

  app.delete('/api/coach/users/:id', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const targetUserId = parseInt(req.params.id);
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      if (tenantPool) (req as any).tenantPool = tenantPool;

      let targetUser: any;
      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [targetUserId]);
        if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
        targetUser = mapTenantUserRow(result.rows[0]);
      } else {
        targetUser = await storage.getUser(targetUserId);
        if (!targetUser) return res.status(404).json({ message: 'User not found' });
      }

      // Disallow deleting admins/coaches through this route
      if (targetUser.role === 'admin' || targetUser.role === 'coach') {
        return res.status(400).json({ message: 'Cannot delete admin or coach accounts via this route' });
      }

      // Only allow if admin or coach assigned to that user
      const isAllowed = (currentUser.role === 'admin' || currentUser.role === 'super_admin') || targetUser.coachId === currentUser.id;
      if (!isAllowed) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const ok = await deleteUserForRequest(req, targetUserId);
      if (ok) return res.status(204).end();
      return res.status(500).json({ message: 'Failed to delete user' });
    } catch (error) {
      console.error('Error deleting coach user:', error);
      return res.status(500).json({ message: 'Error deleting user' });
    }
  });

  // Coach Info routes
  // Public endpoint to view coach info (for public profiles)
  app.get('/api/coach/info/public/:userId', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);

      if (tenantPool) {
        const userRes = await tenantPool.query('SELECT id, role FROM users WHERE id = $1 LIMIT 1', [userId]);
        if (!userRes.rows[0] || userRes.rows[0].role !== 'coach') {
          return res.status(404).json({ message: 'Coach not found' });
        }
        const infoRes = await tenantPool.query('SELECT * FROM coach_info WHERE coach_id = $1 LIMIT 1', [userId]);
        if (!infoRes.rows[0]) {
          return res.json({ coachId: userId, aboutMe: null, qualifications: null, certificateImages: [], trainingApproach: null, successStories: null, servicesAndPrograms: null, contact: null });
        }
        return res.json(mapTenantRow(infoRes.rows[0]));
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== 'coach') {
        return res.status(404).json({ message: 'Coach not found' });
      }
      const coachInfo = await storage.getCoachInfo(userId);
      if (!coachInfo) {
        return res.json({ coachId: userId, aboutMe: null, qualifications: null, certificateImages: [], trainingApproach: null, successStories: null, servicesAndPrograms: null, contact: null });
      }
      return res.json(coachInfo);
    } catch (error) {
      console.error('Error fetching public coach info:', error);
      return res.status(500).json({ message: 'Failed to fetch coach info' });
    }
  });

  app.get('/api/coach/info', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const coachId = (currentUser.role === 'admin' || currentUser.role === 'super_admin') && req.query.coachId
        ? parseInt(req.query.coachId as string)
        : currentUser.id;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);

      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM coach_info WHERE coach_id = $1 LIMIT 1', [coachId]);
        if (!result.rows[0]) {
          return res.json({ coachId, aboutMe: null, qualifications: null, trainingApproach: null, successStories: null, servicesAndPrograms: null, contact: null, certificateImages: null });
        }
        return res.json(mapTenantRow(result.rows[0]));
      }

      const coachInfo = await storage.getCoachInfo(coachId);
      if (!coachInfo) {
        return res.json({ coachId, aboutMe: null, qualifications: null, trainingApproach: null, successStories: null, servicesAndPrograms: null, contact: null });
      }
      return res.json(coachInfo);
    } catch (error) {
      console.error('Error fetching coach info:', error);
      return res.status(500).json({ message: 'Failed to fetch coach info' });
    }
  });

  app.post('/api/coach/info', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const coachId = (currentUser.role === 'admin' || currentUser.role === 'super_admin') && req.body.coachId
        ? parseInt(req.body.coachId)
        : currentUser.id;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);

      const data = {
        aboutMe: req.body.aboutMe || null,
        qualifications: req.body.qualifications || null,
        trainingApproach: req.body.trainingApproach || null,
        successStories: req.body.successStories || null,
        servicesAndPrograms: req.body.servicesAndPrograms || null,
        contact: req.body.contact || null,
        certificateImages: req.body.certificateImages || null,
      };

      if (tenantPool) {
        const existing = await tenantPool.query('SELECT id FROM coach_info WHERE coach_id = $1 LIMIT 1', [coachId]);
        if (existing.rows[0]) {
          const result = await tenantPool.query(
            `UPDATE coach_info SET about_me=$1, qualifications=$2, training_approach=$3, success_stories=$4, services_and_programs=$5, contact=$6, certificate_images=$7, updated_at=NOW() WHERE coach_id=$8 RETURNING *`,
            [data.aboutMe, data.qualifications, data.trainingApproach, data.successStories, data.servicesAndPrograms, data.contact, data.certificateImages, coachId]
          );
          return res.status(200).json(mapTenantRow(result.rows[0]));
        } else {
          const result = await tenantPool.query(
            `INSERT INTO coach_info (coach_id, about_me, qualifications, training_approach, success_stories, services_and_programs, contact, certificate_images) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [coachId, data.aboutMe, data.qualifications, data.trainingApproach, data.successStories, data.servicesAndPrograms, data.contact, data.certificateImages]
          );
          return res.status(201).json(mapTenantRow(result.rows[0]));
        }
      }

      const existing = await storage.getCoachInfo(coachId);
      let result;
      if (existing) {
        result = await storage.updateCoachInfo(coachId, { coachId, ...data });
      } else {
        result = await storage.createCoachInfo({ coachId, ...data });
      }
      return res.status(existing ? 200 : 201).json(result);
    } catch (error) {
      console.error('Error saving coach info:', error);
      return res.status(500).json({ message: 'Failed to save coach info' });
    }
  });

  // Coach Products CRUD routes
  app.get('/api/coach/products', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const coachIdParam = req.query.coachId as string | undefined;
      const targetCoachId = (currentUser.role === 'admin' || currentUser.role === 'super_admin') && coachIdParam ? parseInt(coachIdParam) : currentUser.id;
      if (Number.isNaN(targetCoachId)) return res.status(400).json({ message: 'Invalid coachId' });
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM coach_products WHERE coach_id = $1 ORDER BY created_at DESC', [targetCoachId]);
        return res.json(result.rows.map(mapTenantRow));
      }
      const products = await storage.getCoachProductsByCoachId(targetCoachId);
      return res.json(products);
    } catch (error) {
      console.error('Error fetching coach products:', error);
      return res.status(500).json({ message: 'Error fetching coach products' });
    }
  });

  app.post('/api/coach/products', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const coachId = (currentUser.role === 'admin' || currentUser.role === 'super_admin') && req.body?.coachId ? parseInt(req.body.coachId) : currentUser.id;
      if (Number.isNaN(coachId)) return res.status(400).json({ message: 'Invalid coachId' });
      const payload = insertCoachProductSchema.parse({ ...req.body, coachId });
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      if (tenantPool) {
        const result = await tenantPool.query(
          'INSERT INTO coach_products (coach_id, title, url, description, thumbnail_url) VALUES ($1,$2,$3,$4,$5) RETURNING *',
          [coachId, payload.title, payload.url, payload.description ?? null, payload.thumbnailUrl ?? null]
        );
        return res.status(201).json(mapTenantRow(result.rows[0]));
      }
      const created = await storage.createCoachProduct(payload);
      return res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      console.error('Error creating coach product:', error);
      return res.status(500).json({ message: 'Error creating coach product' });
    }
  });

  app.patch('/api/coach/products/:id', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      let product: any;
      if (tenantPool) {
        const r = await tenantPool.query('SELECT * FROM coach_products WHERE id = $1 LIMIT 1', [id]);
        product = r.rows[0] ? mapTenantRow(r.rows[0]) : null;
      } else {
        product = await storage.getCoachProduct(id);
      }
      if (!product) return res.status(404).json({ message: 'Product not found' });
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && product.coachId !== currentUser.id) return res.status(403).json({ message: 'Forbidden' });
      const update: any = { ...req.body };
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) delete update.coachId;
      if (tenantPool) {
        const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
        const setClauses: string[] = [];
        const values: any[] = [];
        let idx = 1;
        for (const [key, value] of Object.entries(update)) {
          if (value !== undefined) { setClauses.push(`${camelToSnake(key)} = $${idx}`); values.push(value); idx++; }
        }
        setClauses.push('updated_at = NOW()');
        values.push(id);
        const r = await tenantPool.query(`UPDATE coach_products SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`, values);
        return res.json(mapTenantRow(r.rows[0]));
      }
      const updated = await storage.updateCoachProduct(id, update);
      return res.json(updated);
    } catch (error) {
      console.error('Error updating coach product:', error);
      return res.status(500).json({ message: 'Error updating coach product' });
    }
  });

  app.delete('/api/coach/products/:id', isAuthenticated, isCoachOrAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      let product: any;
      if (tenantPool) {
        const r = await tenantPool.query('SELECT * FROM coach_products WHERE id = $1 LIMIT 1', [id]);
        product = r.rows[0] ? mapTenantRow(r.rows[0]) : null;
      } else {
        product = await storage.getCoachProduct(id);
      }
      if (!product) return res.status(404).json({ message: 'Product not found' });
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && product.coachId !== currentUser.id) return res.status(403).json({ message: 'Forbidden' });
      if (tenantPool) {
        await tenantPool.query('DELETE FROM coach_products WHERE id = $1', [id]);
        return res.status(204).end();
      }
      const ok = await storage.deleteCoachProduct(id);
      if (ok) return res.status(204).end();
      return res.status(500).json({ message: 'Failed to delete product' });
    } catch (error) {
      console.error('Error deleting coach product:', error);
      return res.status(500).json({ message: 'Error deleting coach product' });
    }
  });

  // Get coach products for the current user's assigned coach
  app.get('/api/my-coach-products', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      // If the logged-in user IS a coach/admin, show their own products.
      // If they are a trainee/user, show their assigned coach's products.
      const targetCoachId = (currentUser.role === 'coach' || (currentUser.role === 'admin' || currentUser.role === 'super_admin'))
        ? currentUser.id
        : currentUser.coachId;
      if (!targetCoachId) return res.json([]);
      const tenantPool = (req as any).tenantPool || await resolveTenantPoolFromSession(req);
      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM coach_products WHERE coach_id = $1 ORDER BY created_at DESC', [targetCoachId]);
        return res.json(result.rows.map(mapTenantRow));
      }
      const products = await storage.getCoachProductsByCoachId(targetCoachId);
      return res.json(products);
    } catch (error) {
      console.error('Error fetching coach products for user:', error);
      return res.status(500).json({ message: 'Error fetching coach products' });
    }
  });

  // Affiliate Products routes
  // Get all active affiliate products (public for all authenticated users)
  app.get('/api/affiliate-products', isAuthenticated, async (req, res) => {
    try {
      const tenantPool = (req as any).tenantPool;
      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM affiliate_products WHERE is_active = true');
        return res.json(result.rows.map(mapTenantRow));
      }
      const products = await storage.getActiveAffiliateProducts();
      return res.json(products);
    } catch (error) {
      console.error('Error fetching affiliate products:', error);
      return res.status(500).json({ message: 'Error fetching affiliate products' });
    }
  });

  // Get top clicked products (for featured products section)
  app.get('/api/top-clicked-products', isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 3;
      const tenantPool = (req as any).tenantPool;

      if (tenantPool) {
        const productsResult = await tenantPool.query('SELECT * FROM affiliate_products WHERE is_active = true');
        const products = productsResult.rows.map(mapTenantRow);
        if (products.length === 0) {
          return res.json([]);
        }

        const clicksResult = await tenantPool.query(
          'SELECT affiliate_product_id AS "productId", COUNT(*)::int AS "count" FROM product_clicks GROUP BY affiliate_product_id'
        );
        const clickCounts = clicksResult.rows;

        if (clickCounts.length === 0) {
          return res.json(products.slice(0, limit));
        }

        const clickCountMap = new Map(
          clickCounts.map((c: any) => [Number(c.productId), Number(c.count)])
        );

        const sortedProducts = products
          .map((product: any) => ({
            ...product,
            clickCount: clickCountMap.get(product.id) || 0,
          }))
          .sort((a: any, b: any) => b.clickCount - a.clickCount)
          .slice(0, limit)
          .map(({ clickCount, ...product }: any) => product);

        return res.json(sortedProducts);
      }
      
      // Get all active affiliate products first
      const products = await storage.getActiveAffiliateProducts();
      
      if (products.length === 0) {
        return res.json([]);
      }

      // Get click counts for all products
      const clickCounts = await db
        .select({
          productId: productClicks.affiliateProductId,
          count: sql<number>`count(*)::int`.as('count')
        })
        .from(productClicks)
        .groupBy(productClicks.affiliateProductId);

      if (clickCounts.length === 0) {
        // If no clicks yet, return first 3 active products
        return res.json(products.slice(0, limit));
      }

      // Create a map of product ID to click count
      const clickCountMap = new Map(
        clickCounts.map(c => [c.productId, c.count])
      );

      // Sort products by click count (descending) and take top N
      const sortedProducts = products
        .map(product => ({
          ...product,
          clickCount: clickCountMap.get(product.id) || 0
        }))
        .sort((a, b) => b.clickCount - a.clickCount)
        .slice(0, limit)
        .map(({ clickCount, ...product }) => product); // Remove clickCount from response

      return res.json(sortedProducts);
    } catch (error) {
      console.error('Error fetching top clicked products:', error);
      return res.status(500).json({ message: 'Error fetching top clicked products' });
    }
  });

  // Admin-only routes for managing affiliate products
  app.get('/api/admin/affiliate-products', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool;
      
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM affiliate_products ORDER BY created_at DESC');
        return res.json(result.rows.map(mapTenantRow));
      }
      
      const products = await storage.getAllAffiliateProducts();
      return res.json(products);
    } catch (error) {
      console.error('Error fetching all affiliate products:', error);
      return res.status(500).json({ message: 'Error fetching affiliate products' });
    }
  });

  app.post('/api/admin/affiliate-products', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool;
      
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const validated = insertAffiliateProductSchema.parse(req.body);

      if (tenantPool) {
        const columns = [
          'title',
          'url',
          'description',
          'thumbnail_url',
          'category',
          'source',
          'is_active',
          'scrape_enabled',
        ];
        const values = [
          validated.title,
          validated.url,
          validated.description ?? null,
          validated.thumbnailUrl ?? null,
          validated.category ?? null,
          validated.source ?? null,
          validated.isActive ?? true,
          validated.scrapeEnabled ?? true,
        ];
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const result = await tenantPool.query(
          `INSERT INTO affiliate_products (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
          values
        );
        return res.status(201).json(mapTenantRow(result.rows[0]));
      }
      const newProduct = await storage.createAffiliateProduct(validated);
      return res.status(201).json(newProduct);
    } catch (error) {
      console.error('Error creating affiliate product:', error);
      return res.status(500).json({ message: 'Error creating affiliate product' });
    }
  });

  app.patch('/api/admin/affiliate-products/:id', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool;
      
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const id = parseInt(req.params.id);

      if (tenantPool) {
        const { sets, values } = buildTenantUpdate(req.body ?? {}, {
          thumbnailUrl: 'thumbnail_url',
          isActive: 'is_active',
          scrapeEnabled: 'scrape_enabled',
          lastScrapedAt: 'last_scraped_at',
        });
        if (sets.length === 0) {
          return res.status(400).json({ message: 'No fields to update' });
        }
        values.push(id);
        const result = await tenantPool.query(
          `UPDATE affiliate_products SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
          values
        );
        if (!result.rows[0]) {
          return res.status(404).json({ message: 'Affiliate product not found' });
        }
        return res.json(mapTenantRow(result.rows[0]));
      }
      const updated = await storage.updateAffiliateProduct(id, req.body);
      
      if (!updated) {
        return res.status(404).json({ message: 'Affiliate product not found' });
      }
      
      return res.json(updated);
    } catch (error) {
      console.error('Error updating affiliate product:', error);
      return res.status(500).json({ message: 'Error updating affiliate product' });
    }
  });

  app.delete('/api/admin/affiliate-products/:id', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool;
      
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const id = parseInt(req.params.id);

      if (tenantPool) {
        const result = await tenantPool.query('DELETE FROM affiliate_products WHERE id = $1 RETURNING id', [id]);
        if (!result.rows[0]) {
          return res.status(404).json({ message: 'Affiliate product not found' });
        }
        return res.status(204).send();
      }
      const deleted = await storage.deleteAffiliateProduct(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Affiliate product not found' });
      }
      
      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting affiliate product:', error);
      return res.status(500).json({ message: 'Error deleting affiliate product' });
    }
  });

  // Get scraped products for an affiliate product
  app.get('/api/affiliate-products/:id/scraped', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const scrapedProducts = await storage.getScrapedProductsByAffiliateId(id);
      return res.json(scrapedProducts);
    } catch (error) {
      console.error('Error fetching scraped products:', error);
      return res.status(500).json({ message: 'Error fetching scraped products' });
    }
  });

  // Get all scraped products (for displaying in store)
  app.get('/api/scraped-affiliate-products', isAuthenticated, async (req, res) => {
    try {
      const scrapedProducts = await storage.getAllScrapedProducts();
      return res.json(scrapedProducts);
    } catch (error) {
      console.error('Error fetching all scraped products:', error);
      return res.status(500).json({ message: 'Error fetching scraped products' });
    }
  });

  // Trigger scraping for a specific affiliate product (admin only)
  app.post('/api/admin/affiliate-products/:id/scrape', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const id = parseInt(req.params.id);
      const result = await storage.scrapeAffiliateProduct(id);
      
      if (!result) {
        return res.status(404).json({ message: 'Affiliate product not found or scraping failed' });
      }
      
      return res.json({ 
        message: 'Scraping completed', 
        productsScraped: result.count 
      });
    } catch (error) {
      console.error('Error scraping affiliate product:', error);
      return res.status(500).json({ message: 'Error scraping affiliate product' });
    }
  });

  // Affiliate Categories routes
  // Get all categories (for both admin and users)
  app.get('/api/affiliate-categories', async (req, res) => {
    try {
      const tenantPool = (req as any).tenantPool;
      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM affiliate_categories ORDER BY display_order ASC, name_en ASC');
        return res.json(result.rows.map(mapTenantRow));
      }
      const categories = await storage.getAllAffiliateCategories();
      return res.json(categories);
    } catch (error) {
      console.error('Error fetching affiliate categories:', error);
      return res.status(500).json({ message: 'Error fetching affiliate categories' });
    }
  });

  // Get active categories only (for dropdowns)
  app.get('/api/affiliate-categories/active', async (req, res) => {
    try {
      const tenantPool = (req as any).tenantPool;
      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM affiliate_categories WHERE is_active = true ORDER BY display_order ASC, name_en ASC');
        return res.json(result.rows.map(mapTenantRow));
      }
      const categories = await storage.getActiveAffiliateCategories();
      return res.json(categories);
    } catch (error) {
      console.error('Error fetching active affiliate categories:', error);
      return res.status(500).json({ message: 'Error fetching affiliate categories' });
    }
  });

  // Create a new category (admin only)
  app.post('/api/admin/affiliate-categories', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool;
      
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const validated = insertAffiliateCategorySchema.parse(req.body);

      if (tenantPool) {
        const columns = ['name_en', 'name_ar', 'slug', 'is_active', 'display_order'];
        const values = [
          validated.nameEn,
          validated.nameAr,
          validated.slug,
          validated.isActive ?? true,
          validated.displayOrder ?? 0,
        ];
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const result = await tenantPool.query(
          `INSERT INTO affiliate_categories (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
          values
        );
        return res.status(201).json(mapTenantRow(result.rows[0]));
      }
      const newCategory = await storage.createAffiliateCategory(validated);
      return res.status(201).json(newCategory);
    } catch (error) {
      console.error('Error creating affiliate category:', error);
      return res.status(500).json({ message: 'Error creating affiliate category' });
    }
  });

  // Update a category (admin only)
  app.patch('/api/admin/affiliate-categories/:id', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool;
      
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const id = parseInt(req.params.id);

      if (tenantPool) {
        const { sets, values } = buildTenantUpdate(req.body ?? {}, {
          nameEn: 'name_en',
          nameAr: 'name_ar',
          isActive: 'is_active',
          displayOrder: 'display_order',
        });
        if (sets.length === 0) {
          return res.status(400).json({ message: 'No fields to update' });
        }
        values.push(id);
        const result = await tenantPool.query(
          `UPDATE affiliate_categories SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
          values
        );
        if (!result.rows[0]) {
          return res.status(404).json({ message: 'Affiliate category not found' });
        }
        return res.json(mapTenantRow(result.rows[0]));
      }
      const updated = await storage.updateAffiliateCategory(id, req.body);
      
      if (!updated) {
        return res.status(404).json({ message: 'Affiliate category not found' });
      }
      
      return res.json(updated);
    } catch (error) {
      console.error('Error updating affiliate category:', error);
      return res.status(500).json({ message: 'Error updating affiliate category' });
    }
  });

  // Delete a category (admin only)
  app.delete('/api/admin/affiliate-categories/:id', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool;
      
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const id = parseInt(req.params.id);

      if (tenantPool) {
        const result = await tenantPool.query('DELETE FROM affiliate_categories WHERE id = $1 RETURNING id', [id]);
        if (!result.rows[0]) {
          return res.status(404).json({ message: 'Affiliate category not found' });
        }
        return res.status(204).send();
      }
      const deleted = await storage.deleteAffiliateCategory(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Affiliate category not found' });
      }
      
      return res.status(204).send();
    } catch (error) {
      console.error('Error deleting affiliate category:', error);
      return res.status(500).json({ message: 'Error deleting affiliate category' });
    }
  });

  // Trigger scraping for all affiliate products (admin only)
  app.post('/api/admin/affiliate-products/scrape-all', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }
      
      const result = await storage.scrapeAllAffiliateProducts();
      
      return res.json({ 
        message: 'Bulk scraping completed', 
        success: result.success,
        failed: result.failed
      });
    } catch (error) {
      console.error('Error scraping all affiliate products:', error);
      return res.status(500).json({ message: 'Error scraping affiliate products' });
    }
  });

  // Admin endpoint to get ALL coach products (from all coaches)
  app.get('/api/admin/coach-products', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool;
      
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM coach_products ORDER BY created_at DESC');
        return res.json(result.rows.map(mapTenantRow));
      }
      
      // Get all coach products from the database
      const products = await db
        .select()
        .from(coachProducts)
        .orderBy(desc(coachProducts.createdAt));
      
      return res.json(products);
    } catch (error) {
      console.error('Error fetching all coach products:', error);
      return res.status(500).json({ message: 'Error fetching coach products' });
    }
  });

  // Tracking & Ads configuration (admin only)
  app.get('/api/admin/email-settings', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const tenantPool = (req as any).tenantPool;

      if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      if (tenantPool) {
        const settings = await getTenantEmailSettings(tenantPool);
        return res.json(settings);
      }

      const settings = await getPlatformEmailSettings();
      return res.json(settings);
    } catch (error) {
      console.error('Error fetching email settings:', error);
      return res.status(500).json({ message: 'Failed to fetch email settings' });
    }
  });

  app.post('/api/admin/email-settings', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const tenantPool = (req as any).tenantPool;

      if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const smtpPortRaw = req.body?.smtp_port;
      const smtpPort = smtpPortRaw === undefined || smtpPortRaw === null || smtpPortRaw === ''
        ? undefined
        : Number(smtpPortRaw);

      if (smtpPort !== undefined && (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535)) {
        return res.status(400).json({ message: 'SMTP port must be between 1 and 65535' });
      }

      const payload = {
        smtp_host: typeof req.body?.smtp_host === 'string' ? req.body.smtp_host : undefined,
        smtp_port: smtpPort,
        smtp_user: typeof req.body?.smtp_user === 'string' ? req.body.smtp_user : undefined,
        smtp_pass: typeof req.body?.smtp_pass === 'string' ? req.body.smtp_pass : undefined,
        smtp_from: typeof req.body?.smtp_from === 'string' ? req.body.smtp_from : undefined,
        smtp_to: req.body?.smtp_to === null
          ? null
          : (typeof req.body?.smtp_to === 'string' ? req.body.smtp_to : undefined),
        use_tls: typeof req.body?.use_tls === 'boolean' ? req.body.use_tls : undefined,
      };

      if (tenantPool) {
        await saveTenantEmailSettings(tenantPool, payload, currentUser.id);
        const settings = await getTenantEmailSettings(tenantPool);
        return res.json({
          success: true,
          message: 'Email settings updated successfully',
          settings,
        });
      }

      await savePlatformEmailSettings(payload, currentUser.id);
      const settings = await getPlatformEmailSettings();
      return res.json({
        success: true,
        message: 'Email settings updated successfully',
        settings,
      });
    } catch (error: any) {
      console.error('Error saving email settings:', error);
      const message = typeof error?.message === 'string' && error.message
        ? error.message
        : 'Failed to save email settings';
      return res.status(500).json({ message });
    }
  });

  app.post('/api/admin/email-settings/test', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as User;

      if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin') {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const existingConfig = await getEmailConfigForScope(req);

      const resolvedHost = typeof req.body?.smtp_host === 'string' && req.body.smtp_host.trim()
        ? req.body.smtp_host.trim()
        : existingConfig?.host;

      const resolvedPort = req.body?.smtp_port !== undefined && req.body?.smtp_port !== null && req.body?.smtp_port !== ''
        ? Number(req.body.smtp_port)
        : existingConfig?.port;

      const resolvedUser = typeof req.body?.smtp_user === 'string' && req.body.smtp_user.trim()
        ? req.body.smtp_user.trim()
        : existingConfig?.user;

      const resolvedPass = typeof req.body?.smtp_pass === 'string' && req.body.smtp_pass.trim()
        ? req.body.smtp_pass.trim()
        : existingConfig?.pass;

      const resolvedUseTls = typeof req.body?.use_tls === 'boolean'
        ? req.body.use_tls
        : (existingConfig?.useTls ?? true);

      if (!resolvedHost || !resolvedPort || !resolvedUser || !resolvedPass) {
        return res.status(400).json({ message: 'SMTP settings are incomplete for testing' });
      }

      if (!Number.isInteger(resolvedPort) || resolvedPort < 1 || resolvedPort > 65535) {
        return res.status(400).json({ message: 'SMTP port must be between 1 and 65535' });
      }

      const transportConfig: any = {
        host: resolvedHost,
        port: resolvedPort,
        secure: resolvedUseTls && resolvedPort === 465,
        auth: {
          user: resolvedUser,
          pass: resolvedPass,
        },
        connectionTimeout: 30000,
        socketTimeout: 30000,
      };

      if (resolvedUseTls && resolvedPort !== 465) {
        transportConfig.requireTLS = true;
        transportConfig.tls = {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
        };
      }

      const transporter = nodemailer.createTransport(transportConfig);
      await transporter.verify();

      return res.json({ success: true, message: 'SMTP connection successful' });
    } catch (error: any) {
      console.error('Error testing SMTP settings:', error);
      return res.status(400).json({
        success: false,
        message: error?.message || 'SMTP connection failed',
      });
    }
  });

  // Tracking & Ads configuration (admin only)
  app.get('/api/admin/tracking-settings', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const tenantPool = (req as any).tenantPool;

      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      if (tenantPool) {
        const result = await tenantPool.query('SELECT * FROM tracking_settings ORDER BY id ASC LIMIT 1');
        if (result.rows[0]) {
          return res.json(mapTenantRow(result.rows[0]));
        }
        const created = await tenantPool.query('INSERT INTO tracking_settings DEFAULT VALUES RETURNING *');
        return res.json(mapTenantRow(created.rows[0]));
      }

      let settings = await storage.getTrackingSettings();
      if (!settings) {
        settings = await storage.upsertTrackingSettings({});
      }

      return res.json(settings);
    } catch (error) {
      console.error('Error fetching tracking settings:', error);
      return res.status(500).json({ message: 'Failed to fetch tracking settings' });
    }
  });

  app.put('/api/admin/tracking-settings', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as User;
      const tenantPool = (req as any).tenantPool;

      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const parsed = trackingSettingsUpdateSchema.parse(req.body ?? {});
      const sanitized = Object.entries(parsed).reduce<Record<string, unknown>>((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});

      if (tenantPool) {
        const { sets, values } = buildTenantUpdate(sanitized, {
          metaPixelId: 'meta_pixel_id',
          metaPixelAccessToken: 'meta_pixel_access_token',
          metaPixelTestEventCode: 'meta_pixel_test_event_code',
          googleAdsConversionId: 'google_ads_conversion_id',
          googleAdsConversionLabel: 'google_ads_conversion_label',
          googleAdsSendTo: 'google_ads_send_to',
          googleAnalyticsMeasurementId: 'google_analytics_measurement_id',
          googleAnalyticsApiSecret: 'google_analytics_api_secret',
          googleAnalyticsStreamId: 'google_analytics_stream_id',
          googleAnalyticsPropertyId: 'google_analytics_property_id',
          updatedByUserId: 'updated_by_user_id',
        });
        const mergedSets = [...sets, 'updated_at = NOW()'];
        const settingsResult = await tenantPool.query('SELECT id FROM tracking_settings ORDER BY id ASC LIMIT 1');
        const settingsId = settingsResult.rows[0]?.id;
        if (!settingsId) {
          const created = await tenantPool.query('INSERT INTO tracking_settings DEFAULT VALUES RETURNING id');
          const createdId = created.rows[0]?.id;
          if (!createdId) {
            return res.status(500).json({ message: 'Failed to initialize tracking settings' });
          }
          values.push(currentUser.id);
          const updateResult = await tenantPool.query(
            `UPDATE tracking_settings SET ${mergedSets.join(', ')}, updated_by_user_id = $${values.length} WHERE id = $${values.length + 1} RETURNING *`,
            [...values, createdId]
          );
          return res.json(mapTenantRow(updateResult.rows[0]));
        }

        values.push(currentUser.id);
        values.push(settingsId);
        const updateResult = await tenantPool.query(
          `UPDATE tracking_settings SET ${mergedSets.join(', ')}, updated_by_user_id = $${values.length - 1} WHERE id = $${values.length} RETURNING *`,
          values
        );
        return res.json(mapTenantRow(updateResult.rows[0]));
      }

      const updated = await storage.upsertTrackingSettings({
        ...(sanitized as Partial<InsertTrackingSettings>),
        updatedByUserId: currentUser.id,
      });

      return res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid payload', issues: error.issues });
      }
      console.error('Error updating tracking settings:', error);
      return res.status(500).json({ message: 'Failed to update tracking settings' });
    }
  });

  // AI Settings (admin only)
  app.get('/api/admin/ai-settings', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as User;
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const settings = await getAiSettingsForRequest(req);
      return res.json({
        settings,
        configured: getAiSettingsConfiguredFlags(settings),
      });
    } catch (error) {
      console.error('Error fetching AI settings:', error);
      return res.status(500).json({ message: 'Failed to fetch AI settings' });
    }
  });

  app.post('/api/admin/ai-settings', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as User;
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const parsed = aiSettingsInputSchema.parse(req.body ?? {});
      const saved = await saveAiSettingsForRequest(req, parsed);
      return res.json({
        settings: saved,
        configured: getAiSettingsConfiguredFlags(saved),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid payload', issues: error.issues });
      }
      console.error('Error updating AI settings:', error);
      return res.status(500).json({ message: 'Failed to update AI settings' });
    }
  });

  app.post('/api/admin/ai-models', isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as User;
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: 'Admin access required' });
      }

      const parsed = aiModelsRequestSchema.parse(req.body ?? {});
      const openai = new OpenAI({ apiKey: parsed.apiKey });
      const modelsResponse: any = await openai.models.list();
      const models = Array.isArray(modelsResponse?.data)
        ? modelsResponse.data
            .map((model: any) => model?.id)
            .filter((id: unknown): id is string => typeof id === 'string')
        : [];

      const unique = Array.from(new Set(models)).sort();
      return res.json({ models: unique });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid payload', issues: error.issues });
      }
      console.error('Error loading AI models:', error);
      return res.status(502).json({ message: 'Failed to load models' });
    }
  });


  // Content Library routes - scoped to user's coach or coach's own content
  app.get("/api/content-library", isAuthenticated, async (req, res) => {
    try {
      const currentUser = (req.user as any);
      const { category, type, search } = req.query;
      const tenantPool = (req as any).tenantPool;

      let allContent: any[] = [];

      // Fetch content efficiently based on user role
      if ((currentUser.role === 'admin' || currentUser.role === 'super_admin')) {
        // Admin can see all content
        if (tenantPool) {
          const result = await tenantPool.query('SELECT * FROM content_library');
          allContent = result.rows.map(mapTenantRow);
        } else {
          allContent = await storage.getAllContentLibrary();
        }
      } else if (currentUser.role === 'coach') {
        // Coaches can only see their own content - fetch directly by coachId
        if (tenantPool) {
          const result = await tenantPool.query('SELECT * FROM content_library WHERE coach_id = $1', [currentUser.id]);
          allContent = result.rows.map(mapTenantRow);
        } else {
          allContent = await storage.getContentLibraryByCoachId(currentUser.id);
        }
      } else {
        // Regular users can only see their assigned coach's visible content
        const userCoachId = currentUser.coachId;
        
        if (!userCoachId) {
          // User has no assigned coach - return empty array
          return res.json([]);
        }
        
        // Fetch coach's content
        if (tenantPool) {
          const result = await tenantPool.query('SELECT * FROM content_library WHERE coach_id = $1', [userCoachId]);
          allContent = result.rows.map(mapTenantRow);
        } else {
          allContent = await storage.getContentLibraryByCoachId(userCoachId);
        }
      }

      // Apply additional filters
      if (search) {
        const searchLower = (search as string).toLowerCase();
        allContent = allContent.filter((item: any) => 
          item.title?.toLowerCase().includes(searchLower) ||
          item.description?.toLowerCase().includes(searchLower) ||
          item.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
        );
      }

      if (category) {
        allContent = allContent.filter((item: any) => item.category === category);
      }

      if (type) {
        allContent = allContent.filter((item: any) => item.type === type);
      }

      return res.json(allContent);
    } catch (error) {
      console.error('Error fetching content library:', error);
      res.status(500).json({ message: "Error fetching content library" });
    }
  });

  app.get("/api/content-library/:id", isAuthenticated, async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      const tenantPool = (req as any).tenantPool;
      const content = tenantPool
        ? await tenantPool.query('SELECT * FROM content_library WHERE id = $1', [contentId]).then((result) => result.rows[0] ? mapTenantRow(result.rows[0]) : null)
        : await storage.getContentLibraryItem(contentId);

      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }

      const currentUser = (req.user as any);

      // All authenticated users can access any content

      res.json(content);
    } catch (error) {
      res.status(500).json({ message: "Error fetching content" });
    }
  });

  app.post("/api/content-library", isAuthenticated, async (req, res) => {
    try {
      const coachId = (req.user as any).id;
      const tenantPool = (req as any).tenantPool;
      const parsedData = insertContentLibrarySchema.parse({
        ...req.body,
        coachId
      });

      if (tenantPool) {
        const columns = ['coach_id', 'title', 'description', 'type', 'url', 'thumbnail_url', 'category', 'tags', 'duration'];
        const values = [
          parsedData.coachId,
          parsedData.title,
          parsedData.description ?? null,
          parsedData.type,
          parsedData.url,
          parsedData.thumbnailUrl ?? null,
          parsedData.category,
          parsedData.tags ?? [],
          parsedData.duration ?? null,
        ];
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const result = await tenantPool.query(
          `INSERT INTO content_library (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
          values
        );
        return res.status(201).json(mapTenantRow(result.rows[0]));
      }

      const content = await storage.createContentLibraryItem(parsedData);
      res.status(201).json(content);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error('Error creating content:', error);
      return res.status(500).json({ message: "Error creating content" });
    }
  });

  app.patch("/api/content-library/:id", isAuthenticated, async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      const coachId = (req.user as any).id;
      const userRole = (req.user as any).role;
      const tenantPool = (req as any).tenantPool;

      const existingContent = tenantPool
        ? await tenantPool.query('SELECT * FROM content_library WHERE id = $1', [contentId]).then((result) => result.rows[0] ? mapTenantRow(result.rows[0]) : null)
        : await storage.getContentLibraryItem(contentId);
      if (!existingContent) {
        return res.status(404).json({ message: "Content not found" });
      }

      // Allow all authenticated users to update any content

      if (tenantPool) {
        const { sets, values } = buildTenantUpdate(req.body ?? {}, {
          thumbnailUrl: 'thumbnail_url',
        });
        if (sets.length === 0) {
          return res.status(400).json({ message: "No fields to update" });
        }
        const result = await tenantPool.query(
          `UPDATE content_library SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`,
          [...values, contentId]
        );
        return res.json(mapTenantRow(result.rows[0]));
      }

      const updatedContent = await storage.updateContentLibraryItem(contentId, req.body);
      if (updatedContent) {
        res.json(updatedContent);
      } else {
        res.status(500).json({ message: "Failed to update content" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error updating content" });
    }
  });

  app.delete("/api/content-library/:id", isAuthenticated, async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      const coachId = (req.user as any).id;
      const userRole = (req.user as any).role;
      const tenantPool = (req as any).tenantPool;

      const existingContent = tenantPool
        ? await tenantPool.query('SELECT * FROM content_library WHERE id = $1', [contentId]).then((result) => result.rows[0] ? mapTenantRow(result.rows[0]) : null)
        : await storage.getContentLibraryItem(contentId);
      if (!existingContent) {
        return res.status(404).json({ message: "Content not found" });
      }

      // Allow all authenticated users to delete any content

      if (tenantPool) {
        await tenantPool.query('DELETE FROM content_library WHERE id = $1', [contentId]);
        return res.status(204).send();
      }

      const deleted = await storage.deleteContentLibraryItem(contentId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete content" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error deleting content" });
    }
  });

  // Content Categories API
  app.get("/api/content-categories", isAuthenticated, async (req, res) => {
    try {
      const tenantPool = (req as any).tenantPool;
      
      if (tenantPool) {
        const result = await tenantPool.query(
          'SELECT * FROM content_categories WHERE is_active = true ORDER BY display_order, name'
        );
        return res.json(result.rows.map(mapTenantRow));
      }

      const categories = await storage.getAllContentCategories();
      res.json(categories);
    } catch (error) {
      console.error('Error fetching content categories:', error);
      res.status(500).json({ message: "Error fetching content categories" });
    }
  });

  app.post("/api/content-categories", isAuthenticated, async (req, res) => {
    try {
      const userRole = (req.user as any).role;
      
      // Only admins can create categories
      if ((userRole !== 'admin' && userRole !== 'super_admin')) {
        return res.status(403).json({ message: "Only admins can create categories" });
      }

      const tenantPool = (req as any).tenantPool;
      const parsedData = insertContentCategorySchema.partial({ slug: true }).parse(req.body);

      // Generate slug from name if not provided
      const slug = parsedData.slug || parsedData.name.toLowerCase().replace(/\s+/g, '-');

      if (tenantPool) {
        const columns = ['name', 'slug', 'description', 'is_active', 'display_order'];
        const values = [
          parsedData.name,
          slug,
          parsedData.description ?? null,
          parsedData.isActive ?? true,
          parsedData.displayOrder ?? 0,
        ];
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        const result = await tenantPool.query(
          `INSERT INTO content_categories (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`,
          values
        );
        return res.status(201).json(mapTenantRow(result.rows[0]));
      }

      const category = await storage.createContentCategory({ ...parsedData, slug });
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error('Error creating content category:', error);
      return res.status(500).json({ message: "Error creating content category" });
    }
  });

  app.patch("/api/content-categories/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = (req.user as any).role;
      
      // Only admins can update categories
      if ((userRole !== 'admin' && userRole !== 'super_admin')) {
        return res.status(403).json({ message: "Only admins can update categories" });
      }

      const categoryId = parseInt(req.params.id);
      const tenantPool = (req as any).tenantPool;

      const existingCategory = tenantPool
        ? await tenantPool.query('SELECT * FROM content_categories WHERE id = $1', [categoryId]).then((result) => result.rows[0] ? mapTenantRow(result.rows[0]) : null)
        : await storage.getContentCategory(categoryId);
      
      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      if (tenantPool) {
        const { sets, values } = buildTenantUpdate(req.body ?? {}, {
          isActive: 'is_active',
          displayOrder: 'display_order',
        });
        if (sets.length === 0) {
          return res.status(400).json({ message: "No fields to update" });
        }
        const result = await tenantPool.query(
          `UPDATE content_categories SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`,
          [...values, categoryId]
        );
        return res.json(mapTenantRow(result.rows[0]));
      }

      const updatedCategory = await storage.updateContentCategory(categoryId, req.body);
      if (updatedCategory) {
        res.json(updatedCategory);
      } else {
        res.status(500).json({ message: "Failed to update category" });
      }
    } catch (error) {
      console.error('Error updating content category:', error);
      res.status(500).json({ message: "Error updating content category" });
    }
  });

  app.delete("/api/content-categories/:id", isAuthenticated, async (req, res) => {
    try {
      const userRole = (req.user as any).role;
      
      // Only admins can delete categories
      if ((userRole !== 'admin' && userRole !== 'super_admin')) {
        return res.status(403).json({ message: "Only admins can delete categories" });
      }

      const categoryId = parseInt(req.params.id);
      const tenantPool = (req as any).tenantPool;

      const existingCategory = tenantPool
        ? await tenantPool.query('SELECT * FROM content_categories WHERE id = $1', [categoryId]).then((result) => result.rows[0] ? mapTenantRow(result.rows[0]) : null)
        : await storage.getContentCategory(categoryId);
      
      if (!existingCategory) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Soft delete by setting is_active to false
      if (tenantPool) {
        await tenantPool.query('UPDATE content_categories SET is_active = false, updated_at = NOW() WHERE id = $1', [categoryId]);
        return res.status(204).send();
      }

      const deleted = await storage.deleteContentCategory(categoryId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete category" });
      }
    } catch (error) {
      console.error('Error deleting content category:', error);
      res.status(500).json({ message: "Error deleting content category" });
    }
  });

  // Save workout session (completed workout tracking) - handles both regular and custom workouts
  app.post("/api/workout-sessions", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userId = currentUser.id;

      console.log("Saving workout session for user:", userId);
      console.log("Session data received:", req.body);

      // Calculate total and completed sets from exercises
      let totalSets = 0;
      let completedSets = 0;

      if (req.body.exercises && Array.isArray(req.body.exercises)) {
        req.body.exercises.forEach((exercise: any) => {
          if (exercise.sets && Array.isArray(exercise.sets)) {
            totalSets += exercise.sets.length;
            completedSets += exercise.sets.filter((set: any) => set.completed).length;
          }
        });
      }

      const sessionData = {
        userId: userId,
        workoutId: req.body.workoutId || null, // Can be null for regular workouts
        workoutName: req.body.workoutName,
        workoutType: req.body.workoutType || "regular",
        duration: req.body.duration,
        totalSets: totalSets,
        completedSets: completedSets,
        exercises: req.body.exercises,
        notes: req.body.notes || null,
        // Use custom date if provided, otherwise use current time
        completedAt: req.body.completedAt ? new Date(req.body.completedAt) : new Date()
      };

      const result = await createWorkoutSessionForRequest(req, sessionData);
      console.log("Workout session created with ID:", result.id);

      // Consume credits for trainee users
      if (currentUser?.role === 'user') {
        try {
          const scope = buildScopeFromRequest(req);
          await getOrCreateAccountWithBalance(scope, userId);

          const consumeResult = await consumeCredits(scope, {
            userId,
            actionKey: 'workout_complete_session',
          });

          if ('insufficient' in consumeResult) {
            // Rollback: delete the workout session
            await deleteWorkoutSessionForRequest(req, result.id);
            const language = getRequestLanguage(req);
            return res.status(402).json({ message: getInsufficientCreditsMessage(language), balance: consumeResult.balance });
          }
        } catch (creditError) {
          await deleteWorkoutSessionForRequest(req, result.id);
          console.error('Error consuming credits for workout session:', creditError);
          return res.status(500).json({ message: 'Failed to consume credits' });
        }
      }

      // Award points for workout completion (once per day)
      await addPointsForRequest(req, userId, 20, 'workout');
      // Update streak - user completed a workout today
      await updateStreakForRequest(req, userId, true);

      res.status(201).json(result);
    } catch (error) {
      console.error("Error saving workout session:", error);
      res.status(500).json({ 
        message: "Error saving workout session",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Save custom workout session (completed workout tracking) - DEPRECATED: use /api/workout-sessions
  app.post("/api/custom-workout-sessions", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userId = currentUser.id;

      console.log("Saving custom workout session for user:", userId);
      console.log("Session data received:", req.body);

      // Calculate total and completed sets from exercises
      let totalSets = 0;
      let completedSets = 0;

      if (req.body.exercises && Array.isArray(req.body.exercises)) {
        req.body.exercises.forEach((exercise: any) => {
          if (exercise.sets && Array.isArray(exercise.sets)) {
            totalSets += exercise.sets.length;
            completedSets += exercise.sets.filter((set: any) => set.completed).length;
          }
        });
      }

      const sessionData = {
        userId: userId,
        workoutId: req.body.workoutId || null, // Can be null for custom workouts
        workoutName: req.body.workoutName,
        workoutType: "custom",
        duration: req.body.duration,
        totalSets: totalSets,
        completedSets: completedSets,
        exercises: req.body.exercises,
        notes: req.body.notes || null
      };

      const result = await createWorkoutSessionForRequest(req, sessionData);
      console.log("Custom workout session created with ID:", result.id);

      // Consume credits for trainee users
      if (currentUser?.role === 'user') {
        try {
          const scope = buildScopeFromRequest(req);
          await getOrCreateAccountWithBalance(scope, userId);

          const consumeResult = await consumeCredits(scope, {
            userId,
            actionKey: 'workout_complete_session',
          });

          if ('insufficient' in consumeResult) {
            // Rollback: delete the workout session
            await deleteWorkoutSessionForRequest(req, result.id);
            const language = getRequestLanguage(req);
            return res.status(402).json({ message: getInsufficientCreditsMessage(language), balance: consumeResult.balance });
          }
        } catch (creditError) {
          await deleteWorkoutSessionForRequest(req, result.id);
          console.error('Error consuming credits for custom workout session:', creditError);
          return res.status(500).json({ message: 'Failed to consume credits' });
        }
      }

      // Award points for workout completion (once per day)
      await addPointsForRequest(req, userId, 20, 'workout');
      // Update streak - user completed a workout today
      await updateStreakForRequest(req, userId, true);

      res.status(201).json(result);
    } catch (error) {
      console.error("Error saving custom workout session:", error);
      res.status(500).json({ 
        message: "Error saving custom workout session",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get workout sessions for progress tracking
  app.get("/api/workout-sessions", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userId = currentUser.id;
      const { startDate, endDate } = req.query;

      if (startDate && endDate) {
        const sessions = await getWorkoutSessionsByDateRangeForRequest(
          req,
          userId,
          new Date(startDate as string),
          new Date(endDate as string)
        );
        res.json(sessions);
      } else {
        const sessions = await getWorkoutSessionsByUserIdForRequest(req, userId);
        res.json(sessions);
      }
    } catch (error) {
      console.error("Error fetching workout sessions:", error);
      res.status(500).json({ message: "Error fetching workout sessions" });
    }
  });

  // Get exercise history (last 5 completed sets for a specific exercise)
  app.get("/api/exercise-history/:exerciseName", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userId = currentUser.id;
      const exerciseName = decodeURIComponent(req.params.exerciseName).trim();

      // Get all workout sessions for this user
      const sessions = await getWorkoutSessionsByUserIdForRequest(req, userId);

      // Extract sets for the specific exercise from all sessions
      const exerciseSets: Array<{
        reps: number | null;
        weight: number | null;
        completedAt: Date;
      }> = [];

      sessions.forEach((session: WorkoutSession) => {
        if (!session.exercises || !Array.isArray(session.exercises)) return;

        // Find the exercise in this session
        const exerciseLog = session.exercises.find((ex: any) => {
          // Clean both exercise names for comparison
          const cleanLogName = (ex.exerciseName || '')
            .replace(/^[-•·*]\s*/, '')
            .replace(/\s*-\s*\d+\s*sets?\s*x\s*\d+\s*reps?.*$/i, '')
            .replace(/\s*\(\d+\s*(kg|lbs)\)/gi, '')
            .trim()
            .toLowerCase();
          
          const cleanRequestName = exerciseName
            .replace(/^[-•·*]\s*/, '')
            .replace(/\s*-\s*\d+\s*sets?\s*x\s*\d+\s*reps?.*$/i, '')
            .replace(/\s*\(\d+\s*(kg|lbs)\)/gi, '')
            .trim()
            .toLowerCase();

          return cleanLogName === cleanRequestName;
        });

        if (exerciseLog && Array.isArray(exerciseLog.sets)) {
          // Add each completed set with the workout date
          exerciseLog.sets.forEach((set: any) => {
            if (set.completed && (set.reps !== null || set.weight !== null)) {
              exerciseSets.push({
                reps: set.reps,
                weight: set.weight,
                completedAt: session.completedAt,
              });
            }
          });
        }
      });

      // Sort by date (most recent first)
      const sortedSets = exerciseSets
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

      // Group by date and get the last 5 dates
      const dateGroups = new Map<string, Array<{ reps: number | null; weight: number | null; completedAt: Date }>>();
      
      sortedSets.forEach(set => {
        const dateKey = new Date(set.completedAt).toISOString().split('T')[0];
        if (!dateGroups.has(dateKey)) {
          dateGroups.set(dateKey, []);
        }
        dateGroups.get(dateKey)!.push(set);
      });

      // Get sets from the last 5 dates
      const last5Dates = Array.from(dateGroups.keys()).slice(0, 5);
      const recentSets = last5Dates.flatMap(dateKey => dateGroups.get(dateKey) || []);

      res.json(recentSets);
    } catch (error) {
      console.error("Error fetching exercise history:", error);
      res.status(500).json({ message: "Error fetching exercise history" });
    }
  });

  // Coach approval endpoint (admin only)
  app.patch("/api/users/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userId = parseInt(req.params.id);

      // Only admins can approve coaches
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: "Access denied" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.role !== 'coach') {
        return res.status(400).json({ message: "Only coaches can be approved" });
      }

      if (user.isApproved) {
        return res.status(400).json({ message: "Coach is already approved" });
      }

      const updatedUser = await storage.updateUser(userId, {
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: currentUser.id
      });

      if (updatedUser) {
        const { password, ...userData } = updatedUser;
        res.json(userData);
      } else {
        res.status(500).json({ message: "Failed to approve coach" });
      }
    } catch (error) {
      console.error("Error approving coach:", error);
      res.status(500).json({ message: "Error approving coach" });
    }
  });

  // Admin user management endpoints

  app.post("/api/users", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool;
      const normalizedIdentity = normalizeIdentityFields(req.body || {});

      // Only admins can create users
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (tenantPool) {
        // Tenant user creation: use direct SQL on the tenant database
        const {
          password: plainPassword, firstName, lastName, role,
          whatsappWithCode, phoneNumber, phone, city, country, gender, religion,
          age, height, weight, goalWeight, fitnessGoal, activityLevel,
          ...rest
        } = req.body;
        const username = normalizedIdentity.username;
        const email = normalizedIdentity.email;

        if (!firstName || !lastName) {
          return res.status(400).json({ message: "First name and last name are required" });
        }
        if (!plainPassword) {
          return res.status(400).json({ message: "Password is required" });
        }
        if (!username || !email) {
          return res.status(400).json({ message: "Username and email are required" });
        }

        // Check username conflict
        const conflictResult = await tenantPool.query(
          'SELECT id FROM users WHERE username = $1 LIMIT 1',
          [username]
        );
        if (conflictResult.rows.length > 0) {
          return res.status(400).json({ message: "Username already exists" });
        }

        // Check email conflict
        const emailConflictResult = await tenantPool.query(
          'SELECT id FROM users WHERE email = $1 LIMIT 1',
          [email]
        );
        if (emailConflictResult.rows.length > 0) {
          return res.status(400).json({ message: "Email already exists" });
        }

        // Check WhatsApp number conflict
        if (whatsappWithCode) {
          const wwcConflict = await tenantPool.query(
            'SELECT id FROM users WHERE whatsapp_with_code = $1 LIMIT 1',
            [whatsappWithCode]
          );
          if (wwcConflict.rows.length > 0) {
            return res.status(400).json({ message: "WhatsApp number already exists" });
          }
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Coaches and admins created by a tenant admin are auto-approved
        const userRole = role || 'user';
        const isApprovedValue = userRole === 'coach' || (userRole === 'admin' || userRole === 'super_admin') ? true : true;

        // Build camelCase → snake_case helper
        const camelToSnakePost = (str: string) => str.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);

        const fieldMap: Record<string, any> = {
          username,
          email,
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          role: userRole,
          whatsapp_with_code: whatsappWithCode || null,
          phone_number: phoneNumber || phone || null,
          city: city || null,
          country: country || null,
          gender: gender || null,
          religion: religion || null,
          age: age != null ? age : null,
          height: height != null ? height : null,
          weight: weight != null ? weight : null,
          goal_weight: goalWeight != null ? goalWeight : null,
          fitness_goal: fitnessGoal || null,
          activity_level: activityLevel || null,
          is_approved: isApprovedValue,
        };

        // Add any extra camelCase fields from the request body
        for (const [key, value] of Object.entries(rest)) {
          if (value !== undefined && value !== null && value !== '') {
            fieldMap[camelToSnakePost(key)] = value;
          }
        }

        // Filter out null values for cleaner inserts (only keep non-null)
        const columns = Object.keys(fieldMap).filter(k => fieldMap[k] !== null && fieldMap[k] !== undefined);
        const insertValues = columns.map(k => fieldMap[k]);
        const placeholders = columns.map((_, i) => `$${i + 1}`);

        const insertResult = await tenantPool.query(
          `INSERT INTO users (${columns.join(', ')}, created_at, updated_at)
           VALUES (${placeholders.join(', ')}, NOW(), NOW())
           RETURNING *`,
          insertValues
        );

        const { password: _pw, ...userData } = mapTenantRow(insertResult.rows[0]);

        try {
          const scope = buildScopeFromRequest(req);
          await grantSignupCredits(scope, { userId: userData.id });
        } catch (creditError) {
          console.error('Failed to grant signup credits for manually added tenant user:', creditError);
        }

        return res.status(201).json(userData);
      } else {
        // Main platform user creation
        const parsedData = insertUserSchema.parse({
          ...req.body,
          ...normalizedIdentity,
        });

        // Check if WhatsApp number already exists
        if (parsedData.whatsappWithCode) {
          const existingUser = await storage.getUserByWhatsappWithCode(parsedData.whatsappWithCode as string);
          if (existingUser) {
            return res.status(400).json({ 
              message: "WhatsApp number already exists" 
            });
          }
        }

        const user = await storage.createUser(parsedData as any);

        try {
          const scope = buildScopeFromRequest(req);
          await grantSignupCredits(scope, { userId: user.id });
        } catch (creditError) {
          console.error('Failed to grant signup credits for manually added user:', creditError);
        }

        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error('Error creating user:', error);
      res.status(500).json({ message: "Error creating user" });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const userId = parseInt(req.params.id);
      const tenantPool = (req as any).tenantPool;

      // Only admins can delete users
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Prevent admins from deleting themselves
      if (currentUser.id === userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      if (tenantPool) {
        const usersDb = resolveDb(req);
        const [tenantUser] = await usersDb
          .select()
          .from(users)
          .where(eq(users.id, userId));
        if (!tenantUser) {
          return res.status(404).json({ message: "User not found" });
        }
      } else {
        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
      }

      const deleted = await deleteUserForRequest(req, userId);
      if (deleted) {
        res.status(204).send();
      } else {
        res.status(500).json({ message: "Failed to delete user" });
      }
    } catch (error) {
      res.status(500).json({ message: "Error deleting user" });
    }
  });

  // Admin trainee detail routes
  app.get("/api/admin/trainee-progress/:userId", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Check if user is admin or coach
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && currentUser.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const userId = parseInt(req.params.userId);
      const progress = await getProgressByUserIdForRequest(req, userId);
      res.json(progress);
    } catch (error) {
      res.status(500).json({ message: "Error fetching trainee progress" });
    }
  });

  app.get("/api/admin/trainee-meals/:userId", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Check if user is admin or coach
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && currentUser.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const userId = parseInt(req.params.userId);
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      const mealsDb = resolveDb(req);

      const mealsResult = await mealsDb.select().from(meals).where(
        and(
          eq(meals.userId, userId),
          gte(meals.date, sixMonthsAgo),
          lte(meals.date, now)
        )
      ).orderBy(desc(meals.date));

      res.json(mealsResult);
    } catch (error) {
      res.status(500).json({ message: "Error fetching trainee meals" });
    }
  });

  app.get("/api/admin/trainee-workout-sessions/:userId", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Check if user is admin or coach
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && currentUser.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const userId = parseInt(req.params.userId);
      const workoutSessions = await getWorkoutSessionsByUserIdForRequest(req, userId);
      res.json(workoutSessions);
    } catch (error) {
      res.status(500).json({ message: "Error fetching trainee workout sessions" });
    }
  });

  app.get("/api/admin/trainee-messages/:userId", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Check if user is admin or coach
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && currentUser.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const userId = parseInt(req.params.userId);
      const messages = await storage.getMessagesByUserId(userId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Error fetching trainee messages" });
    }
  });

  app.get("/api/admin/trainee-daily-stats/:userId", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;

      // Check if user is admin or coach
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin') && currentUser.role !== 'coach') {
        return res.status(403).json({ message: "Access denied" });
      }

      const userId = parseInt(req.params.userId);
      const dailyStats = await getDailyStatsByUserIdForRequest(req, userId);
      res.json(dailyStats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching trainee daily stats" });
    }
  });

  // Coach invitation endpoints
  
  // Get coach invitations (for coaches to see incoming invitations)
  app.get("/api/coach-invitations", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      if (currentUser.role === 'coach') {
        // Get invitations sent to this coach
        const invitations = await storage.getCoachInvitationsByCoachId(currentUser.id);
        return res.json(invitations);
      } else if (currentUser.role === 'user') {
        // Get invitations sent by this user
        const invitations = await storage.getCoachInvitationsByUserId(currentUser.id);
        return res.json(invitations);
      } else {
        return res.status(403).json({ message: "Access denied" });
      }
    } catch (error) {
      console.error('Error fetching coach invitations:', error);
      res.status(500).json({ message: "Error fetching coach invitations" });
    }
  });

  // Respond to coach invitation (accept/decline)
  app.patch("/api/coach-invitations/:id", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const invitationId = parseInt(req.params.id);
      const { status } = req.body; // 'accepted' or 'declined'

      if (currentUser.role !== 'coach') {
        return res.status(403).json({ message: "Only coaches can respond to invitations" });
      }

      if (!['accepted', 'declined'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'accepted' or 'declined'" });
      }

      const invitation = await storage.getCoachInvitation(invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.coachId !== currentUser.id) {
        return res.status(403).json({ message: "You can only respond to your own invitations" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation has already been responded to" });
      }

      // Update invitation status
      const updatedInvitation = await storage.updateCoachInvitation(invitationId, {
        status,
        respondedAt: new Date()
      });

      // If accepted, assign coach to user
      if (status === 'accepted') {
        await storage.updateUser(invitation.userId, { coachId: currentUser.id });
        console.log(`Coach ${currentUser.id} assigned to user ${invitation.userId} via invitation`);
      }

      res.json(updatedInvitation);
    } catch (error) {
      console.error('Error responding to coach invitation:', error);
      res.status(500).json({ message: "Error responding to invitation" });
    }
  });

  // Cancel coach invitation (for users)
  app.delete("/api/coach-invitations/:id", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const invitationId = parseInt(req.params.id);

      const invitation = await storage.getCoachInvitation(invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.userId !== currentUser.id) {
        return res.status(403).json({ message: "You can only cancel your own invitations" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Can only cancel pending invitations" });
      }

      await storage.deleteCoachInvitation(invitationId);
      res.status(204).send();
    } catch (error) {
      console.error('Error canceling coach invitation:', error);
      res.status(500).json({ message: "Error canceling invitation" });
    }
  });

  // Survey submissions
  app.post("/api/surveys", async (req, res) => {
    try {
      const submission = req.body || {};
      const requiredFields = [
        'firstName',
        'lastName',
        'dietSatisfaction',
        'exerciseSatisfaction',
        'supportSatisfaction',
        'hasImprovement',
        'hasDifficulties',
        'howDidYouHear',
        'hasAppProblems',
      ];

      for (const field of requiredFields) {
        if (!submission[field]) {
          return res.status(400).json({ message: `Missing field: ${field}` });
        }
      }

      const sanitized = {
        ...submission,
        submittedAt: new Date().toISOString(),
        id: `survey-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };

      try {
        const fs = await import('fs');
        const path = await import('path');
        const surveysDir = path.join(process.cwd(), 'attached_assets', 'surveys');
        if (!fs.existsSync(surveysDir)) {
          fs.mkdirSync(surveysDir, { recursive: true });
        }
        const filePath = path.join(surveysDir, `${sanitized.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2), 'utf-8');
      } catch (fileErr) {
        console.error('Failed to persist survey submission:', fileErr);
      }

      res.status(200).json({ success: true, id: sanitized.id });
    } catch (error) {
      console.error('Error saving survey submission:', error);
      res.status(500).json({ message: 'Failed to save survey submission' });
    }
  });

  // Technical Issue Report endpoint - stored locally for review
  app.post("/api/technical-issue", async (req, res) => {
    try {
      console.log('Technical issue report received:', req.body);

      // Validate required fields
      const reportData: TechnicalIssueReport = req.body;

      if (!reportData.type || !reportData.description) {
        return res.status(400).json({ 
          message: "Type and description are required fields" 
        });
      }

      // Add server-side timestamp if not provided
      if (!reportData.timestamp) {
        reportData.timestamp = new Date().toISOString();
      }

      // Process screenshot if provided
      let screenshotPath = '';
      if (reportData.screenshot && reportData.screenshotFilename) {
        try {
          // Create screenshots directory if it doesn't exist
          const fs = await import('fs');
          const path = await import('path');
          const screenshotsDir = path.join(process.cwd(), 'attached_assets', 'screenshots');

          if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
          }

          // Extract base64 data from data URL
          const base64Data = reportData.screenshot.replace(/^data:image\/[a-z]+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');

          // Create unique filename
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `bug-report-${timestamp}.png`;
          const filePath = path.join(screenshotsDir, filename);

          // Save the file
          fs.writeFileSync(filePath, buffer);
          screenshotPath = `attached_assets/screenshots/${filename}`;

          console.log(`Screenshot saved to: ${screenshotPath}`);
        } catch (error) {
          console.error('Failed to save screenshot file:', error);
          // Continue without the file path if saving fails
        }
      }

      // Map the form data to webhook format
      const webhookData = {
        issueType: reportData.type,
        description: reportData.description,
        userEmail: reportData.email || '',
        phoneNumber: reportData.phone || '',
        screenshot: reportData.screenshot || '',
        screenshotFilename: reportData.screenshotFilename || '',
        screenshotPath: screenshotPath,
        screenshotSize: reportData.screenshotSize || 0,
        screenshotType: reportData.screenshotType || '',
        timestamp: reportData.timestamp,
        userAgent: reportData.userAgent || '',
        pageUrl: reportData.url || '',
        reportId: `TECH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      console.log('Technical issue report stored locally:', JSON.stringify({
        ...webhookData,
        screenshot: webhookData.screenshot ? '[SCREENSHOT DATA]' : 'No screenshot'
      }));

      // Persist report to disk for later triage
      try {
        const fs = await import('fs');
        const path = await import('path');
        const issuesDir = path.join(process.cwd(), 'attached_assets', 'tech-issues');
        if (!fs.existsSync(issuesDir)) {
          fs.mkdirSync(issuesDir, { recursive: true });
        }
        const filename = `${webhookData.reportId}.json`;
        const filePath = path.join(issuesDir, filename);
        fs.writeFileSync(filePath, JSON.stringify(webhookData, null, 2), 'utf-8');
      } catch (fileErr) {
        console.error('Failed to persist technical issue report:', fileErr);
      }

      res.status(200).json({ 
        success: true,
        message: "Technical issue report submitted successfully",
        reportId: webhookData.reportId
      });

    } catch (error) {
      console.error('Error submitting technical issue report:', error);
      res.status(500).json({ 
        success: false,
        message: "Failed to submit technical issue report. Please try again later.",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Live homepage stats endpoint
  app.get("/api/stats/home-live", async (req, res) => {
    try {
      const tenantPool = (req as any).tenantPool;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const trainingWindowStart = new Date(now.getTime() - 30 * 60 * 1000);

      const [allUsers, allMeals, allWorkoutSessions] = tenantPool
        ? await Promise.all([
            tenantPool.query('SELECT * FROM users').then((result) => result.rows.map(mapTenantRow)),
            tenantPool.query('SELECT * FROM meals').then((result) => result.rows.map(mapTenantRow)),
            tenantPool.query('SELECT * FROM workout_sessions').then((result) => result.rows.map(mapTenantRow)),
          ])
        : await Promise.all([
            db.select().from(users),
            db.select().from(meals),
            db.select().from(workoutSessions),
          ]);

      const usersTrainingNow = allUsers.filter((user) => {
        if (user.role !== "user") return false;
        if (!user.lastActivityAt) return false;
        return new Date(user.lastActivityAt) >= trainingWindowStart;
      }).length;

      const newMealsLast5Minutes = allMeals.filter((meal) => {
        if (!meal.date) return false;
        return new Date(meal.date) >= fiveMinutesAgo;
      }).length;

      const workoutsCompletedToday = allWorkoutSessions.filter((session) => {
        if (!session.completedAt) return false;
        return new Date(session.completedAt) >= todayStart;
      }).length;

      res.json({
        usersTrainingNow,
        newMealsLast5Minutes,
        workoutsCompletedToday,
        updatedAt: now.toISOString(),
      });
    } catch (error) {
      console.error("Error fetching homepage live stats:", error);
      res.status(500).json({ message: "Error fetching homepage live stats" });
    }
  });

  // Analytics endpoint for admin dashboard
  app.get("/api/admin/analytics", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      const tenantPool = (req as any).tenantPool;

      // Only admin can access analytics
      if ((currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
        return res.status(403).json({ message: "Access denied. Admin only." });
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisYearStart = new Date(now.getFullYear(), 0, 1);
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch all data in parallel
      const [
        allUsers,
        allMessages,
        allMeals,
        allWorkoutSessions,
        allProgress,
        allPlans,
        pointsAndStreaks,
        affiliateProductsData,
        allProductClicks
      ] = tenantPool
        ? await Promise.all([
            tenantPool.query('SELECT * FROM users').then((result) => result.rows.map(mapTenantRow)),
            tenantPool.query('SELECT * FROM messages').then((result) => result.rows.map(mapTenantRow)),
            tenantPool.query('SELECT * FROM meals').then((result) => result.rows.map(mapTenantRow)),
            tenantPool.query('SELECT * FROM workout_sessions').then((result) => result.rows.map(mapTenantRow)),
            tenantPool.query('SELECT * FROM progress').then((result) => result.rows.map(mapTenantRow)),
            tenantPool.query('SELECT * FROM user_plans').then((result) => result.rows.map(mapTenantRow)),
            tenantPool.query('SELECT * FROM user_points_and_streaks').then((result) => result.rows.map(mapTenantRow)),
            tenantPool.query('SELECT * FROM affiliate_products').then((result) => result.rows.map(mapTenantRow)),
            tenantPool.query('SELECT * FROM product_clicks').then((result) => result.rows.map(mapTenantRow)),
          ])
        : await Promise.all([
            db.select().from(users),
            db.select().from(messages),
            db.select().from(meals),
            db.select().from(workoutSessions),
            db.select().from(progress),
            db.select().from(userPlans),
            db.select().from(userPointsAndStreaks),
            db.select().from(affiliateProducts),
            db.select().from(productClicks),
          ]);

      const allCoaches = allUsers.filter(u => u.role === 'coach');
      const regularUsers = allUsers.filter(u => u.role !== 'coach' && u.role !== 'admin');
      const allGyms = allUsers.filter(u => u.role === 'gym');

      // Coaches metrics - with createdAt tracking
      const totalCoaches = allCoaches.length;
      const newCoachesToday = allCoaches.filter(c => c.createdAt && c.createdAt >= today).length;
      const newCoachesThisWeek = allCoaches.filter(c => c.createdAt && c.createdAt >= thisWeekStart).length;
      const newCoachesThisMonth = allCoaches.filter(c => c.createdAt && c.createdAt >= thisMonthStart).length;
      const newCoachesThisYear = allCoaches.filter(c => c.createdAt && c.createdAt >= thisYearStart).length;

      // Users metrics - with createdAt tracking
      const totalUsers = regularUsers.length;
      const newUsersToday = regularUsers.filter(u => u.createdAt && u.createdAt >= today).length;
      const newUsersThisWeek = regularUsers.filter(u => u.createdAt && u.createdAt >= thisWeekStart).length;
      const newUsersThisMonth = regularUsers.filter(u => u.createdAt && u.createdAt >= thisMonthStart).length;
      const newUsersThisYear = regularUsers.filter(u => u.createdAt && u.createdAt >= thisYearStart).length;

      // Active users calculation
      const getActiveUsers = (timeFrame: Date) => {
        const activeUserIds = new Set<number>();
        allMessages.forEach(m => { if (m.sentAt >= timeFrame) activeUserIds.add(m.senderId); });
        allMeals.forEach(m => { if (m.date >= timeFrame) activeUserIds.add(m.userId); });
        allWorkoutSessions.forEach(w => { if (w.completedAt >= timeFrame) activeUserIds.add(w.userId); });
        allProgress.forEach(p => { if (p.date >= timeFrame) activeUserIds.add(p.userId); });
        return activeUserIds.size;
      };

      const activeUsersLast24h = getActiveUsers(last24h);
      const activeUsersLast7days = getActiveUsers(last7days);
      const activeUsersLast30days = getActiveUsers(last30days);

      // Gyms metrics - with createdAt tracking
      const totalGyms = allGyms.length;
      const newGymsToday = allGyms.filter(g => g.createdAt && g.createdAt >= today).length;
      const newGymsThisWeek = allGyms.filter(g => g.createdAt && g.createdAt >= thisWeekStart).length;
      const newGymsThisMonth = allGyms.filter(g => g.createdAt && g.createdAt >= thisMonthStart).length;
      const newGymsThisYear = allGyms.filter(g => g.createdAt && g.createdAt >= thisYearStart).length;

      // Meals metrics
      const totalMealsToday = allMeals.filter(m => m.date >= today).length;
      const totalMealsThisWeek = allMeals.filter(m => m.date >= thisWeekStart).length;
      const totalMealsThisMonth = allMeals.filter(m => m.date >= thisMonthStart).length;
      const totalMealsThisYear = allMeals.filter(m => m.date >= thisYearStart).length;

      // Most logged meal time
      const mealTypeCounts = allMeals.reduce((acc, meal) => {
        acc[meal.type] = (acc[meal.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const mostLoggedMealTime = Object.entries(mealTypeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

      // Workouts metrics
      const totalWorkoutsToday = allWorkoutSessions.filter(w => w.completedAt >= today).length;
      const totalWorkoutsThisWeek = allWorkoutSessions.filter(w => w.completedAt >= thisWeekStart).length;
      const totalWorkoutsThisMonth = allWorkoutSessions.filter(w => w.completedAt >= thisMonthStart).length;
      const totalWorkoutsThisYear = allWorkoutSessions.filter(w => w.completedAt >= thisYearStart).length;

      // Streak and Points
      const top3Streaks = pointsAndStreaks
        .sort((a, b) => b.currentStreak - a.currentStreak)
        .slice(0, 3)
        .map(ps => {
          const user = allUsers.find(u => u.id === ps.userId);
          return {
            userId: ps.userId,
            userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            streak: ps.currentStreak
          };
        });

      const top3Points = pointsAndStreaks
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .slice(0, 3)
        .map(ps => {
          const user = allUsers.find(u => u.id === ps.userId);
          return {
            userId: ps.userId,
            userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
            points: ps.totalPoints
          };
        });

      // Plans metrics - count ALL users (including coaches/admins) to match filter behavior
      const usersWithPlans = new Set(allPlans.map(p => p.userId));
      const usersWithoutPlans = allUsers.filter(u => !usersWithPlans.has(u.id)).length;

      const plansToday = allPlans.filter(p => p.createdAt >= today).length;
      const plansThisWeek = allPlans.filter(p => p.createdAt >= thisWeekStart).length;
      const plansThisMonth = allPlans.filter(p => p.createdAt >= thisMonthStart).length;
      const plansThisYear = allPlans.filter(p => p.createdAt >= thisYearStart).length;

      // Weight logs metrics
      const weightLogsToday = allProgress.filter(p => p.date >= today && p.weight != null).length;
      const weightLogsThisWeek = allProgress.filter(p => p.date >= thisWeekStart && p.weight != null).length;
      const weightLogsThisMonth = allProgress.filter(p => p.date >= thisMonthStart && p.weight != null).length;
      const weightLogsThisYear = allProgress.filter(p => p.date >= thisYearStart && p.weight != null).length;

      // Products & Purchases - Calculate click statistics
      const productClickCounts = allProductClicks.reduce((acc, click) => {
        const key = click.affiliateProductId;
        if (!acc[key]) {
          acc[key] = {
            productId: key,
            totalClicks: 0,
            clicksToday: 0,
            clicksThisWeek: 0,
            clicksThisMonth: 0,
            clicksThisYear: 0,
            userClicks: [] as Array<{ userId: number; userName: string; whatsapp: string; clickedAt: Date }>
          };
        }
        acc[key].totalClicks++;
        if (click.clickedAt >= today) acc[key].clicksToday++;
        if (click.clickedAt >= thisWeekStart) acc[key].clicksThisWeek++;
        if (click.clickedAt >= thisMonthStart) acc[key].clicksThisMonth++;
        if (click.clickedAt >= thisYearStart) acc[key].clicksThisYear++;
        
        const user = allUsers.find(u => u.id === click.userId);
        if (user) {
          acc[key].userClicks.push({
            userId: user.id,
            userName: `${user.firstName} ${user.lastName}`,
            whatsapp: user.whatsappWithCode || 'N/A',
            clickedAt: click.clickedAt
          });
        }
        return acc;
      }, {} as Record<number, any>);

      const mostClickedLinks = Object.values(productClickCounts)
        .sort((a: any, b: any) => b.totalClicks - a.totalClicks)
        .slice(0, 10)
        .map((stats: any) => {
          const product = affiliateProductsData.find(p => p.id === stats.productId);
          return {
            id: stats.productId,
            title: product?.title || 'Unknown Product',
            url: product?.url || '',
            totalClicks: stats.totalClicks,
            clicksToday: stats.clicksToday,
            clicksThisWeek: stats.clicksThisWeek,
            clicksThisMonth: stats.clicksThisMonth,
            clicksThisYear: stats.clicksThisYear,
            userClicks: stats.userClicks
          };
        });

      // Aggregate total clicks by time period
      const totalClicksToday = allProductClicks.filter(c => c.clickedAt >= today).length;
      const totalClicksThisWeek = allProductClicks.filter(c => c.clickedAt >= thisWeekStart).length;
      const totalClicksThisMonth = allProductClicks.filter(c => c.clickedAt >= thisMonthStart).length;
      const totalClicksThisYear = allProductClicks.filter(c => c.clickedAt >= thisYearStart).length;

      // Failed logs - placeholders
      const failedMealLogs = 0;
      const failedWorkoutLogs = 0;

      // Subscription Analytics - use same logic as filter (getSubscriptionStatus)
      const subscriptionCounts = regularUsers.reduce((acc, user) => {
        const subType = user.subscriptionType || 'none';
        acc[subType] = (acc[subType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Active subscriptions: use getSubscriptionStatus to match filter behavior
      const activeSubscriptions = regularUsers.filter(u => {
        const status = getSubscriptionStatus(u.subscriptionType, u.subscriptionStartDate, u.subscriptionEndDate);
        return status === 'active';
      }).length;

      // Expired subscriptions: subscriptions that have ended
      const expiredSubscriptions = regularUsers.filter(u => {
        const status = getSubscriptionStatus(u.subscriptionType, u.subscriptionStartDate, u.subscriptionEndDate);
        return status === 'expired';
      }).length;

      // Suspended subscriptions: use getSubscriptionStatus to match filter behavior
      // This includes users with suspended and none statuses (no subscription or invalid dates)
      const suspendedSubscriptions = regularUsers.filter(u => {
        const status = getSubscriptionStatus(u.subscriptionType, u.subscriptionStartDate, u.subscriptionEndDate);
        return status === 'suspended' || status === 'none';
      }).length;

      res.json({
        coaches: {
          total: totalCoaches,
          newToday: newCoachesToday,
          newThisWeek: newCoachesThisWeek,
          newThisMonth: newCoachesThisMonth,
          newThisYear: newCoachesThisYear
        },
        users: {
          total: totalUsers,
          newToday: newUsersToday,
          newThisWeek: newUsersThisWeek,
          newThisMonth: newUsersThisMonth,
          newThisYear: newUsersThisYear,
          activeLast24h: activeUsersLast24h,
          activeLast7days: activeUsersLast7days,
          activeLast30days: activeUsersLast30days
        },
        gyms: {
          total: totalGyms,
          newToday: newGymsToday,
          newThisWeek: newGymsThisWeek,
          newThisMonth: newGymsThisMonth,
          newThisYear: newGymsThisYear
        },
        meals: {
          totalToday: totalMealsToday,
          totalThisWeek: totalMealsThisWeek,
          totalThisMonth: totalMealsThisMonth,
          totalThisYear: totalMealsThisYear,
          mostLoggedMealTime,
          mealTypeCounts
        },
        workouts: {
          totalToday: totalWorkoutsToday,
          totalThisWeek: totalWorkoutsThisWeek,
          totalThisMonth: totalWorkoutsThisMonth,
          totalThisYear: totalWorkoutsThisYear
        },
        streaksAndPoints: {
          top3Streaks,
          top3Points
        },
        plans: {
          usersWithPlans: usersWithPlans.size,
          usersWithoutPlans,
          assignedToday: plansToday,
          assignedThisWeek: plansThisWeek,
          assignedThisMonth: plansThisMonth,
          assignedThisYear: plansThisYear
        },
        weightLogs: {
          totalToday: weightLogsToday,
          totalThisWeek: weightLogsThisWeek,
          totalThisMonth: weightLogsThisMonth,
          totalThisYear: weightLogsThisYear
        },
        products: {
          mostClickedLinks,
          totalClicksToday,
          totalClicksThisWeek,
          totalClicksThisMonth,
          totalClicksThisYear,
          purchasesToday: 0,
          purchasesThisWeek: 0,
          purchasesThisMonth: 0,
          purchasesThisYear: 0
        },
        failedLogs: {
          meals: failedMealLogs,
          workouts: failedWorkoutLogs
        },
        subscriptions: {
          byCounts: subscriptionCounts,
          active: activeSubscriptions,
          expired: expiredSubscriptions,
          suspended: suspendedSubscriptions
        }
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({ message: "Error fetching analytics data" });
    }
  });

  // Record product click
  app.post("/api/product-clicks", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { affiliateProductId } = req.body;
      const userId = (req.user as any).id;
      const tenantPool = (req as any).tenantPool;

      if (!affiliateProductId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      if (tenantPool) {
        await tenantPool.query(
          'INSERT INTO product_clicks (user_id, affiliate_product_id, clicked_at) VALUES ($1, $2, $3)',
          [userId, affiliateProductId, new Date()]
        );
      } else {
        await db.insert(productClicks).values({
          userId,
          affiliateProductId,
          clickedAt: new Date()
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error recording product click:', error);
      res.status(500).json({ message: "Error recording click" });
    }
  });

  // Tenant Management - Edit Tenant Limits (Admin only)
  app.get("/api/tenants/:id", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      // Only super admins can view tenant details
      if (currentUser.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin privileges required." });
      }

      const tenantId = parseInt(req.params.id);
      if (Number.isNaN(tenantId)) {
        return res.status(400).json({ message: "Invalid tenant ID" });
      }

      // Query the tenants table directly from the database
      const result = await db.select().from(sql.raw('tenants')).where(sql.raw(`id = ${tenantId}`));
      
      if (!result || result.length === 0) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      res.json(result[0]);
    } catch (error) {
      console.error("Error fetching tenant:", error);
      res.status(500).json({ message: "Error fetching tenant details" });
    }
  });

  app.patch("/api/tenants/:id/limits", isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      
      // Only super admins can edit tenant limits
      if (currentUser.role !== 'super_admin') {
        return res.status(403).json({ message: "Access denied. Super admin privileges required." });
      }

      const tenantId = parseInt(req.params.id);
      if (Number.isNaN(tenantId)) {
        return res.status(400).json({ message: "Invalid tenant ID" });
      }

      const { maxUsers, maxStorageGb, maxApiCallsPerDay } = req.body;

      // Validate the limits data
      const updateData: Record<string, any> = {};
      
      if (maxUsers !== undefined) {
        const parsedMaxUsers = parseInt(String(maxUsers), 10);
        if (Number.isNaN(parsedMaxUsers) || parsedMaxUsers < 1) {
          return res.status(400).json({ message: "maxUsers must be a positive integer" });
        }
        updateData.max_users = parsedMaxUsers;
      }

      if (maxStorageGb !== undefined) {
        const parsedMaxStorage = parseInt(String(maxStorageGb), 10);
        if (Number.isNaN(parsedMaxStorage) || parsedMaxStorage < 1) {
          return res.status(400).json({ message: "maxStorageGb must be a positive integer" });
        }
        updateData.max_storage_gb = parsedMaxStorage;
      }

      if (maxApiCallsPerDay !== undefined) {
        const parsedMaxApi = parseInt(String(maxApiCallsPerDay), 10);
        if (Number.isNaN(parsedMaxApi) || parsedMaxApi < 1) {
          return res.status(400).json({ message: "maxApiCallsPerDay must be a positive integer" });
        }
        updateData.max_api_calls_per_day = parsedMaxApi;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No limit data to update" });
      }

      // Add updated_at timestamp
      updateData.updated_at = new Date();

      // Execute the update using raw SQL
      const updateFields = Object.entries(updateData)
        .map(([key, value]) => {
          if (value instanceof Date) {
            return `${key} = '${value.toISOString()}'`;
          }
          return `${key} = ${value}`;
        })
        .join(', ');

      const updateQuery = `UPDATE tenants SET ${updateFields} WHERE id = ${tenantId} RETURNING *`;
      const result = await db.execute(sql.raw(updateQuery));
      
      if (!result || (Array.isArray(result) && result.length === 0)) {
        return res.status(404).json({ message: "Tenant not found or update failed" });
      }

      // Fetch the updated tenant
      const fetchResult = await db.select().from(sql.raw('tenants')).where(sql.raw(`id = ${tenantId}`));
      
      if (!fetchResult || fetchResult.length === 0) {
        return res.status(500).json({ message: "Failed to retrieve updated tenant" });
      }

      res.json({
        success: true,
        message: "Tenant limits updated successfully",
        tenant: fetchResult[0]
      });
    } catch (error) {
      console.error("Error updating tenant limits:", error);
      res.status(500).json({ message: "Error updating tenant limits" });
    }
  });

  // ============================================================================
  // Ad Campaigns Management Endpoints
  // ============================================================================

  const executeAdsQuery = async (req: Request, query: string) => {
    const tenantPool = (req as any).tenantPool;
    if (tenantPool) {
      return tenantPool.query(query);
    }
    return db.execute(sql.raw(query));
  };

  const normalizeAdMediaUrls = (input: any): Array<{ url: string; type: "image" | "video" }> => {
    if (!input) return [];

    const rawItems = Array.isArray(input) ? input : [];
    return rawItems
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const rawUrl = typeof item.url === "string" ? item.url.trim() : "";
        if (!rawUrl) return null;
        const type = item.type === "video" ? "video" : "image";
        return { url: rawUrl, type } as { url: string; type: "image" | "video" };
      })
      .filter((item): item is { url: string; type: "image" | "video" } => Boolean(item));
  };

  const toJsonbLiteral = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;

  const escapeSqlText = (value: string) => value.replace(/'/g, "''");

  const toNullableIntSql = (value: unknown): string => {
    if (value === null || value === undefined || value === "") return "NULL";
    const parsed = Number.parseInt(String(value), 10);
    return Number.isNaN(parsed) ? "NULL" : `${parsed}`;
  };

  const requireAdsManager = (req: Request, res: Response, next: NextFunction) => {
    const currentUser = req.user as any;
    if (!currentUser) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (currentUser.role !== "admin" && currentUser.role !== "super_admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // ============================================================================
  // Coach Ads Routes – coaches manage only their own campaigns
  // ============================================================================

  // GET /api/coach/ads – list all campaigns created by this coach
  app.get("/api/coach/ads", isAuthenticated, isCoachOrAdmin, async (req: Request, res: Response) => {
    try {
      const currentUser = req.user as any;
      const ownerFilter = (currentUser.role === "admin" || currentUser.role === "super_admin")
        ? ""
        : `WHERE ac.created_by = ${currentUser.id}`;

      const result = await executeAdsQuery(req, `
        SELECT
          ac.*,
          u.username AS created_by_username
        FROM ad_campaigns ac
        LEFT JOIN users u ON ac.created_by = u.id
        ${ownerFilter}
        ORDER BY ac.created_at DESC
      `);

      res.json(result.rows || result);
    } catch (error) {
      console.error("Error fetching coach ad campaigns:", error);
      res.status(500).json({ message: "Error fetching ad campaigns" });
    }
  });

  // POST /api/coach/ads – create a new campaign (coach owns it)
  app.post("/api/coach/ads", isAuthenticated, isCoachOrAdmin, async (req: Request, res: Response) => {
    try {
      const currentUser = req.user as any;
      const {
        title,
        title_ar,
        description,
        description_ar,
        category_id,
        campaign_type = "general",
        status = "active",
        start_date,
        end_date,
        media_urls,
      } = req.body;

      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      const normalizedTitleAr = typeof title_ar === "string" ? title_ar.trim() : "";
      const effectiveTitle = normalizedTitle || normalizedTitleAr;

      if (!effectiveTitle) {
        return res.status(400).json({ message: "Title is required" });
      }

      const validTypes = ["offer", "educational", "event", "general"];
      if (!validTypes.includes(campaign_type)) {
        return res.status(400).json({ message: "Invalid campaign_type" });
      }

      const validStatuses = ["draft", "active", "paused", "completed", "archived"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const escapedTitle = effectiveTitle.replace(/'/g, "''");
      const escapedTitleAr = normalizedTitleAr ? normalizedTitleAr.replace(/'/g, "''") : null;
      const escapedDesc = description ? String(description).replace(/'/g, "''") : null;
      const escapedDescAr = description_ar ? String(description_ar).replace(/'/g, "''") : null;
      const mediaUrls = normalizeAdMediaUrls(media_urls);

      const query = `
        INSERT INTO ad_campaigns (
          title, title_ar, description, description_ar,
          category_id, campaign_type, status, start_date, end_date, media_urls, created_by
        ) VALUES (
          '${escapedTitle}',
          ${escapedTitleAr ? `'${escapedTitleAr}'` : "NULL"},
          ${escapedDesc ? `'${escapedDesc}'` : "NULL"},
          ${escapedDescAr ? `'${escapedDescAr}'` : "NULL"},
          ${toNullableIntSql(category_id)},
          '${campaign_type}',
          '${status}',
          ${start_date ? `'${start_date}'` : "NULL"},
          ${end_date ? `'${end_date}'` : "NULL"},
          ${toJsonbLiteral(mediaUrls)},
          ${currentUser.id}
        )
        RETURNING *
      `;

      const result = await executeAdsQuery(req, query);
      const campaign = result.rows?.[0] || result[0];

      res.status(201).json({ success: true, campaign });
    } catch (error) {
      console.error("Error creating coach ad campaign:", error);
      res.status(500).json({ message: "Error creating ad campaign" });
    }
  });

  // PUT /api/coach/ads/:id – update own campaign
  app.put("/api/coach/ads/:id", isAuthenticated, isCoachOrAdmin, async (req: Request, res: Response) => {
    try {
      const currentUser = req.user as any;
      const { id } = req.params;

      // Verify ownership
      const checkResult = await executeAdsQuery(req, `
        SELECT id, created_by FROM ad_campaigns WHERE id = ${id}
      `);
      const existing = checkResult.rows?.[0] || checkResult[0];
      if (!existing) {
        return res.status(404).json({ message: "Ad campaign not found" });
      }
      if ((currentUser.role !== "admin" && currentUser.role !== "super_admin") && existing.created_by !== currentUser.id) {
        return res.status(403).json({ message: "Not authorized to edit this campaign" });
      }

      const {
        title, title_ar, description, description_ar,
        category_id, campaign_type, status, start_date, end_date,
        media_urls,
      } = req.body;

      const updateFields: string[] = [];
      if (title !== undefined) {
        const t = String(title).trim();
        if (t) updateFields.push(`title = '${t.replace(/'/g, "''")}'`);
      }
      if (title_ar !== undefined) updateFields.push(`title_ar = ${title_ar ? `'${String(title_ar).replace(/'/g, "''")}'` : "NULL"}`);
      if (description !== undefined) updateFields.push(`description = ${description ? `'${String(description).replace(/'/g, "''")}'` : "NULL"}`);
      if (description_ar !== undefined) updateFields.push(`description_ar = ${description_ar ? `'${String(description_ar).replace(/'/g, "''")}'` : "NULL"}`);
      if (category_id !== undefined) updateFields.push(`category_id = ${toNullableIntSql(category_id)}`);
      if (campaign_type !== undefined) updateFields.push(`campaign_type = '${campaign_type}'`);
      if (status !== undefined) updateFields.push(`status = '${status}'`);
      if (start_date !== undefined) updateFields.push(`start_date = ${start_date ? `'${start_date}'` : "NULL"}`);
      if (end_date !== undefined) updateFields.push(`end_date = ${end_date ? `'${end_date}'` : "NULL"}`);
      if (media_urls !== undefined) updateFields.push(`media_urls = ${toJsonbLiteral(normalizeAdMediaUrls(media_urls))}`);
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      if (updateFields.length === 1) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const result = await executeAdsQuery(req, `
        UPDATE ad_campaigns
        SET ${updateFields.join(", ")}
        WHERE id = ${id}
        RETURNING *
      `);

      const campaign = result.rows?.[0] || result[0];
      res.json({ success: true, campaign });
    } catch (error) {
      console.error("Error updating coach ad campaign:", error);
      res.status(500).json({ message: "Error updating ad campaign" });
    }
  });

  // DELETE /api/coach/ads/:id – delete own campaign
  app.delete("/api/coach/ads/:id", isAuthenticated, isCoachOrAdmin, async (req: Request, res: Response) => {
    try {
      const currentUser = req.user as any;
      const { id } = req.params;

      const checkResult = await executeAdsQuery(req, `
        SELECT id, created_by FROM ad_campaigns WHERE id = ${id}
      `);
      const existing = checkResult.rows?.[0] || checkResult[0];
      if (!existing) {
        return res.status(404).json({ message: "Ad campaign not found" });
      }
      if ((currentUser.role !== "admin" && currentUser.role !== "super_admin") && existing.created_by !== currentUser.id) {
        return res.status(403).json({ message: "Not authorized to delete this campaign" });
      }

      await executeAdsQuery(req, `DELETE FROM ad_campaigns WHERE id = ${id}`);
      res.json({ success: true, message: "Ad campaign deleted" });
    } catch (error) {
      console.error("Error deleting coach ad campaign:", error);
      res.status(500).json({ message: "Error deleting ad campaign" });
    }
  });

  // Get all ad campaigns
  app.get("/api/admin/ads", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const result = await executeAdsQuery(req, `
        SELECT 
          ac.*,
          u.username as created_by_username,
          mc.name_en as category_name_en,
          mc.name_ar as category_name_ar,
          (SELECT COUNT(*) FROM ad_placements WHERE campaign_id = ac.id) as placements_count
        FROM ad_campaigns ac
        LEFT JOIN users u ON ac.created_by = u.id
        LEFT JOIN marketing_categories mc ON ac.category_id = mc.id
        ORDER BY ac.created_at DESC
      `);
      
      res.json(result.rows || result);
    } catch (error) {
      console.error("Error fetching ad campaigns:", error);
      res.status(500).json({ message: "Error fetching ad campaigns" });
    }
  });

  // Get single ad campaign by ID
  app.get("/api/admin/ads/:id", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await executeAdsQuery(req, `
        SELECT 
          ac.*,
          u.username as created_by_username,
          mc.name_en as category_name_en,
          mc.name_ar as category_name_ar,
          (SELECT COUNT(*) FROM ad_placements WHERE campaign_id = ac.id) as placements_count,
          (SELECT json_agg(ap.*) FROM ad_placements ap WHERE ap.campaign_id = ac.id) as placements
        FROM ad_campaigns ac
        LEFT JOIN users u ON ac.created_by = u.id
        LEFT JOIN marketing_categories mc ON ac.category_id = mc.id
        WHERE ac.id = ${id}
      `);
      
      const campaign = result.rows?.[0] || result[0];
      if (!campaign) {
        return res.status(404).json({ message: "Ad campaign not found" });
      }
      
      res.json(campaign);
    } catch (error) {
      console.error("Error fetching ad campaign:", error);
      res.status(500).json({ message: "Error fetching ad campaign" });
    }
  });

  // Create new ad campaign
  app.post("/api/admin/ads", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const {
        title,
        title_ar,
        description,
        description_ar,
        category_id,
        campaign_type,
        status = 'active',
        target_segments,
        start_date,
        end_date,
        timezone = 'Asia/Riyadh',
        daily_budget,
        total_budget,
        media_urls,
      } = req.body;

      const normalizedTitle = typeof title === "string" ? title.trim() : "";
      const normalizedTitleAr = typeof title_ar === "string" ? title_ar.trim() : "";
      const effectiveTitle = normalizedTitle || normalizedTitleAr;

      // Validation
      if (!effectiveTitle || !campaign_type) {
        return res.status(400).json({ message: "Title or Arabic title and campaign_type are required" });
      }

      const validTypes = ['offer', 'educational', 'event', 'general'];
      if (!validTypes.includes(campaign_type)) {
        return res.status(400).json({ message: "Invalid campaign_type" });
      }

      const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Get user ID from session
      const userId = (req as any).user?.id || null;

      // Build SQL query with proper escaping
      const escapedTitle = effectiveTitle.replace(/'/g, "''");
      const escapedTitleAr = normalizedTitleAr ? normalizedTitleAr.replace(/'/g, "''") : null;
      const escapedDesc = description ? description.replace(/'/g, "''") : null;
      const escapedDescAr = description_ar ? description_ar.replace(/'/g, "''") : null;
      const targetSegmentsJson = target_segments ? JSON.stringify(target_segments).replace(/'/g, "''") : null;
      const mediaUrls = normalizeAdMediaUrls(media_urls);

      let query = `
        INSERT INTO ad_campaigns (
          title, title_ar, description, description_ar,
          category_id, campaign_type, status, target_segments,
          start_date, end_date, timezone,
          daily_budget, total_budget, media_urls, created_by
        ) VALUES (
          '${escapedTitle}',
          ${escapedTitleAr ? `'${escapedTitleAr}'` : 'NULL'},
          ${escapedDesc ? `'${escapedDesc}'` : 'NULL'},
          ${escapedDescAr ? `'${escapedDescAr}'` : 'NULL'},
          ${toNullableIntSql(category_id)},
          '${campaign_type}',
          '${status}',
          ${targetSegmentsJson ? `'${targetSegmentsJson}'::jsonb` : 'NULL'},
          ${start_date ? `'${start_date}'` : 'NULL'},
          ${end_date ? `'${end_date}'` : 'NULL'},
          '${timezone}',
          ${daily_budget ? daily_budget : 'NULL'},
          ${total_budget ? total_budget : 'NULL'},
          ${toJsonbLiteral(mediaUrls)},
          ${userId ? userId : 'NULL'}
        )
        RETURNING *
      `;

      const result = await executeAdsQuery(req, query);

      const campaign = result.rows?.[0] || result[0];
      res.status(201).json({
        success: true,
        message: "Ad campaign created successfully",
        campaign
      });
    } catch (error) {
      console.error("Error creating ad campaign:", error);
      res.status(500).json({ message: "Error creating ad campaign" });
    }
  });

  // Update ad campaign
  app.put("/api/admin/ads/:id", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        title,
        title_ar,
        description,
        description_ar,
        category_id,
        campaign_type,
        status,
        target_segments,
        start_date,
        end_date,
        timezone,
        daily_budget,
        total_budget,
        media_urls,
      } = req.body;

      const updateFields: string[] = [];
      const normalizedTitle = typeof title === "string" ? title.trim() : title;
      const normalizedTitleAr = typeof title_ar === "string" ? title_ar.trim() : title_ar;
      
      if (title !== undefined) {
        let titleToSet = normalizedTitle;
        if ((!titleToSet || titleToSet === "") && normalizedTitleAr) {
          titleToSet = normalizedTitleAr;
        }
        if (!titleToSet) {
          return res.status(400).json({ message: "Title or Arabic title is required" });
        }
        updateFields.push(`title = '${titleToSet.replace(/'/g, "''")}'`);
      }
      if (title_ar !== undefined) updateFields.push(`title_ar = ${normalizedTitleAr ? `'${normalizedTitleAr.replace(/'/g, "''")}'` : 'NULL'}`);
      if (description !== undefined) updateFields.push(`description = ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'}`);
      if (description_ar !== undefined) updateFields.push(`description_ar = ${description_ar ? `'${description_ar.replace(/'/g, "''")}'` : 'NULL'}`);
      if (category_id !== undefined) updateFields.push(`category_id = ${toNullableIntSql(category_id)}`);
      if (campaign_type !== undefined) updateFields.push(`campaign_type = '${campaign_type}'`);
      if (status !== undefined) updateFields.push(`status = '${status}'`);
      if (target_segments !== undefined) updateFields.push(`target_segments = ${target_segments ? `'${JSON.stringify(target_segments)}'::jsonb` : 'NULL'}`);
      if (start_date !== undefined) updateFields.push(`start_date = ${start_date ? `'${start_date}'` : 'NULL'}`);
      if (end_date !== undefined) updateFields.push(`end_date = ${end_date ? `'${end_date}'` : 'NULL'}`);
      if (timezone !== undefined) updateFields.push(`timezone = '${timezone}'`);
      if (daily_budget !== undefined) updateFields.push(`daily_budget = ${daily_budget || 'NULL'}`);
      if (total_budget !== undefined) updateFields.push(`total_budget = ${total_budget || 'NULL'}`);
      if (media_urls !== undefined) updateFields.push(`media_urls = ${toJsonbLiteral(normalizeAdMediaUrls(media_urls))}`);
      
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

      if (updateFields.length === 1) { // only updated_at
        return res.status(400).json({ message: "No fields to update" });
      }

      const result = await executeAdsQuery(req, `
        UPDATE ad_campaigns 
        SET ${updateFields.join(', ')}
        WHERE id = ${id}
        RETURNING *
      `);

      const campaign = result.rows?.[0] || result[0];
      if (!campaign) {
        return res.status(404).json({ message: "Ad campaign not found" });
      }

      res.json({
        success: true,
        message: "Ad campaign updated successfully",
        campaign
      });
    } catch (error) {
      console.error("Error updating ad campaign:", error);
      res.status(500).json({ message: "Error updating ad campaign" });
    }
  });

  // Delete ad campaign
  app.delete("/api/admin/ads/:id", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await executeAdsQuery(req, `
        DELETE FROM ad_campaigns WHERE id = ${id} RETURNING id
      `);

      const deleted = result.rows?.[0] || result[0];
      if (!deleted) {
        return res.status(404).json({ message: "Ad campaign not found" });
      }

      res.json({
        success: true,
        message: "Ad campaign deleted successfully"
      });
    } catch (error) {
      console.error("Error deleting ad campaign:", error);
      res.status(500).json({ message: "Error deleting ad campaign" });
    }
  });

  // Get campaign statistics
  app.get("/api/admin/ads/:id/stats", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const result = await executeAdsQuery(req, `
        SELECT 
          ac.id,
          ac.title,
          ac.status,
          ac.total_impressions,
          ac.total_clicks,
          ac.total_conversions,
          ac.total_budget,
          ac.total_spent,
          CASE 
            WHEN ac.total_impressions > 0 
            THEN ROUND((ac.total_clicks::decimal / ac.total_impressions) * 100, 2)
            ELSE 0 
          END as ctr,
          CASE 
            WHEN ac.total_clicks > 0 
            THEN ROUND((ac.total_conversions::decimal / ac.total_clicks) * 100, 2)
            ELSE 0 
          END as conversion_rate,
          (SELECT COUNT(*) FROM ad_placements WHERE campaign_id = ac.id AND is_active = true) as active_placements
        FROM ad_campaigns ac
        WHERE ac.id = ${id}
      `);

      const stats = result.rows?.[0] || result[0];
      if (!stats) {
        return res.status(404).json({ message: "Ad campaign not found" });
      }

      res.json(stats);
    } catch (error) {
      console.error("Error fetching campaign stats:", error);
      res.status(500).json({ message: "Error fetching campaign stats" });
    }
  });

  // Get marketing categories used by ads and announcements
  app.get("/api/ads-management/categories", async (req: Request, res: Response) => {
    try {
      const includeInactive = String(req.query.includeInactive || "false") === "true";
      const activeFilter = includeInactive ? "" : "WHERE is_active = true";
      const result = await executeAdsQuery(req, `
        SELECT *
        FROM marketing_categories
        ${activeFilter}
        ORDER BY display_order ASC, id ASC
      `);
      res.json(result.rows || result);
    } catch (error) {
      console.error("Error fetching marketing categories:", error);
      res.status(500).json({ message: "Error fetching categories" });
    }
  });

  app.post("/api/admin/ads-management/categories", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const nameEn = String(req.body?.nameEn || "").trim();
      const nameAr = String(req.body?.nameAr || "").trim();
      const displayOrder = Number.parseInt(String(req.body?.displayOrder ?? "0"), 10) || 0;
      const isActive = req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true;

      if (!nameEn || !nameAr) {
        return res.status(400).json({ message: "nameEn and nameAr are required" });
      }

      const inputSlug = String(req.body?.slug || "").trim().toLowerCase();
      const slug = (inputSlug || nameEn)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || `category-${Date.now()}`;

      const result = await executeAdsQuery(req, `
        INSERT INTO marketing_categories (name_en, name_ar, slug, is_active, display_order)
        VALUES ('${escapeSqlText(nameEn)}', '${escapeSqlText(nameAr)}', '${escapeSqlText(slug)}', ${isActive}, ${displayOrder})
        RETURNING *
      `);
      const row = result.rows?.[0] || result[0];
      res.status(201).json(row);
    } catch (error) {
      console.error("Error creating marketing category:", error);
      res.status(500).json({ message: "Error creating category" });
    }
  });

  app.put("/api/admin/ads-management/categories/:id", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid category id" });
      }

      const updates: string[] = [];
      if (req.body?.nameEn !== undefined) updates.push(`name_en = '${escapeSqlText(String(req.body.nameEn).trim())}'`);
      if (req.body?.nameAr !== undefined) updates.push(`name_ar = '${escapeSqlText(String(req.body.nameAr).trim())}'`);
      if (req.body?.slug !== undefined) {
        const slug = String(req.body.slug).trim().toLowerCase();
        updates.push(`slug = '${escapeSqlText(slug)}'`);
      }
      if (req.body?.isActive !== undefined) updates.push(`is_active = ${Boolean(req.body.isActive)}`);
      if (req.body?.displayOrder !== undefined) {
        const displayOrder = Number.parseInt(String(req.body.displayOrder), 10) || 0;
        updates.push(`display_order = ${displayOrder}`);
      }
      updates.push("updated_at = NOW()");

      if (updates.length <= 1) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const result = await executeAdsQuery(req, `
        UPDATE marketing_categories
        SET ${updates.join(", ")}
        WHERE id = ${id}
        RETURNING *
      `);
      const row = result.rows?.[0] || result[0];
      if (!row) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.json(row);
    } catch (error) {
      console.error("Error updating marketing category:", error);
      res.status(500).json({ message: "Error updating category" });
    }
  });

  app.delete("/api/admin/ads-management/categories/:id", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid category id" });
      }
      const result = await executeAdsQuery(req, `
        DELETE FROM marketing_categories WHERE id = ${id} RETURNING id
      `);
      const row = result.rows?.[0] || result[0];
      if (!row) {
        return res.status(404).json({ message: "Category not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting marketing category:", error);
      res.status(500).json({ message: "Error deleting category" });
    }
  });

  // Admin announcements management
  app.get("/api/admin/announcements", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const result = await executeAdsQuery(req, `
        SELECT
          a.*,
          mc.name_en as category_name_en,
          mc.name_ar as category_name_ar,
          u.username as created_by_username
        FROM announcements a
        LEFT JOIN marketing_categories mc ON mc.id = a.category_id
        LEFT JOIN users u ON u.id = a.created_by
        ORDER BY a.sort_order ASC, a.updated_at DESC
      `);
      res.json(result.rows || result);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ message: "Error fetching announcements" });
    }
  });

  app.post("/api/admin/announcements", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const currentUser = req.user as any;
      const titleEn = String(req.body?.titleEn || "").trim();
      const titleAr = String(req.body?.titleAr || "").trim();
      const categoryId = toNullableIntSql(req.body?.categoryId);
      const status = String(req.body?.status || "active").toLowerCase() === "inactive" ? "inactive" : "active";
      const enabled = req.body?.enabled !== undefined ? Boolean(req.body.enabled) : true;
      const showInTopBar = req.body?.showInTopBar !== undefined ? Boolean(req.body.showInTopBar) : false;
      const sortOrder = Number.parseInt(String(req.body?.sortOrder ?? "0"), 10) || 0;

      if (!titleEn || !titleAr) {
        return res.status(400).json({ message: "titleEn and titleAr are required" });
      }

      const result = await executeAdsQuery(req, `
        INSERT INTO announcements (
          title_en, title_ar, category_id, status, enabled, show_in_top_bar, sort_order, created_by
        ) VALUES (
          '${escapeSqlText(titleEn)}',
          '${escapeSqlText(titleAr)}',
          ${categoryId},
          '${status}',
          ${enabled},
          ${showInTopBar},
          ${sortOrder},
          ${currentUser?.id ? Number.parseInt(String(currentUser.id), 10) : "NULL"}
        )
        RETURNING *
      `);
      const row = result.rows?.[0] || result[0];
      res.status(201).json(row);
    } catch (error) {
      console.error("Error creating announcement:", error);
      res.status(500).json({ message: "Error creating announcement" });
    }
  });

  app.put("/api/admin/announcements/:id", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid announcement id" });
      }

      const updates: string[] = [];
      if (req.body?.titleEn !== undefined) updates.push(`title_en = '${escapeSqlText(String(req.body.titleEn).trim())}'`);
      if (req.body?.titleAr !== undefined) updates.push(`title_ar = '${escapeSqlText(String(req.body.titleAr).trim())}'`);
      if (req.body?.categoryId !== undefined) updates.push(`category_id = ${toNullableIntSql(req.body.categoryId)}`);
      if (req.body?.status !== undefined) {
        const status = String(req.body.status).toLowerCase() === "inactive" ? "inactive" : "active";
        updates.push(`status = '${status}'`);
      }
      if (req.body?.enabled !== undefined) updates.push(`enabled = ${Boolean(req.body.enabled)}`);
      if (req.body?.showInTopBar !== undefined) updates.push(`show_in_top_bar = ${Boolean(req.body.showInTopBar)}`);
      if (req.body?.sortOrder !== undefined) {
        const sortOrder = Number.parseInt(String(req.body.sortOrder), 10) || 0;
        updates.push(`sort_order = ${sortOrder}`);
      }
      updates.push("updated_at = NOW()");

      if (updates.length <= 1) {
        return res.status(400).json({ message: "No fields to update" });
      }

      const result = await executeAdsQuery(req, `
        UPDATE announcements
        SET ${updates.join(", ")}
        WHERE id = ${id}
        RETURNING *
      `);
      const row = result.rows?.[0] || result[0];
      if (!row) {
        return res.status(404).json({ message: "Announcement not found" });
      }
      res.json(row);
    } catch (error) {
      console.error("Error updating announcement:", error);
      res.status(500).json({ message: "Error updating announcement" });
    }
  });

  app.delete("/api/admin/announcements/:id", isAuthenticated, requireAdsManager, async (req: Request, res: Response) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "Invalid announcement id" });
      }
      const result = await executeAdsQuery(req, `
        DELETE FROM announcements WHERE id = ${id} RETURNING id
      `);
      const row = result.rows?.[0] || result[0];
      if (!row) {
        return res.status(404).json({ message: "Announcement not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting announcement:", error);
      res.status(500).json({ message: "Error deleting announcement" });
    }
  });

  // Public top-bar announcements
  app.get("/api/announcements/top-bar", async (req: Request, res: Response) => {
    try {
      const result = await executeAdsQuery(req, `
        SELECT
          a.id,
          a.title_en,
          a.title_ar,
          a.sort_order,
          a.updated_at,
          a.category_id,
          mc.name_en as category_name_en,
          mc.name_ar as category_name_ar
        FROM announcements a
        LEFT JOIN marketing_categories mc ON mc.id = a.category_id
        WHERE a.status = 'active'
          AND a.enabled = true
          AND a.show_in_top_bar = true
        ORDER BY a.sort_order ASC, a.updated_at DESC
      `);
      res.json(result.rows || result);
    } catch (error) {
      console.error("Error fetching top bar announcements:", error);
      res.status(500).json({ message: "Error fetching announcements" });
    }
  });

  // Public ads listing used by /ads page and homepage section
  app.get("/api/ads/public", async (req: Request, res: Response) => {
    try {
      const searchRaw = String(req.query.search || "").trim();
      const categoryId = Number.parseInt(String(req.query.categoryId || ""), 10);
      const limitRaw = Number.parseInt(String(req.query.limit || "24"), 10);
      const limit = Number.isNaN(limitRaw) ? 24 : Math.max(1, Math.min(96, limitRaw));

      const whereParts = [
        "ac.status = 'active'",
        "(ac.start_date IS NULL OR ac.start_date <= NOW())",
        "(ac.end_date IS NULL OR ac.end_date >= NOW())",
      ];

      if (!Number.isNaN(categoryId)) {
        whereParts.push(`ac.category_id = ${categoryId}`);
      }

      if (searchRaw) {
        const search = escapeSqlText(searchRaw.toLowerCase());
        whereParts.push(`(
          LOWER(COALESCE(ac.title, '')) LIKE '%${search}%'
          OR LOWER(COALESCE(ac.title_ar, '')) LIKE '%${search}%'
          OR LOWER(COALESCE(ac.description, '')) LIKE '%${search}%'
          OR LOWER(COALESCE(ac.description_ar, '')) LIKE '%${search}%'
        )`);
      }

      const result = await executeAdsQuery(req, `
        SELECT
          ac.id,
          ac.title,
          ac.title_ar,
          ac.description,
          ac.description_ar,
          ac.media_urls,
          ac.campaign_type,
          ac.status,
          ac.start_date,
          ac.end_date,
          ac.category_id,
          mc.name_en as category_name_en,
          mc.name_ar as category_name_ar,
          ac.created_at
        FROM ad_campaigns ac
        LEFT JOIN marketing_categories mc ON mc.id = ac.category_id
        WHERE ${whereParts.join(" AND ")}
        ORDER BY ac.created_at DESC
        LIMIT ${limit}
      `);
      res.json(result.rows || result);
    } catch (error) {
      console.error("Error fetching public ads:", error);
      res.status(500).json({ message: "Error fetching ads" });
    }
  });

  // Public ad details endpoint used by /ads/:id page
  app.get("/api/ads/public/:id", async (req: Request, res: Response) => {
    try {
      const adId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(adId)) {
        return res.status(400).json({ message: "Invalid ad id" });
      }

      const result = await executeAdsQuery(req, `
        SELECT
          ac.id,
          ac.title,
          ac.title_ar,
          ac.description,
          ac.description_ar,
          ac.media_urls,
          ac.campaign_type,
          ac.status,
          ac.start_date,
          ac.end_date,
          ac.category_id,
          mc.name_en as category_name_en,
          mc.name_ar as category_name_ar,
          ac.created_at,
          ac.updated_at
        FROM ad_campaigns ac
        LEFT JOIN marketing_categories mc ON mc.id = ac.category_id
        WHERE ac.id = ${adId}
          AND ac.status = 'active'
          AND (ac.start_date IS NULL OR ac.start_date <= NOW())
          AND (ac.end_date IS NULL OR ac.end_date >= NOW())
        LIMIT 1
      `);

      const row = (result.rows || result)?.[0];
      if (!row) {
        return res.status(404).json({ message: "Ad not found" });
      }

      return res.json(row);
    } catch (error) {
      console.error("Error fetching public ad details:", error);
      return res.status(500).json({ message: "Error fetching ad details" });
    }
  });

  // Get active ads for users (public/authenticated)
  app.get("/api/ads/active", async (req: Request, res: Response) => {
    try {
      const result = await executeAdsQuery(req, `
        SELECT 
          ac.id,
          ac.title,
          ac.title_ar,
          ac.description,
          ac.description_ar,
          ac.media_urls,
          ac.campaign_type,
          ac.start_date,
          ac.end_date,
          ac.category_id,
          mc.name_en as category_name_en,
          mc.name_ar as category_name_ar
        FROM ad_campaigns ac
        LEFT JOIN marketing_categories mc ON mc.id = ac.category_id
        WHERE ac.status = 'active'
          AND (ac.start_date IS NULL OR ac.start_date <= NOW())
          AND (ac.end_date IS NULL OR ac.end_date >= NOW())
        ORDER BY ac.created_at DESC
        LIMIT 5
      `);
      
      res.json(result.rows || result);
    } catch (error) {
      console.error("Error fetching active ads:", error);
      res.status(500).json({ message: "Error fetching active ads" });
    }
  });

  // Food Database routes are now handled by foodRouter

  const httpServer = createServer(app);
  return httpServer;
}
