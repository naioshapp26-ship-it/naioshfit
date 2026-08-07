/**
 * Epic E: AI Assistant Routes
 * 
 * Implements:
 * - E1: Basic Assistant (Q&A, guidance, automated support)
 * - E2: Advanced Assistant (behavior analysis, risk prediction, auto-personalization)
 * - E3: Escalation (routing complex cases to experts)
 */

import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";
import type { Pool } from "pg";
import { 
  aiConversations, 
  aiInsights, 
  aiPlanSuggestions, 
  escalationRequests,
  users,
  supplementSideEffects,
  missedWorkouts,
  notifications,
  insertAiConversationSchema,
  insertAiInsightSchema,
  insertAiPlanSuggestionSchema,
  insertEscalationRequestSchema,
  workoutSessions,
  meals,
  progress,
  supplementRecommendations,
} from "../shared/schema";
import { eq, and, desc, gte, lte, or, isNull, sql, SQL } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";
import { getInsufficientCreditsMessage } from "./utils/i18n";
import {
  buildAiNotConfiguredResponse,
  getAiFeatureConfig,
  getAiSettingsForRequest,
  type AiFeatureSettings,
} from "./aiSettings";
import {
  buildScopeFromRequest,
  consumeCredits,
  getOrCreateAccountWithBalance,
} from "./services/creditBilling";
import { isPlatformAdminRole } from "../shared/roleAccess";

const isCoachOrPlatformAdmin = (role: string | undefined) => role === 'coach' || isPlatformAdminRole(role);

const resolveAiDb = (req: Request) => {
  const tenantPool = (req as any)?.tenantPool;
  if (tenantPool) {
    return drizzle(tenantPool, { schema });
  }
  return db;
};

const resolveTenantPool = (req: Request) => (req as any)?.tenantPool as Pool | undefined;

const hasRelation = async (tenantPool: Pool | undefined, relation: string) => {
  if (!tenantPool) return true;
  const result = await tenantPool.query('SELECT to_regclass($1) as reg', [relation]);
  return Boolean(result.rows?.[0]?.reg);
};

// ============================================================
// E1: BASIC ASSISTANT - Q&A, Guidance, Support
// ============================================================

/**
 * POST /api/ai-assistant/ask
 * Ask the AI assistant a question
 * User access only
 */
