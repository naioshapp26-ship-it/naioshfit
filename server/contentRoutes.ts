import { Router, Request, Response, NextFunction } from 'express';
import { db } from './db';
import { contentItems, contentRatings, contentBookmarks, users, groups } from '../shared/schema';
import { eq, and, or, desc, asc, sql, like, inArray, SQL } from 'drizzle-orm';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../shared/schema';
import { getCentralPool } from './saas/centralDb';
import { getTenantPool } from './saas/dbManager';
import { isPlatformAdminRole } from '../shared/roleAccess';

const router = Router();

// Helper: Resolve tenant database if in tenant context (with session fallback)
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
        console.error('[CONTENT] Failed to resolve tenant pool from session:', err);
      }
    }
  }

  if (!tenantPool) return null;
  return drizzle(tenantPool, { schema });
};

// Validation schemas
const createContentSchema = z.object({
  type: z.enum(['article', 'video', 'faq', 'story', 'blog']),
  category: z.enum(['nutrition', 'workout', 'supplement', 'mindset', 'recovery', 'general']),
  title: z.string().min(1).max(255),
  titleAr: z.string().max(255).optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  content: z.string().min(1),
  contentAr: z.string().optional(),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(['public', 'trainees_only', 'group_only', 'admin_only']).default('public'),
  featured: z.boolean().default(false),
  groupId: z.number().optional(),
  typeMetadata: z.record(z.any()).default({}),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

const updateContentSchema = createContentSchema.partial().extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

const rateContentSchema = z.object({
  rating: z.number().min(1).max(5),
  reviewText: z.string().optional(),
});

const bookmarkSchema = z.object({
  progressPercent: z.number().min(0).max(100).default(0),
  completed: z.boolean().default(false),
  notes: z.string().optional(),
});

// Helper: Check if user can access content
async function canAccessContent(
  content: any,
  userId: number,
  userRole: string,
  dbInstance: any = db
): Promise<boolean> {
  // Admin can access everything
  if (isPlatformAdminRole(userRole)) return true;

  // Public content is accessible to all
  if (content.visibility === 'public') return true;

  // Admin-only content
  if (content.visibility === 'admin_only') return false;

  // Trainees-only: check if user is a trainee of the coach
  if (content.visibility === 'trainees_only' && content.coachId) {
    const user = await dbInstance.select().from(users).where(eq(users.id, userId)).limit(1);
    if (user.length > 0 && user[0].coachId === content.coachId) return true;
  }

  // Group-only: check if user is a member of the group
  if (content.visibility === 'group_only' && content.groupId) {
    const { groupMembers } = await import('../shared/schema');
    const membership = await dbInstance
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, content.groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, 'active')
        )
      )
      .limit(1);
    if (membership.length > 0) return true;
  }

  // Content author can access their own content
  if (content.authorId === userId) return true;

  return false;
}

// GET /api/content - List/search content with filtering
router.get('/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role || 'user';

    // Resolve tenant database if in tenant context
    const tenantDb = await resolveTenantDb(req);
    const dbToUse = tenantDb || db;

    const {
      type,
      category,
      authorId,
      coachId,
      groupId,
      featured,
      visibility,
      status,
      tags,
      query,
      sort = 'newest',
      page = '1',
      limit = '20',
    } = req.query;

    // Build filter conditions
    const conditions: SQL[] = [];

    // Only show published content to non-admins (unless viewing own content)
    if (!isPlatformAdminRole(userRole)) {
      conditions.push(
        or(
          eq(contentItems.status, 'published'),
          eq(contentItems.authorId, userId)
        )!
      );
    } else if (status) {
      conditions.push(eq(contentItems.status, status as string));
    }

    if (type) conditions.push(eq(contentItems.type, type as string));
    if (category) conditions.push(eq(contentItems.category, category as string));
    if (authorId) conditions.push(eq(contentItems.authorId, Number(authorId)));
    if (coachId) conditions.push(eq(contentItems.coachId, Number(coachId)));
    if (groupId) conditions.push(eq(contentItems.groupId, Number(groupId)));
    if (featured === 'true') conditions.push(eq(contentItems.featured, true));
    if (visibility) conditions.push(eq(contentItems.visibility, visibility as string));

    // Search query (title or description)
    if (query && typeof query === 'string') {
      conditions.push(
        or(
          like(contentItems.title, `%${query}%`),
          like(contentItems.description, `%${query}%`)
        )!
      );
    }

    // Tag filtering (if tags are provided)
    if (tags && typeof tags === 'string') {
      const tagArray = tags.split(',');
      // Note: JSONB containment check - this is a simplified version
      // For production, you'd want to use proper JSONB operators
    }

    // Sorting
    let orderBy;
    switch (sort) {
      case 'popular':
        orderBy = desc(contentItems.viewCount);
        break;
      case 'rated':
        orderBy = desc(contentItems.averageRating);
        break;
      case 'oldest':
        orderBy = asc(contentItems.createdAt);
        break;
      default: // 'newest'
        orderBy = desc(contentItems.createdAt);
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await dbToUse
      .select()
      .from(contentItems)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limitNum)
      .offset(offset);

    // Filter items based on visibility rules
    const accessibleItems = await Promise.all(
      items.map(async (item) => {
        const hasAccess = await canAccessContent(item, userId, userRole, dbToUse);
        return hasAccess ? item : null;
      })
    );

    const filteredItems = accessibleItems.filter((item) => item !== null);

    res.json({
      items: filteredItems,
      pagination: {
        page: pageNum,
        limit: limitNum,
        hasMore: items.length === limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/content - Create content (Admin/Coach)
router.post('/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role || 'user';

    // Resolve tenant database if in tenant context
    const tenantDb = await resolveTenantDb(req);
    const dbToUse = tenantDb || db;

    // Only admins and coaches can create content
    if (!(isPlatformAdminRole(userRole) || userRole === 'coach')) {
      return res.status(403).json({ error: 'Only admins and coaches can create content' });
    }

    const data = createContentSchema.parse(req.body);

    // Coaches can only create content with trainees_only or group_only visibility
    // Blog posts are the exception and must be public
    if (userRole === 'coach') {
      if (data.type === 'blog') {
        if (data.visibility !== 'public') {
          return res.status(403).json({ error: 'Blog posts must be public' });
        }
      } else if (!['trainees_only', 'group_only'].includes(data.visibility)) {
        return res.status(403).json({ error: 'Coaches can only create content for trainees or groups' });
      }
    }

    // If group visibility, verify group exists and user has access
    if (data.visibility === 'group_only' && data.groupId) {
      const group = await dbToUse.select().from(groups).where(eq(groups.id, data.groupId)).limit(1);
      if (group.length === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }
    }

    const status = data.status ?? 'draft';
    const [newContent] = await dbToUse
      .insert(contentItems)
      .values({
        type: data.type,
        category: data.category,
        title: data.title,
        titleAr: data.titleAr,
        description: data.description,
        descriptionAr: data.descriptionAr,
        content: data.content,
        contentAr: data.contentAr,
        tags: data.tags,
        authorId: userId,
        coachId: userRole === 'coach' ? userId : null,
        groupId: data.groupId,
        visibility: data.visibility,
        featured: data.featured && isPlatformAdminRole(userRole) ? true : false, // Only platform admins can feature
        typeMetadata: data.typeMetadata,
        status,
        publishedAt: status === 'published' ? new Date() : null,
      })
      .returning();

    res.status(201).json(newContent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// GET /api/content/:id - Get content details with view tracking
router.get('/content/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role || 'user';
    const contentId = Number(req.params.id);

    // Resolve tenant database if in tenant context
    const tenantDb = await resolveTenantDb(req);
    const dbToUse = tenantDb || db;

    const [content] = await dbToUse
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Check access permissions
    const hasAccess = await canAccessContent(content, userId, userRole, dbToUse);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this content' });
    }

    // Increment view count
    await dbToUse
      .update(contentItems)
      .set({ viewCount: sql`${contentItems.viewCount} + 1` })
      .where(eq(contentItems.id, contentId));

    // Get user's bookmark/progress if exists
    const [bookmark] = await dbToUse
      .select()
      .from(contentBookmarks)
      .where(
        and(
          eq(contentBookmarks.contentId, contentId),
          eq(contentBookmarks.userId, userId)
        )
      )
      .limit(1);

    // Get user's rating if exists
    const [rating] = await dbToUse
      .select()
      .from(contentRatings)
      .where(
        and(
          eq(contentRatings.contentId, contentId),
          eq(contentRatings.userId, userId)
        )
      )
      .limit(1);

    res.json({
      ...content,
      viewCount: content.viewCount + 1,
      userBookmark: bookmark || null,
      userRating: rating || null,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/content/:id - Update content (Author/Admin only)
router.put('/content/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role || 'user';
    const contentId = Number(req.params.id);

    // Resolve tenant database if in tenant context
    const tenantDb = await resolveTenantDb(req);
    const dbToUse = tenantDb || db;

    const [content] = await dbToUse
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Only author or admin can edit
    if (content.authorId !== userId && !isPlatformAdminRole(userRole)) {
      return res.status(403).json({ error: 'Only content author or admin can edit' });
    }

    const data = updateContentSchema.parse(req.body);

    if (userRole === 'coach') {
      const effectiveType = data.type ?? content.type;
      if (effectiveType === 'blog') {
        if (data.visibility && data.visibility !== 'public') {
          return res.status(403).json({ error: 'Blog posts must be public' });
        }
      } else if (data.visibility && !['trainees_only', 'group_only'].includes(data.visibility)) {
        return res.status(403).json({ error: 'Coaches can only create content for trainees or groups' });
      }
    }

    // Only admins can feature content
    if (data.featured !== undefined && !isPlatformAdminRole(userRole)) {
      delete data.featured;
    }

    // Update content
    const [updated] = await dbToUse
      .update(contentItems)
      .set({
        ...data,
        titleAr: data.titleAr,
        descriptionAr: data.descriptionAr,
        contentAr: data.contentAr,
        groupId: data.groupId,
        typeMetadata: data.typeMetadata,
        updatedAt: new Date(),
        publishedAt: data.status === 'published' && !content.publishedAt ? new Date() : content.publishedAt,
      })
      .where(eq(contentItems.id, contentId))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// DELETE /api/content/:id - Archive content (Author/Admin only)
router.delete('/content/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const userRole = (req as any).user?.role || 'user';
    const contentId = Number(req.params.id);

    // Resolve tenant database if in tenant context
    const tenantDb = await resolveTenantDb(req);
    const dbToUse = tenantDb || db;

    const [content] = await dbToUse
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Only author or admin can delete
    if (content.authorId !== userId && !isPlatformAdminRole(userRole)) {
      return res.status(403).json({ error: 'Only content author or admin can delete' });
    }

    // Archive instead of delete
    await dbToUse
      .update(contentItems)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(contentItems.id, contentId));

    res.json({ message: 'Content archived successfully' });
  } catch (error) {
    next(error);
  }
});

// POST /api/content/:id/rate - Rate content
router.post('/content/:id/rate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const contentId = Number(req.params.id);

    // Resolve tenant database if in tenant context
    const tenantDb = await resolveTenantDb(req);
    const dbToUse = tenantDb || db;

    const [content] = await dbToUse
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const data = rateContentSchema.parse(req.body);

    // Upsert rating
    const [rating] = await dbToUse
      .insert(contentRatings)
      .values({
        contentId,
        userId,
        rating: data.rating,
        reviewText: data.reviewText,
      })
      .onConflictDoUpdate({
        target: [contentRatings.contentId, contentRatings.userId],
        set: {
          rating: data.rating,
          reviewText: data.reviewText,
          createdAt: new Date(),
        },
      })
      .returning();

    // Recalculate average rating
    const ratings = await dbToUse
      .select()
      .from(contentRatings)
      .where(eq(contentRatings.contentId, contentId));

    const totalRating = ratings.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = totalRating / ratings.length;

    await dbToUse
      .update(contentItems)
      .set({
        averageRating: avgRating,
        ratingCount: ratings.length,
      })
      .where(eq(contentItems.id, contentId));

    res.json(rating);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// GET /api/content/bookmarks - Get user's bookmarks
router.get('/content/bookmarks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;

    // Resolve tenant database if in tenant context
    const tenantDb = await resolveTenantDb(req);
    const dbToUse = tenantDb || db;

    const bookmarks = await dbToUse
      .select({
        bookmark: contentBookmarks,
        content: contentItems,
      })
      .from(contentBookmarks)
      .innerJoin(contentItems, eq(contentBookmarks.contentId, contentItems.id))
      .where(eq(contentBookmarks.userId, userId))
      .orderBy(desc(contentBookmarks.updatedAt));

    res.json(bookmarks);
  } catch (error) {
    next(error);
  }
});

// POST /api/content/:id/bookmark - Bookmark or update progress
router.post('/content/:id/bookmark', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const contentId = Number(req.params.id);

    // Resolve tenant database if in tenant context
    const tenantDb = await resolveTenantDb(req);
    const dbToUse = tenantDb || db;

    const [content] = await dbToUse
      .select()
      .from(contentItems)
      .where(eq(contentItems.id, contentId))
      .limit(1);

    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    const data = bookmarkSchema.parse(req.body);

    // Upsert bookmark
    const [bookmark] = await dbToUse
      .insert(contentBookmarks)
      .values({
        contentId,
        userId,
        progressPercent: data.progressPercent,
        completed: data.completed,
        notes: data.notes,
      })
      .onConflictDoUpdate({
        target: [contentBookmarks.contentId, contentBookmarks.userId],
        set: {
          progressPercent: data.progressPercent,
          completed: data.completed,
          notes: data.notes,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(bookmark);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

export default router;