export function askAssistant(app: Express) {
  app.post("/api/ai-assistant/ask", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { question, language = 'en' } = req.body;
      
      if (!question || typeof question !== 'string') {
        return res.status(400).json({ error: "Question is required" });
      }

      const canStoreConversations = await hasRelation(tenantPool, 'ai_conversations');

      let userMessage: any = {
        id: null,
        userId,
        messageType: 'question',
        messageText: question,
        language: language as 'en' | 'ar',
        contextData: {},
      };

      if (canStoreConversations) {
        [userMessage] = await database.insert(aiConversations).values({
          userId,
          messageType: 'question',
          messageText: question,
          language: language as 'en' | 'ar',
          contextData: {}, // In real implementation, gather user context
        }).returning();
      }

      // Simulate AI response (in production, call actual AI service)
      const answer = await generateAiResponse(userId, question, language);
      
      let aiMessage: any = {
        id: null,
        userId,
        messageType: answer.type,
        messageText: answer.text,
        messageTextAr: answer.textAr,
        confidenceScore: answer.confidence,
        language: language as 'en' | 'ar',
        contextData: answer.context,
      };

      if (canStoreConversations) {
        [aiMessage] = await database.insert(aiConversations).values({
          userId,
          messageType: answer.type,
          messageText: answer.text,
          messageTextAr: answer.textAr,
          confidenceScore: answer.confidence,
          language: language as 'en' | 'ar',
          contextData: answer.context,
        }).returning();
      }

      // Check if escalation needed
      if (answer.shouldEscalate && aiMessage.id) {
        await createAutoEscalation(database, tenantPool, userId, aiMessage.id, answer.escalationReason || 'Medical concern detected');
      }

      res.json({
        question: userMessage,
        answer: aiMessage,
        needsEscalation: answer.shouldEscalate,
      });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * GET /api/ai-assistant/conversations
 * Get user's conversation history
 */
export function getConversations(app: Express) {
  app.get("/api/ai-assistant/conversations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const canReadConversations = await hasRelation(tenantPool, 'ai_conversations');
      if (!canReadConversations) {
        return res.json({ conversations: [] });
      }

      const conversations = await database.select()
        .from(aiConversations)
        .where(eq(aiConversations.userId, userId))
        .orderBy(desc(aiConversations.createdAt))
        .limit(limit)
        .offset(offset);

      res.json({ conversations });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * GET /api/ai-assistant/guidance
 * Get contextual guidance for user
 */
export function getGuidance(app: Express) {
  app.get("/api/ai-assistant/guidance", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Get user profile
      const [user] = await database.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Generate contextual guidance based on user state
      const guidance = await generateContextualGuidance(user);

      // Store guidance message
      const canStoreGuidance = await hasRelation(tenantPool, 'ai_conversations');
      if (!canStoreGuidance) {
        return res.json({ guidance });
      }

      const [guidanceMessage] = await database.insert(aiConversations).values({
        userId,
        messageType: 'guidance',
        messageText: guidance.text,
        messageTextAr: guidance.textAr,
        language: user.preferredLanguage as 'en' | 'ar' || 'en',
        contextData: guidance.context,
      }).returning();

      res.json({ guidance: guidanceMessage });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * DELETE /api/ai-assistant/conversations/:id
 * Delete a conversation message
 */
export function deleteConversation(app: Express) {
  app.delete("/api/ai-assistant/conversations/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const conversationId = parseInt(req.params.id);
      if (isNaN(conversationId)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
      }

      const canDeleteConversations = await hasRelation(tenantPool, 'ai_conversations');
      if (!canDeleteConversations) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const [conversation] = await database.select()
        .from(aiConversations)
        .where(and(
          eq(aiConversations.id, conversationId),
          eq(aiConversations.userId, userId)
        ));

      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      await database.delete(aiConversations).where(eq(aiConversations.id, conversationId));

      res.json({ message: "Conversation deleted successfully" });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * GET /api/ai-assistant/troubleshoot
 * Automated troubleshooting assistance
 */
export function getTroubleshooting(app: Express) {
  app.get("/api/ai-assistant/troubleshoot", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const issue = req.query.issue as string;
      
      const troubleshootingGuide = await generateTroubleshootingGuide(userId, issue);

      res.json({ guide: troubleshootingGuide });
    } catch (error) {
      next(error);
    }
  });
}

// ============================================================
// E2: ADVANCED ASSISTANT - Insights, Analysis, Suggestions
// ============================================================

/**
 * GET /api/ai-insights
 * Get user's AI insights
 */
export function getInsights(app: Express) {
  app.get("/api/ai-insights", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const insightType = req.query.type as string;
      const isActive = req.query.active !== 'false';

      const conditions: SQL[] = [eq(aiInsights.userId, userId)];
      
      if (insightType) {
        conditions.push(eq(aiInsights.insightType, insightType as any));
      }
      
      if (isActive) {
        conditions.push(eq(aiInsights.isActive, true));
      }

      const hasInsights = await hasRelation(tenantPool, 'ai_insights');
      if (!hasInsights) {
        return res.json({ insights: [] });
      }

      const insights = await database.select()
        .from(aiInsights)
        .where(and(...conditions))
        .orderBy(desc(aiInsights.createdAt));

      res.json({ insights });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * POST /api/ai-insights/analyze
 * Trigger behavior analysis and risk prediction
 * Admin/Coach access
 */
export function analyzeUserBehavior(app: Express) {
  app.post("/api/ai-insights/analyze", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const requesterId = (req as any).user?.id;
      const requesterRole = (req as any).user?.role;
      
      if (!requesterId || !isCoachOrPlatformAdmin(requesterRole)) {
        return res.status(403).json({ error: "Admin or Coach access required" });
      }

      const { userId } = req.body;
      
      if (!userId || typeof userId !== 'number') {
        return res.status(400).json({ error: "User ID is required" });
      }

      // Check if requester is the user's coach (if role is coach)
      if (requesterRole === 'coach') {
        const [targetUser] = await database.select().from(users).where(eq(users.id, userId));
        if (!targetUser || targetUser.coachId !== requesterId) {
          return res.status(403).json({ error: "You can only analyze your trainees" });
        }
      }

      const hasInsights = await hasRelation(tenantPool, 'ai_insights');
      if (!hasInsights) {
        return res.status(503).json({ error: 'AI insights not available for this tenant' });
      }

      // Perform behavior analysis
      const analysisResults = await performBehaviorAnalysis(userId);

      // Store insights
      const insights = [];
      for (const result of analysisResults) {
        const [insight] = await database.insert(aiInsights).values({
          userId,
          insightType: result.type,
          title: result.title,
          titleAr: result.titleAr,
          description: result.description,
          descriptionAr: result.descriptionAr,
          keySignals: result.keySignals,
          confidenceScore: result.confidence,
          riskLevel: result.riskLevel,
          trend: result.trend,
          language: 'en',
          isActive: true,
          expiresAt: result.expiresAt,
        }).returning();
        
        insights.push(insight);

        // Auto-escalate if high/critical risk
        if (result.riskLevel && ['high', 'critical'].includes(result.riskLevel)) {
          await createRiskEscalation(database, tenantPool, userId, insight.id, result.riskLevel);
        }
      }

      res.json({ insights, analysisCount: insights.length });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * PUT /api/ai-insights/:id
 * Update insight (deactivate, extend expiry, etc.)
 * Admin/Coach access
 */
export function updateInsight(app: Express) {
  app.put("/api/ai-insights/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const requesterId = (req as any).user?.id;
      const requesterRole = (req as any).user?.role;
      
      if (!requesterId || !isCoachOrPlatformAdmin(requesterRole)) {
        return res.status(403).json({ error: "Admin or Coach access required" });
      }

      const insightId = parseInt(req.params.id);
      if (isNaN(insightId)) {
        return res.status(400).json({ error: "Invalid insight ID" });
      }

      const { isActive, expiresAt } = req.body;

      const hasInsights = await hasRelation(tenantPool, 'ai_insights');
      if (!hasInsights) {
        return res.status(503).json({ error: 'AI insights not available for this tenant' });
      }

      const [insight] = await database.select().from(aiInsights).where(eq(aiInsights.id, insightId));
      if (!insight) {
        return res.status(404).json({ error: "Insight not found" });
      }

      // Check permissions
      if (requesterRole === 'coach') {
        const [targetUser] = await database.select().from(users).where(eq(users.id, insight.userId));
        if (!targetUser || targetUser.coachId !== requesterId) {
          return res.status(403).json({ error: "You can only update insights for your trainees" });
        }
      }

      const updateData: any = {};
      if (typeof isActive === 'boolean') updateData.isActive = isActive;
      if (expiresAt) updateData.expiresAt = new Date(expiresAt);

      const [updated] = await database.update(aiInsights)
        .set(updateData)
        .where(eq(aiInsights.id, insightId))
        .returning();

      res.json({ insight: updated });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * GET /api/ai-insights/admin/dashboard
 * Admin dashboard for all insights
 */
export function getAdminInsightsDashboard(app: Express) {
  app.get("/api/ai-insights/admin/dashboard", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const requesterRole = (req as any).user?.role;
      
      if ((requesterRole !== 'admin' && requesterRole !== 'super_admin')) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const hasInsights = await hasRelation(tenantPool, 'ai_insights');
      if (!hasInsights) {
        return res.json({ highRiskInsights: [] });
      }

      const highRiskUsers = await database.select()
        .from(aiInsights)
        .where(and(
          eq(aiInsights.isActive, true),
          or(
            eq(aiInsights.riskLevel, 'high'),
            eq(aiInsights.riskLevel, 'critical')
          )
        ))
        .orderBy(desc(aiInsights.createdAt))
        .limit(50);

      res.json({ highRiskInsights: highRiskUsers });
    } catch (error) {
      next(error);
    }
  });
}

// ============================================================
// E2: AI PLAN SUGGESTIONS - Auto-Personalization
// ============================================================

/**
 * GET /api/ai-plan-suggestions
 * Get plan suggestions for user
 */
export function getPlanSuggestions(app: Express) {
  app.get("/api/ai-plan-suggestions", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const targetUserId = req.query.userId ? parseInt(req.query.userId as string) : userId;
      const status = req.query.status as string;

      // Permission check
      if (targetUserId !== userId && !['coach', 'admin'].includes(userRole)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (userRole === 'coach' && targetUserId !== userId) {
        const [targetUser] = await database.select().from(users).where(eq(users.id, targetUserId));
        if (!targetUser || targetUser.coachId !== userId) {
          return res.status(403).json({ error: "You can only view suggestions for your trainees" });
        }
      }

      const conditions: SQL[] = [eq(aiPlanSuggestions.userId, targetUserId)];
      
      if (status) {
        conditions.push(eq(aiPlanSuggestions.status, status as any));
      }

      const hasSuggestions = await hasRelation(tenantPool, 'ai_plan_suggestions');
      if (!hasSuggestions) {
        return res.json({ suggestions: [] });
      }

      const suggestions = await database.select()
        .from(aiPlanSuggestions)
        .where(and(...conditions))
        .orderBy(desc(aiPlanSuggestions.createdAt));

      res.json({ suggestions });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * POST /api/ai-plan-suggestions
 * Create a new plan suggestion
 * Admin/AI system access
 */
export function createPlanSuggestion(app: Express) {
  app.post("/api/ai-plan-suggestions", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const requesterRole = (req as any).user?.role;
      
      if ((requesterRole !== 'admin' && requesterRole !== 'super_admin')) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const hasSuggestions = await hasRelation(tenantPool, 'ai_plan_suggestions');
      if (!hasSuggestions) {
        return res.status(503).json({ error: 'AI plan suggestions not available for this tenant' });
      }

      const validationResult = insertAiPlanSuggestionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid input", details: validationResult.error });
      }

      // Get user's coach
      const [user] = await database.select().from(users).where(eq(users.id, validationResult.data.userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const [suggestion] = await database.insert(aiPlanSuggestions).values({
        ...validationResult.data,
        coachId: user.coachId || undefined,
      }).returning();

      // Notify coach about pending suggestion
      if (user.coachId && await hasRelation(tenantPool, 'notifications')) {
        await database.insert(notifications).values({
          userId: user.coachId,
          type: 'ai_suggestion',
          title: 'New AI Plan Suggestion',
          titleAr: 'اقتراح خطة جديد من الذكاء الاصطناعي',
          message: `AI has suggested a plan change for ${user.firstName} ${user.lastName}`,
          messageAr: `اقترح الذكاء الاصطناعي تغيير خطة لـ ${user.firstName} ${user.lastName}`,
          relatedEntityType: 'ai_plan_suggestion',
          relatedEntityId: suggestion.id,
        });
      }

      res.json({ suggestion });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * PUT /api/ai-plan-suggestions/:id/approve
 * Approve a plan suggestion
 * Coach/Admin access
 */
export function approvePlanSuggestion(app: Express) {
  app.put("/api/ai-plan-suggestions/:id/approve", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const requesterId = (req as any).user?.id;
      const requesterRole = (req as any).user?.role;
      
      if (!requesterId || !isCoachOrPlatformAdmin(requesterRole)) {
        return res.status(403).json({ error: "Coach or Admin access required" });
      }

      const suggestionId = parseInt(req.params.id);
      if (isNaN(suggestionId)) {
        return res.status(400).json({ error: "Invalid suggestion ID" });
      }

      const { applyImmediately = false } = req.body;

      const hasSuggestions = await hasRelation(tenantPool, 'ai_plan_suggestions');
      if (!hasSuggestions) {
        return res.status(503).json({ error: 'AI plan suggestions not available for this tenant' });
      }

      const [suggestion] = await database.select()
        .from(aiPlanSuggestions)
        .where(eq(aiPlanSuggestions.id, suggestionId));

      if (!suggestion) {
        return res.status(404).json({ error: "Suggestion not found" });
      }

      // Check permissions
      if (requesterRole === 'coach' && suggestion.coachId !== requesterId) {
        return res.status(403).json({ error: "You can only approve suggestions for your trainees" });
      }

      const updateData: any = {
        status: applyImmediately ? 'applied' : 'approved',
        approvedBy: requesterId,
        approvedAt: new Date(),
      };

      if (applyImmediately) {
        updateData.appliedAt = new Date();
        // Here you would actually apply the plan changes to the user's plan
        // await applyPlanChanges(suggestion.userId, suggestion.suggestedPlan);
      }

      const [updated] = await database.update(aiPlanSuggestions)
        .set(updateData)
        .where(eq(aiPlanSuggestions.id, suggestionId))
        .returning();

      // Notify user
      if (await hasRelation(tenantPool, 'notifications')) {
        await database.insert(notifications).values({
          userId: suggestion.userId,
          type: 'ai_suggestion_approved',
          title: 'Plan Suggestion Approved',
          titleAr: 'تمت الموافقة على اقتراح الخطة',
          message: applyImmediately 
            ? 'Your coach has approved and applied the AI plan suggestion'
            : 'Your coach has approved the AI plan suggestion',
          messageAr: applyImmediately
            ? 'وافق مدربك وطبق اقتراح خطة الذكاء الاصطناعي'
            : 'وافق مدربك على اقتراح خطة الذكاء الاصطناعي',
          relatedEntityType: 'ai_plan_suggestion',
          relatedEntityId: suggestionId,
        });
      }

      res.json({ suggestion: updated });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * PUT /api/ai-plan-suggestions/:id/reject
 * Reject a plan suggestion
 * Coach/Admin access
 */
export function rejectPlanSuggestion(app: Express) {
  app.put("/api/ai-plan-suggestions/:id/reject", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const requesterId = (req as any).user?.id;
      const requesterRole = (req as any).user?.role;
      
      if (!requesterId || !isCoachOrPlatformAdmin(requesterRole)) {
        return res.status(403).json({ error: "Coach or Admin access required" });
      }

      const suggestionId = parseInt(req.params.id);
      if (isNaN(suggestionId)) {
        return res.status(400).json({ error: "Invalid suggestion ID" });
      }

      const { reason } = req.body;

      const hasSuggestions = await hasRelation(tenantPool, 'ai_plan_suggestions');
      if (!hasSuggestions) {
        return res.status(503).json({ error: 'AI plan suggestions not available for this tenant' });
      }

      const [suggestion] = await database.select()
        .from(aiPlanSuggestions)
        .where(eq(aiPlanSuggestions.id, suggestionId));

      if (!suggestion) {
        return res.status(404).json({ error: "Suggestion not found" });
      }

      // Check permissions
      if (requesterRole === 'coach' && suggestion.coachId !== requesterId) {
        return res.status(403).json({ error: "You can only reject suggestions for your trainees" });
      }

      const [updated] = await database.update(aiPlanSuggestions)
        .set({
          status: 'rejected',
          approvedBy: requesterId,
          approvedAt: new Date(),
          rejectionReason: reason,
        })
        .where(eq(aiPlanSuggestions.id, suggestionId))
        .returning();

      res.json({ suggestion: updated });
    } catch (error) {
      next(error);
    }
  });
}

// ============================================================
// E3: ESCALATION - Complex Case Routing
// ============================================================

/**
 * GET /api/escalations
 * Get escalation requests
 */
export function getEscalations(app: Express) {
  app.get("/api/escalations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;
      
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const status = req.query.status as string;
      const priority = req.query.priority as string;

      let conditions: SQL[] = [];

      // Role-based filtering
      if (userRole === 'user') {
        conditions.push(eq(escalationRequests.userId, userId));
      } else if (userRole === 'coach') {
        conditions.push(
          or(
            eq(escalationRequests.assignedTo, userId),
            sql`${escalationRequests.userId} IN (SELECT id FROM ${users} WHERE coach_id = ${userId})`
          )!
        );
      }
      // Admin sees all

      if (status) {
        conditions.push(eq(escalationRequests.status, status as any));
      }

      if (priority) {
        conditions.push(eq(escalationRequests.priority, priority as any));
      }

      const hasEscalations = await hasRelation(tenantPool, 'escalation_requests');
      if (!hasEscalations) {
        return res.json({ escalations: [] });
      }

      const escalations = await database.select()
        .from(escalationRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(escalationRequests.createdAt))
        .limit(100);

      res.json({ escalations });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * POST /api/escalations
 * Create escalation request
 */
export function createEscalation(app: Express) {
  app.post("/api/escalations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const requesterId = (req as any).user?.id;
      const requesterRole = (req as any).user?.role;
      
      if (!requesterId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const hasEscalations = await hasRelation(tenantPool, 'escalation_requests');
      if (!hasEscalations) {
        return res.status(503).json({ error: 'Escalations not available for this tenant' });
      }

      const validationResult = insertEscalationRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid input", details: validationResult.error });
      }

      const data = validationResult.data;

      // Users can only create escalations for themselves
      if (requesterRole === 'user' && data.userId !== requesterId) {
        return res.status(403).json({ error: "You can only create escalations for yourself" });
      }

      // Get user and their coach
      const [user] = await database.select().from(users).where(eq(users.id, data.userId));
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const [escalation] = await database.insert(escalationRequests).values({
        ...data,
        assignedTo: user.coachId || undefined,
        assignedAt: user.coachId ? new Date() : undefined,
      }).returning();

      // Create notification for assigned coach/admin
      if (escalation.assignedTo && await hasRelation(tenantPool, 'notifications')) {
        await database.insert(notifications).values({
          userId: escalation.assignedTo,
          type: 'escalation',
          priority: escalation.priority as any,
          title: `Escalation: ${escalation.title}`,
          titleAr: escalation.titleAr || `تصعيد: ${escalation.title}`,
          message: escalation.description,
          messageAr: escalation.descriptionAr,
          relatedEntityType: 'escalation',
          relatedEntityId: escalation.id,
        });
      }

      res.json({ escalation });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * PUT /api/escalations/:id
 * Update escalation status/assignment
 * Coach/Admin access
 */
export function updateEscalation(app: Express) {
  app.put("/api/escalations/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const requesterId = (req as any).user?.id;
      const requesterRole = (req as any).user?.role;
      
      if (!requesterId || !isCoachOrPlatformAdmin(requesterRole)) {
        return res.status(403).json({ error: "Coach or Admin access required" });
      }

      const escalationId = parseInt(req.params.id);
      if (isNaN(escalationId)) {
        return res.status(400).json({ error: "Invalid escalation ID" });
      }

      const { status, assignedTo, scheduledAt, resolutionNotes } = req.body;

      const hasEscalations = await hasRelation(tenantPool, 'escalation_requests');
      if (!hasEscalations) {
        return res.status(503).json({ error: 'Escalations not available for this tenant' });
      }

      const [escalation] = await database.select()
        .from(escalationRequests)
        .where(eq(escalationRequests.id, escalationId));

      if (!escalation) {
        return res.status(404).json({ error: "Escalation not found" });
      }

      // Check permissions
      if (requesterRole === 'coach') {
        if (escalation.assignedTo !== requesterId) {
          return res.status(403).json({ error: "You can only update escalations assigned to you" });
        }
      }

      const updateData: any = { updatedAt: new Date() };
      
      if (status) {
        updateData.status = status;
        if (status === 'completed') {
          updateData.resolvedBy = requesterId;
          updateData.resolvedAt = new Date();
        }
      }
      
      if (assignedTo !== undefined) {
        updateData.assignedTo = assignedTo;
        updateData.assignedAt = assignedTo ? new Date() : null;
      }
      
      if (scheduledAt) {
        updateData.scheduledAt = new Date(scheduledAt);
        updateData.status = 'scheduled';
      }
      
      if (resolutionNotes) {
        updateData.resolutionNotes = resolutionNotes;
      }

      const [updated] = await database.update(escalationRequests)
        .set(updateData)
        .where(eq(escalationRequests.id, escalationId))
        .returning();

      res.json({ escalation: updated });
    } catch (error) {
      next(error);
    }
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Generate AI response (placeholder - would call actual AI service)
 */
async function generateAiResponse(userId: number, question: string, language: string) {
  // This is a placeholder. In production, this would:
  // 1. Gather user context (plans, logs, profile)
  // 2. Call AI service (OpenAI, etc.)
  // 3. Apply safety filters
  // 4. Format response

  const lowerQuestion = question.toLowerCase();
  
  // Check for medical concerns
  const medicalKeywords = ['pain', 'hurt', 'dizzy', 'sick', 'blood', 'medical', 'doctor', 'diagnosis'];
  const hasMedicalConcern = medicalKeywords.some(keyword => lowerQuestion.includes(keyword));
  
  if (hasMedicalConcern) {
    return {
      type: 'answer' as const,
      text: "I've detected a potential health concern in your question. While I can provide general fitness guidance, I'm not qualified to give medical advice. I recommend consulting with a healthcare professional about this. Would you like me to escalate this to your coach or help you schedule a consultation?",
      textAr: "لقد اكتشفت مشكلة صحية محتملة في سؤالك. بينما يمكنني تقديم إرشادات لياقة عامة، فأنا غير مؤهل لتقديم نصائح طبية. أوصي باستشارة أخصائي رعاية صحية حول هذا الأمر. هل تريد مني تصعيد هذا إلى مدربك أو مساعدتك في جدولة استشارة؟",
      confidence: 0.9,
      context: { detectedConcern: 'medical', keywords: medicalKeywords.filter(k => lowerQuestion.includes(k)) },
      shouldEscalate: true,
      escalationReason: 'Medical concern detected in user question',
    };
  }
  
  // Simple responses for common questions
  if (lowerQuestion.includes('protein') || lowerQuestion.includes('nutrition')) {
    return {
      type: 'answer' as const,
      text: "For protein intake, a general guideline is 1.6-2.2g per kg of body weight for muscle building. However, your specific needs depend on your goals, training intensity, and current diet. Would you like me to analyze your current nutrition plan?",
      textAr: "لتناول البروتين، الإرشادات العامة هي 1.6-2.2 جرام لكل كيلوغرام من وزن الجسم لبناء العضلات. ومع ذلك، تعتمد احتياجاتك المحددة على أهدافك وشدة التدريب ونظامك الغذائي الحالي. هل تريد مني تحليل خطة التغذية الحالية الخاصة بك؟",
      confidence: 0.85,
      context: { topic: 'nutrition', subtopic: 'protein' },
      shouldEscalate: false,
    };
  }
  
  // Default response
  return {
    type: 'answer' as const,
    text: "I'm here to help with your fitness and nutrition questions. Could you provide more details about what you'd like to know? I have access to your workout plans, meal logs, and progress tracking to give you personalized guidance.",
    textAr: "أنا هنا للمساعدة في أسئلة اللياقة البدنية والتغذية الخاصة بك. هل يمكنك تقديم المزيد من التفاصيل حول ما تريد معرفته؟ لدي إمكانية الوصول إلى خطط التمرين وسجلات الوجبات وتتبع التقدم لإعطائك إرشادات شخصية.",
    confidence: 0.7,
    context: {},
    shouldEscalate: false,
  };
}

/**
 * Generate contextual guidance based on user state
 */
async function generateContextualGuidance(user: any) {
  // Placeholder implementation
  const guidance = {
    text: "Welcome! Here's what you can do today: 1) Log your meals to track nutrition, 2) Complete your scheduled workout, 3) Update your progress with photos or measurements. Need help with any of these?",
    textAr: "مرحبا! إليك ما يمكنك القيام به اليوم: 1) سجل وجباتك لتتبع التغذية، 2) أكمل التمرين المجدول، 3) قم بتحديث تقدمك بالصور أو القياسات. هل تحتاج مساعدة في أي من هذه؟",
    context: {
      hasWorkoutPlan: !!user.workoutPlan,
      hasNutritionPlan: !!user.nutritionPlan,
      hasCoach: !!user.coachId,
    },
  };
  
  return guidance;
}

/**
 * Generate troubleshooting guide
 */
async function generateTroubleshootingGuide(userId: number, issue: string) {
  // Placeholder implementation
  return {
    issue: issue || 'general',
    steps: [
      { step: 1, description: 'Check your internet connection' },
      { step: 2, description: 'Refresh the page' },
      { step: 3, description: 'Clear browser cache' },
      { step: 4, description: 'If issue persists, contact support' },
    ],
  };
}

/**
 * Perform behavior analysis
 */
async function performBehaviorAnalysis(userId: number) {
  // Placeholder - would analyze workout logs, meal logs, etc.
  const now = new Date();
  const expiryDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  return [
    {
      type: 'adherence_pattern' as const,
      title: 'Workout Consistency Analysis',
      titleAr: 'تحليل الاتساق في التمارين',
      description: 'User shows consistent workout attendance (85% adherence rate). Slight drop-off noticed on weekends.',
      descriptionAr: 'يظهر المستخدم حضورًا ثابتًا للتمرين (معدل الالتزام 85٪). لوحظ انخفاض طفيف في عطلات نهاية الأسبوع.',
      keySignals: [
        { signal: 'Weekly attendance', value: '85%', importance: 'high' },
        { signal: 'Weekend drop-off', value: '30%', importance: 'moderate' },
      ],
      confidence: 0.88,
      riskLevel: undefined,
      trend: 'stable' as const,
      expiresAt: expiryDate,
    },
  ];
}

/**
 * Create auto-escalation for medical concerns
 */
async function createAutoEscalation(
  database: ReturnType<typeof resolveAiDb>,
  tenantPool: Pool | undefined,
  userId: number,
  conversationId: number,
  reason: string
) {
  const hasEscalations = await hasRelation(tenantPool, 'escalation_requests');
  if (!hasEscalations) return;

  const [user] = await database.select().from(users).where(eq(users.id, userId));
  if (!user) return;
  
  await database.insert(escalationRequests).values({
    userId,
    escalationType: 'coach_handoff',
    triggerSource: 'ai_assistant',
    priority: 'high',
    title: 'Medical Concern Detected',
    titleAr: 'تم اكتشاف مخاوف طبية',
    description: reason,
    descriptionAr: reason,
    conversationId,
    assignedTo: user.coachId || undefined,
    assignedAt: user.coachId ? new Date() : undefined,
    status: 'pending',
  });
}

/**
 * Create risk-based escalation
 */
async function createRiskEscalation(
  database: ReturnType<typeof resolveAiDb>,
  tenantPool: Pool | undefined,
  userId: number,
  insightId: number,
  riskLevel: string
) {
  const hasEscalations = await hasRelation(tenantPool, 'escalation_requests');
  if (!hasEscalations) return;

  const [user] = await database.select().from(users).where(eq(users.id, userId));
  if (!user) return;
  
  const priority = riskLevel === 'critical' ? 'urgent' : 'high';
  
  await database.insert(escalationRequests).values({
    userId,
    escalationType: 'coach_handoff',
    triggerSource: 'risk_prediction',
    priority: priority as any,
    title: `${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk Detected`,
    titleAr: `تم اكتشاف خطر ${riskLevel}`,
    description: 'AI has detected a pattern indicating potential drop-off or health concern. Coach review recommended.',
    descriptionAr: 'اكتشف الذكاء الاصطناعي نمطًا يشير إلى احتمال الانقطاع أو مشكلة صحية. يوصى بمراجعة المدرب.',
    insightId,
    assignedTo: user.coachId || undefined,
    assignedAt: user.coachId ? new Date() : undefined,
    status: 'pending',
  });
}

/**
 * Register all AI Assistant routes
 */
export function registerAiAssistantRoutes(app: Express) {
  // E1: Basic Assistant
  askAssistant(app);
  getConversations(app);
  getGuidance(app);
  deleteConversation(app);
  getTroubleshooting(app);
  
  // E2: Advanced Assistant
  getInsights(app);
  analyzeUserBehavior(app);
  updateInsight(app);
  getAdminInsightsDashboard(app);
  
  // E2: Plan Suggestions
  getPlanSuggestions(app);
  createPlanSuggestion(app);
  approvePlanSuggestion(app);
  rejectPlanSuggestion(app);
  
  // E3: Escalations
  getEscalations(app);
  createEscalation(app);
  updateEscalation(app);
  
  // AI Agent Chat
  aiAgentChat(app);
}

/**
 * POST /api/ai-agent/chat
 * Chat with AI Agent that has full context of user profile and activity
 * User access only
 */
function aiAgentChat(app: Express) {
  app.post("/api/ai-agent/chat", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const database = resolveAiDb(req);
      const tenantPool = resolveTenantPool(req);
      const userId = (req as any).user?.id as number | undefined;
      const isGuestChat = !userId;

      const { message, language = 'en' } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: "Message is required" });
      }

      const aiSettings = await getAiSettingsForRequest(req);
      const chatConfig = getAiFeatureConfig(aiSettings, 'chat');
      if (!chatConfig) {
        return res.status(400).json(buildAiNotConfiguredResponse('chat'));
      }

      const currentUser = (req as any).user;
      if (userId && currentUser?.role === 'user') {
        const scope = buildScopeFromRequest(req);
        await getOrCreateAccountWithBalance(scope, userId);
        const consumeResult = await consumeCredits(scope, {
          userId,
          actionKey: 'ai_agent_chat',
        });

        if ('insufficient' in consumeResult) {
          const uiLanguage = language === 'ar' ? 'ar' : 'en';
          return res.status(402).json({ message: getInsufficientCreditsMessage(uiLanguage), balance: consumeResult.balance });
        }
      }

      const userContext = userId
        ? await gatherUserContext(database, tenantPool, userId)
        : buildGuestUserContext();

      // Generate AI response with full context
      const aiResponse = await generateAiAgentResponse(message, userContext, language, chatConfig);

      // Store conversation
      const canStoreConversations = userId ? await hasRelation(tenantPool, 'ai_conversations') : false;
      if (canStoreConversations) {
        await database.insert(aiConversations).values({
          userId: userId!,
          messageType: 'question',
          messageText: message,
          language: language as 'en' | 'ar',
          contextData: {
            timestamp: new Date().toISOString(),
            hasProfile: !!userContext.profile,
            activityLogCount: userContext.recentActivity.length,
          },
        });

        await database.insert(aiConversations).values({
          userId: userId!,
          messageType: 'answer',
          messageText: aiResponse.text,
          messageTextAr: aiResponse.textAr,
          language: language as 'en' | 'ar',
          confidenceScore: aiResponse.confidence,
          contextData: aiResponse.contextUsed,
        });
      }

      res.json({ 
        response: language === 'ar' && aiResponse.textAr ? aiResponse.textAr : aiResponse.text,
        confidence: aiResponse.confidence,
        guestMode: isGuestChat,
      });
    } catch (error) {
      next(error);
    }
  });
}

/**
 * Gather comprehensive user context for AI Agent
 */
async function gatherUserContext(
  database: ReturnType<typeof resolveAiDb>,
  tenantPool: Pool | undefined,
  userId: number
) {
  const fetchIfExists = async <T>(relation: string, query: () => Promise<T>, fallback: T): Promise<T> => {
    if (!(await hasRelation(tenantPool, relation))) {
      return fallback;
    }
    return query();
  };
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get user profile
  const [profile] = await database.select().from(users).where(eq(users.id, userId));

  // Get recent workout sessions (last 50)
  const workoutActivity = await fetchIfExists('workout_sessions', async () => (
    database.select()
      .from(workoutSessions)
      .where(eq(workoutSessions.userId, userId))
      .orderBy(desc(workoutSessions.completedAt))
      .limit(50)
  ), []);

  // Get recent meals (last 50)
  const mealActivity = await fetchIfExists('meals', async () => (
    database.select()
      .from(meals)
      .where(eq(meals.userId, userId))
      .orderBy(desc(meals.date))
      .limit(50)
  ), []);

  // Get recent progress logs
  const progressLogs = await fetchIfExists('progress', async () => (
    database.select()
      .from(progress)
      .where(eq(progress.userId, userId))
      .orderBy(desc(progress.date))
      .limit(50)
  ), []);

  // Get active supplement recommendations
  const supplements = await fetchIfExists('supplement_recommendations', async () => (
    database.select()
      .from(supplementRecommendations)
      .where(and(
        eq(supplementRecommendations.userId, userId),
        eq(supplementRecommendations.status, 'active')
      ))
  ), []);

  // Get recent supplement side effects
  const sideEffects = await fetchIfExists('supplement_side_effects', async () => (
    database.select()
      .from(supplementSideEffects)
      .where(and(
        eq(supplementSideEffects.userId, userId),
        gte(supplementSideEffects.occurredAt, thirtyDaysAgo)
      ))
      .orderBy(desc(supplementSideEffects.occurredAt))
  ), []);

  // Get recent missed workouts
  const missedWorkoutsData = await fetchIfExists('missed_workouts', async () => (
    database.select()
      .from(missedWorkouts)
      .where(and(
        eq(missedWorkouts.userId, userId),
        gte(missedWorkouts.scheduledDate, thirtyDaysAgo)
      ))
      .orderBy(desc(missedWorkouts.scheduledDate))
  ), []);

  // Get recent insights
  const insights = await fetchIfExists('ai_insights', async () => (
    database.select()
      .from(aiInsights)
      .where(and(
        eq(aiInsights.userId, userId),
        eq(aiInsights.isActive, true)
      ))
      .orderBy(desc(aiInsights.createdAt))
      .limit(10)
  ), []);

  // Combine activity logs
  const recentActivity = [
    ...workoutActivity.map(w => ({
      type: 'workout' as const,
      date: w.completedAt,
      data: {
        workoutName: w.workoutName,
        duration: w.duration,
        completedSets: w.completedSets,
        totalSets: w.totalSets,
      },
    })),
    ...mealActivity.map(m => ({
      type: 'meal' as const,
      date: m.date,
      data: {
        mealType: m.mealType,
        calories: m.calories,
        protein: m.protein,
        carbs: m.carbs,
        fat: m.fat,
      },
    })),
    ...progressLogs.map(p => ({
      type: 'progress' as const,
      date: p.date,
      data: {
        weight: p.weight,
        bodyFat: p.bodyFat,
        muscleMass: p.muscleMass,
        notes: p.notes,
      },
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);

  return {
    profile,
    recentActivity,
    supplements,
    sideEffects,
    missedWorkouts: missedWorkoutsData,
    insights,
    stats: {
      totalWorkouts: workoutActivity.length,
      totalMeals: mealActivity.length,
      totalProgressLogs: progressLogs.length,
      activeSupplement: supplements.length,
    },
  };
}

type AiUserContext = Awaited<ReturnType<typeof gatherUserContext>>;

function buildGuestUserContext(): AiUserContext {
  return {
    profile: undefined,
    recentActivity: [],
    supplements: [],
    sideEffects: [],
    missedWorkouts: [],
    insights: [],
    stats: {
      totalWorkouts: 0,
      totalMeals: 0,
      totalProgressLogs: 0,
      activeSupplement: 0,
    },
  };
}

/**
 * Generate AI Agent response with full context
 */
async function generateAiAgentResponse(
  message: string,
  context: AiUserContext,
  language: string,
  chatConfig: AiFeatureSettings
) {
  const { profile, recentActivity, supplements, stats, insights } = context;
  const isGuestContext = !profile?.id;

  // Create a context summary
  const contextSummary = {
    userInfo: {
      name: `${profile?.firstName} ${profile?.lastName}`,
      age: profile?.age,
      gender: profile?.gender,
      goal: profile?.fitnessGoal,
      trainingLevel: profile?.trainingLevel,
      weight: profile?.weight,
      goalWeight: profile?.goalWeight,
    },
    recentStats: {
      workoutsThisMonth: stats.totalWorkouts,
      mealsLogged: stats.totalMeals,
      activeSupplements: stats.activeSupplement,
    },
    recentActivity: recentActivity.slice(0, 10).map(a => ({
      type: a.type,
      date: a.date,
      summary: a.type === 'workout' 
        ? `${a.data.workoutName} - ${a.data.completedSets}/${a.data.totalSets} sets`
        : a.type === 'meal'
        ? `${a.data.mealType} - ${a.data.calories} cal`
        : `Weight: ${a.data.weight}kg`,
    })),
    insights: insights.slice(0, 3).map(i => ({
      type: i.insightType,
      title: language === 'ar' && i.titleAr ? i.titleAr : i.title,
      confidence: i.confidenceScore,
    })),
  };

  const apiKey = chatConfig.apiKey;
  if (!apiKey) {
    throw new Error('AI chat is not configured');
  }

  try {
    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey });

    // Build system prompt with user context
    const systemPrompt = isGuestContext
      ? `You are a helpful fitness AI assistant for a guest user without account data.

Instructions:
- Respond in ${language === 'ar' ? 'Arabic' : 'English'}
- Provide practical, safe, general fitness and nutrition guidance
- Be professional, concise, and encouraging
- Never claim you can see the guest's private profile or activity history
- Keep responses concise (2-3 sentences)
- If asked about medical issues, advise consulting a healthcare professional`
      : `You are a helpful fitness AI assistant with access to the user's complete profile and activity history.

User Profile:
- Name: ${profile?.firstName} ${profile?.lastName}
- Age: ${profile?.age}
- Gender: ${profile?.gender}
- Fitness Goal: ${profile?.fitnessGoal}
- Training Level: ${profile?.trainingLevel}
- Current Weight: ${profile?.weight}kg
- Goal Weight: ${profile?.goalWeight}kg

Recent Activity Stats:
- Workouts completed this month: ${stats.totalWorkouts}
- Meals logged: ${stats.totalMeals}
- Active supplements: ${stats.activeSupplement}

Recent Activity Summary:
${contextSummary.recentActivity.map(a => `- ${a.type}: ${a.summary} (${a.date})`).join('\n')}

AI Insights:
${contextSummary.insights.map(i => `- ${i.type}: ${i.title} (confidence: ${i.confidence})`).join('\n')}

Instructions:
- Respond in ${language === 'ar' ? 'Arabic' : 'English'}
- Be helpful, encouraging, and data-driven
- Use the user's profile and activity data to provide personalized advice
- Keep responses concise (2-3 sentences)
- If asked about medical issues, advise consulting a healthcare professional
- Focus on fitness, nutrition, and general wellness guidance`;

    // Use configured model or fall back to a safe default
    const model = chatConfig.model || 'gpt-4o-mini';

    // Call OpenAI Chat Completions API
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
    });

    const responseText = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.';

    return {
      text: responseText,
      textAr: responseText, // Already in requested language
      confidence: 0.95,
      contextUsed: {
        profileFields: ['name', 'age', 'goal', 'weight'],
        activityCount: recentActivity.length,
        supplementsCount: supplements.length,
        insightsCount: insights.length,
      },
    };
  } catch (error: any) {
    console.error('[AI Agent] OpenAI API error:', error.message);
    throw error;
  }
}

/**
 * Generate placeholder response when OpenAI is not available
 */
function generatePlaceholderResponse(
  message: string,
  context: Awaited<ReturnType<typeof gatherUserContext>>,
  language: string
) {
  const { profile, recentActivity, supplements, stats } = context;
  
  let responseText = '';
  let responseTextAr = '';
  let confidence = 0.85;

  const messageLower = message.toLowerCase();

  if (messageLower.includes('progress') || messageLower.includes('تقدم')) {
    responseText = `Based on your recent activity, you've completed ${stats.totalWorkouts} workouts and logged ${stats.totalMeals} meals in the past month. `;
    responseTextAr = `بناءً على نشاطك الأخير، أكملت ${stats.totalWorkouts} تمرينًا وسجلت ${stats.totalMeals} وجبة في الشهر الماضي. `;
    
    if (profile?.weight && profile?.goalWeight) {
      const diff = Math.abs(profile.weight - profile.goalWeight);
      responseText += `You're currently at ${profile.weight}kg, ${diff.toFixed(1)}kg ${profile.weight > profile.goalWeight ? 'above' : 'away from'} your goal of ${profile.goalWeight}kg.`;
      responseTextAr += `أنت حاليًا عند ${profile.weight}كجم، على بعد ${diff.toFixed(1)}كجم من هدفك البالغ ${profile.goalWeight}كجم.`;
    }
  } else if (messageLower.includes('workout') || messageLower.includes('تمرين')) {
    const recentWorkouts = recentActivity.filter(a => a.type === 'workout').slice(0, 5);
    responseText = `You've completed ${recentWorkouts.length} workouts recently. `;
    responseTextAr = `لقد أكملت ${recentWorkouts.length} تمرينًا مؤخرًا. `;
    
    if (recentWorkouts.length > 0) {
      const lastWorkout = recentWorkouts[0];
      responseText += `Your last workout was ${lastWorkout.data.workoutName} where you completed ${lastWorkout.data.completedSets}/${lastWorkout.data.totalSets} sets. Keep up the great work!`;
      responseTextAr += `آخر تمرين لك كان ${lastWorkout.data.workoutName} حيث أكملت ${lastWorkout.data.completedSets}/${lastWorkout.data.totalSets} مجموعة. استمر في العمل الرائع!`;
    }
  } else if (messageLower.includes('nutrition') || messageLower.includes('meal') || messageLower.includes('تغذية') || messageLower.includes('وجبة')) {
    const recentMeals = recentActivity.filter(a => a.type === 'meal').slice(0, 5);
    let totalCalories = 0;
    let totalProtein = 0;
    
    recentMeals.forEach(meal => {
      totalCalories += meal.data.calories || 0;
      totalProtein += meal.data.protein || 0;
    });
    
    const avgCalories = recentMeals.length > 0 ? (totalCalories / recentMeals.length).toFixed(0) : 0;
    const avgProtein = recentMeals.length > 0 ? (totalProtein / recentMeals.length).toFixed(0) : 0;
    
    responseText = `Based on your recent ${recentMeals.length} meals, you're averaging ${avgCalories} calories and ${avgProtein}g of protein per meal. `;
    responseTextAr = `بناءً على ${recentMeals.length} وجبة حديثة، معدلك ${avgCalories} سعرة حرارية و ${avgProtein}جم من البروتين لكل وجبة. `;
    
    if (profile?.fitnessGoal) {
      responseText += `This aligns with your ${profile.fitnessGoal} goal.`;
      responseTextAr += `هذا يتماشى مع هدفك ${profile.fitnessGoal}.`;
    }
  } else if (messageLower.includes('supplement') || messageLower.includes('مكمل')) {
    responseText = `You're currently taking ${supplements.length} active supplement${supplements.length !== 1 ? 's' : ''}. `;
    responseTextAr = `أنت تتناول حاليًا ${supplements.length} مكمل غذائي نشط. `;
    
    if (supplements.length > 0) {
      responseText += `Make sure to follow the recommended dosages and report any side effects to your coach.`;
      responseTextAr += `تأكد من اتباع الجرعات الموصى بها والإبلاغ عن أي آثار جانبية لمدربك.`;
    }
  } else {
    // General response
    responseText = `Hello ${profile?.firstName}! I'm your AI fitness assistant with access to your complete profile and activity history. `;
    responseTextAr = `مرحباً ${profile?.firstName}! أنا مساعدك الذكي للياقة البدنية مع الوصول إلى ملفك الشخصي الكامل وتاريخ نشاطك. `;
    
    responseText += `You can ask me about your progress, workout plans, nutrition, supplements, or anything related to your fitness journey. `;
    responseTextAr += `يمكنك سؤالي عن تقدمك، خطط التمرين، التغذية، المكملات، أو أي شيء متعلق برحلة اللياقة البدنية الخاصة بك. `;
    
    responseText += `How can I help you today?`;
    responseTextAr += `كيف يمكنني مساعدتك اليوم؟`;
  }

  return {
    text: responseText,
    textAr: responseTextAr,
    confidence,
    contextUsed: {
      profileFields: ['name', 'age', 'goal', 'weight'],
      activityCount: recentActivity.length,
      supplementsCount: supplements.length,
      insightsCount: insights.length,
    },
  };
}
