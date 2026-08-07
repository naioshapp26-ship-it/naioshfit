import { Router, Request, Response, NextFunction } from 'express';
import { drizzle } from 'drizzle-orm/node-postgres';
import { db } from './db';
import { 
  friendships, achievementShares, groupChallenges, challengeParticipants,
  encouragements, contentReports, groups, groupMembers, discussionTopics,
  topicReplies, workshops, workshopAttendees, referrals, users
} from '../shared/schema';
import * as schema from '../shared/schema';
import { isPlatformAdminRole } from '../shared/roleAccess';
import { eq, and, or, sql, desc, asc, gte, lte, inArray } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

const resolveDb = (req: Request) => {
  const tenantPool = (req as any)?.tenantPool;
  if (tenantPool) {
    return drizzle(tenantPool, { schema });
  }
  return db;
};

// ============================================================================
// F1: Social Interactions
// ============================================================================

// Friendships

// GET /api/friendships - Get user's friendships
router.get('/friendships', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { status } = req.query;
    const conditions = [
      or(eq(friendships.userId, userId), eq(friendships.friendId, userId))
    ];

    if (status) {
      conditions.push(eq(friendships.status, status as string));
    }

    const userFriendships = await db
      .select()
      .from(friendships)
      .where(and(...conditions))
      .orderBy(desc(friendships.createdAt));

    res.json(userFriendships);
  } catch (error) {
    next(error);
  }
});

// POST /api/friendships - Send friend request
router.post('/friendships', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schema = z.object({
      friendId: z.number().int().positive(),
    });

    const { friendId } = schema.parse(req.body);

    if (userId === friendId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check for existing friendship
    const existing = await db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.userId, userId), eq(friendships.friendId, friendId)),
          and(eq(friendships.userId, friendId), eq(friendships.friendId, userId))
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Friendship already exists or pending' });
    }

    const [friendship] = await db
      .insert(friendships)
      .values({
        userId,
        friendId,
        status: 'pending',
      })
      .returning();

    res.status(201).json(friendship);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// PUT /api/friendships/:id - Accept/reject friend request
router.put('/friendships/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const friendshipId = parseInt(req.params.id);
    const schema = z.object({
      status: z.enum(['accepted', 'rejected', 'blocked']),
    });

    const { status } = schema.parse(req.body);

    // Must be the friend (recipient) to accept/reject
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.id, friendshipId),
          eq(friendships.friendId, userId)
        )
      )
      .limit(1);

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship request not found' });
    }

    const [updated] = await db
      .update(friendships)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(friendships.id, friendshipId))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// DELETE /api/friendships/:id - Remove friendship
router.delete('/friendships/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const friendshipId = parseInt(req.params.id);

    // User can delete if they're either party
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.id, friendshipId),
          or(
            eq(friendships.userId, userId),
            eq(friendships.friendId, userId)
          )
        )
      )
      .limit(1);

    if (!friendship) {
      return res.status(404).json({ error: 'Friendship not found' });
    }

    await db
      .delete(friendships)
      .where(eq(friendships.id, friendshipId));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Achievement Shares

// GET /api/achievement-shares - Get shared achievements
router.get('/achievement-shares', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { visibility, groupId } = req.query;
    const conditions = [];

    // Get public shares + friends_only from friends + user's own shares
    if (visibility) {
      conditions.push(eq(achievementShares.visibility, visibility as string));
    }

    if (groupId) {
      conditions.push(eq(achievementShares.groupId, parseInt(groupId as string)));
    }

    const shares = await db
      .select()
      .from(achievementShares)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(achievementShares.createdAt))
      .limit(100);

    res.json(shares);
  } catch (error) {
    next(error);
  }
});

// POST /api/achievement-shares - Share achievement
router.post('/achievement-shares', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schema = z.object({
      achievementId: z.number().int().positive(),
      visibility: z.enum(['private', 'friends_only', 'public']),
      shareType: z.enum(['general', 'group', 'challenge']).optional(),
      groupId: z.number().int().positive().optional(),
      message: z.string().optional(),
      messageAr: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const [share] = await db
      .insert(achievementShares)
      .values({
        userId,
        ...data,
      })
      .returning();

    res.status(201).json(share);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// DELETE /api/achievement-shares/:id - Delete shared achievement
router.delete('/achievement-shares/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const shareId = parseInt(req.params.id);

    const [share] = await db
      .select()
      .from(achievementShares)
      .where(
        and(
          eq(achievementShares.id, shareId),
          eq(achievementShares.userId, userId)
        )
      )
      .limit(1);

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    await db
      .delete(achievementShares)
      .where(eq(achievementShares.id, shareId));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Group Challenges

// GET /api/group-challenges - Get challenges
router.get('/group-challenges', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const database = resolveDb(req);
    const userId = req.user?.id;
    const { groupId, active } = req.query;
    const conditions = [];

    if (groupId) {
      conditions.push(eq(groupChallenges.groupId, parseInt(groupId as string)));
    }

    if (active === 'true') {
      const now = new Date();
      conditions.push(lte(groupChallenges.startDate, now));
      conditions.push(gte(groupChallenges.endDate, now));
    }

    const challenges = await database
      .select()
      .from(groupChallenges)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(groupChallenges.createdAt));

    // If user is authenticated, get their participation status
    if (userId) {
      const participations = await database
        .select()
        .from(challengeParticipants)
        .where(eq(challengeParticipants.userId, userId));

      const participantMap = new Map(participations.map(p => [p.challengeId, p]));
      
      const challengesWithParticipation = challenges.map(challenge => ({
        ...challenge,
        userParticipation: participantMap.get(challenge.id) || null,
      }));

      return res.json(challengesWithParticipation);
    }

    res.json(challenges);
  } catch (error) {
    next(error);
  }
});

// GET /api/group-challenges/leaderboard - Get leaderboard for active or selected challenge
router.get('/group-challenges/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const database = resolveDb(req);
    const userId = req.user?.id;
    const { challengeId } = req.query;

    let challenge = null as null | (typeof groupChallenges.$inferSelect);

    if (challengeId) {
      const parsedId = parseInt(challengeId as string);
      const [selected] = await database
        .select()
        .from(groupChallenges)
        .where(eq(groupChallenges.id, parsedId))
        .limit(1);
      challenge = selected || null;
    } else {
      const now = new Date();
      const [active] = await database
        .select()
        .from(groupChallenges)
        .where(and(lte(groupChallenges.startDate, now), gte(groupChallenges.endDate, now)))
        .orderBy(desc(groupChallenges.createdAt))
        .limit(1);
      challenge = active || null;
    }

    if (!challenge) {
      return res.json({ challenge: null, leaders: [], userRank: null, totalParticipants: 0 });
    }

    const leaders = await database
      .select({
        userId: challengeParticipants.userId,
        currentValue: challengeParticipants.currentValue,
        rank: challengeParticipants.rank,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(challengeParticipants)
      .innerJoin(users, eq(challengeParticipants.userId, users.id))
      .where(eq(challengeParticipants.challengeId, challenge.id))
      .orderBy(desc(challengeParticipants.currentValue))
      .limit(5);

    const countResult = await database
      .select({ count: sql<number>`count(*)` })
      .from(challengeParticipants)
      .where(eq(challengeParticipants.challengeId, challenge.id));

    const totalParticipants = Number(countResult[0]?.count ?? 0);

    let userRank: null | { rank: number; currentValue: number } = null;
    if (userId) {
      const [participant] = await database
        .select()
        .from(challengeParticipants)
        .where(and(eq(challengeParticipants.challengeId, challenge.id), eq(challengeParticipants.userId, userId)))
        .limit(1);

      if (participant) {
        if (participant.rank) {
          userRank = { rank: participant.rank, currentValue: participant.currentValue ?? 0 };
        } else {
          const higherCountResult = await database
            .select({ count: sql<number>`count(*)` })
            .from(challengeParticipants)
            .where(
              and(
                eq(challengeParticipants.challengeId, challenge.id),
                sql`${challengeParticipants.currentValue} > ${participant.currentValue ?? 0}`
              )
            );
          const higherCount = Number(higherCountResult[0]?.count ?? 0);
          userRank = { rank: higherCount + 1, currentValue: participant.currentValue ?? 0 };
        }
      }
    }

    res.json({
      challenge: {
        id: challenge.id,
        name: challenge.name,
        metricName: challenge.metricName,
      },
      leaders,
      userRank,
      totalParticipants,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/group-challenges - Create challenge
router.post('/group-challenges', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const database = resolveDb(req);
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = (req.user as any)?.role;
    const canCreateChallenge = userRole === 'admin' || userRole === 'coach' || userRole === 'super_admin' || userRole === 'tenant_admin';
    if (!canCreateChallenge) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const schema = z.object({
      name: z.string().min(1).max(200),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      mediaUrls: z.array(z.object({
        url: z.string().url(),
        type: z.enum(["image", "video"]),
      })).optional(),
      challengeType: z.string(),
      metricName: z.string(),
      targetValue: z.number().optional(),
      startDate: z.string(),
      endDate: z.string(),
      groupId: z.number().int().positive().optional(),
      isPublic: z.boolean().optional(),
    });

    const data = schema.parse(req.body);

    const [challenge] = await database
      .insert(groupChallenges)
      .values({
        ...data,
        mediaUrls: data.mediaUrls ?? [],
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        createdBy: userId,
      })
      .returning();

    res.status(201).json(challenge);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// PUT /api/group-challenges/:id - Update challenge
router.put('/group-challenges/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const database = resolveDb(req);
    const userId = req.user?.id;
    const userRole = (req.user as any)?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const challengeId = parseInt(req.params.id);
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      mediaUrls: z.array(z.object({
        url: z.string().url(),
        type: z.enum(["image", "video"]),
      })).optional(),
      challengeType: z.string().optional(),
      metricName: z.string().optional(),
      targetValue: z.number().nullable().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      isPublic: z.boolean().optional(),
    });

    const data = schema.parse(req.body);

    const [challenge] = await database
      .select()
      .from(groupChallenges)
      .where(eq(groupChallenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const canManageAll = userRole === 'admin' || userRole === 'super_admin' || userRole === 'tenant_admin';
    const canManageOwn = userRole === 'coach' && challenge.createdBy === userId;
    if (!canManageAll && !canManageOwn) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updatePayload: Record<string, any> = {
      ...data,
      updatedAt: new Date(),
    };

    if (data.startDate) {
      updatePayload.startDate = new Date(data.startDate);
    }
    if (data.endDate) {
      updatePayload.endDate = new Date(data.endDate);
    }

    const [updated] = await database
      .update(groupChallenges)
      .set(updatePayload)
      .where(eq(groupChallenges.id, challengeId))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// DELETE /api/group-challenges/:id - Delete challenge
router.delete('/group-challenges/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const database = resolveDb(req);
    const userId = req.user?.id;
    const userRole = (req.user as any)?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const challengeId = parseInt(req.params.id);
    const [challenge] = await database
      .select()
      .from(groupChallenges)
      .where(eq(groupChallenges.id, challengeId))
      .limit(1);

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const canManageAll = userRole === 'admin' || userRole === 'super_admin' || userRole === 'tenant_admin';
    const canManageOwn = userRole === 'coach' && challenge.createdBy === userId;
    if (!canManageAll && !canManageOwn) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await database
      .delete(groupChallenges)
      .where(eq(groupChallenges.id, challengeId));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/group-challenges/:id/join - Join challenge
router.post('/group-challenges/:id/join', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const database = resolveDb(req);
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const challengeId = parseInt(req.params.id);

    // Check if already joined
    const existing = await database
      .select()
      .from(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challengeId, challengeId),
          eq(challengeParticipants.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already joined this challenge' });
    }

    const [participant] = await database
      .insert(challengeParticipants)
      .values({
        challengeId,
        userId,
        currentValue: 0,
      })
      .returning();

    res.status(201).json(participant);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/group-challenges/:id/leave - Leave challenge
router.delete('/group-challenges/:id/leave', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const database = resolveDb(req);
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const challengeId = parseInt(req.params.id);

    // Delete the participation record
    const result = await database
      .delete(challengeParticipants)
      .where(
        and(
          eq(challengeParticipants.challengeId, challengeId),
          eq(challengeParticipants.userId, userId)
        )
      )
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: 'Not joined this challenge' });
    }

    res.json({ message: 'Successfully left the challenge' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/group-challenges/:id/progress - Update challenge progress
router.put('/group-challenges/:id/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const database = resolveDb(req);
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const challengeId = parseInt(req.params.id);
    const schema = z.object({
      currentValue: z.number(),
    });

    const { currentValue } = schema.parse(req.body);

    const [participant] = await database
      .update(challengeParticipants)
      .set({
        currentValue,
        lastUpdated: new Date(),
      })
      .where(
        and(
          eq(challengeParticipants.challengeId, challengeId),
          eq(challengeParticipants.userId, userId)
        )
      )
      .returning();

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Recalculate ranks
    const participants = await database
      .select()
      .from(challengeParticipants)
      .where(eq(challengeParticipants.challengeId, challengeId))
      .orderBy(desc(challengeParticipants.currentValue));

    for (let i = 0; i < participants.length; i++) {
      await database
        .update(challengeParticipants)
        .set({ rank: i + 1 })
        .where(eq(challengeParticipants.id, participants[i].id));
    }

    res.json(participant);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// Encouragements

// POST /api/encouragements - Add encouragement (like/cheer)
router.post('/encouragements', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schema = z.object({
      targetType: z.enum(['achievement_share', 'challenge_progress', 'discussion_topic', 'topic_reply']),
      targetId: z.number().int().positive(),
      reactionType: z.enum(['like', 'cheer', 'fire', 'celebrate', 'strong']).optional(),
    });

    const data = schema.parse(req.body);

    const [encouragement] = await db
      .insert(encouragements)
      .values({
        userId,
        ...data,
      })
      .returning()
      .catch(async (err) => {
        // If unique constraint violation, remove and re-add to toggle
        if (err.code === '23505') {
          await db
            .delete(encouragements)
            .where(
              and(
                eq(encouragements.userId, userId),
                eq(encouragements.targetType, data.targetType),
                eq(encouragements.targetId, data.targetId),
                eq(encouragements.reactionType, data.reactionType || 'like')
              )
            );
          return [{ removed: true }];
        }
        throw err;
      });

    res.status(201).json(encouragement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// ============================================================================
// F2: Groups
// ============================================================================

// Groups

// GET /api/groups - List groups
router.get('/groups', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { goalType, groupType } = req.query;
    const conditions = [];

    if (goalType) {
      conditions.push(eq(groups.goalType, goalType as string));
    }

    if (groupType) {
      conditions.push(eq(groups.groupType, groupType as string));
    }

    const groupList = await db
      .select()
      .from(groups)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(groups.createdAt));

    res.json(groupList);
  } catch (error) {
    next(error);
  }
});

// POST /api/groups - Create group
router.post('/groups', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schema = z.object({
      name: z.string().min(1).max(200),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      goalType: z.string(),
      groupType: z.enum(['public', 'private']).optional(),
      maxMembers: z.number().int().positive().optional(),
    });

    const data = schema.parse(req.body);

    const [group] = await db
      .insert(groups)
      .values({
        ...data,
        ownerId: userId,
        memberCount: 1,
      })
      .returning();

    // Add creator as owner member
    await db
      .insert(groupMembers)
      .values({
        groupId: group.id,
        userId,
        role: 'owner',
        status: 'active',
      });

    res.status(201).json(group);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// PUT /api/groups/:id - Update group
router.put('/groups/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const groupId = parseInt(req.params.id);
    const schema = z.object({
      name: z.string().min(1).max(200).optional(),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      groupType: z.enum(['public', 'private']).optional(),
      maxMembers: z.number().int().positive().optional(),
    });

    const data = schema.parse(req.body);

    // Check if user is owner or admin
    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.ownerId !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to update this group' });
    }

    const [updated] = await db
      .update(groups)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(groups.id, groupId))
      .returning();

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// DELETE /api/groups/:id - Delete group
router.delete('/groups/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const groupId = parseInt(req.params.id);

    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.ownerId !== userId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Not authorized to delete this group' });
    }

    await db.delete(groups).where(eq(groups.id, groupId));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Group Members

// GET /api/groups/:id/members - Get group members
router.get('/groups/:id/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = parseInt(req.params.id);

    const members = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(asc(groupMembers.role), desc(groupMembers.joinedAt));

    res.json(members);
  } catch (error) {
    next(error);
  }
});

// POST /api/groups/:id/members - Join group
router.post('/groups/:id/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const groupId = parseInt(req.params.id);

    // Check if already a member
    const existing = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Check max members
    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.maxMembers && group.memberCount >= group.maxMembers) {
      return res.status(400).json({ error: 'Group is full' });
    }

    const status = group.groupType === 'private' ? 'pending' : 'active';

    const [member] = await db
      .insert(groupMembers)
      .values({
        groupId,
        userId,
        role: 'member',
        status,
      })
      .returning();

    if (status === 'active') {
      await db
        .update(groups)
        .set({ memberCount: sql`${groups.memberCount} + 1` })
        .where(eq(groups.id, groupId));
    }

    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/groups/:id/members/:userId - Leave/remove from group
router.delete('/groups/:id/members/:memberId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const groupId = parseInt(req.params.id);
    const memberId = parseInt(req.params.memberId);

    // User can leave or group owner/moderator can remove
    const [member] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, memberId)
        )
      )
      .limit(1);

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Check permissions
    if (memberId !== userId) {
      const [userMembership] = await db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, userId)
          )
        )
        .limit(1);

      if (!userMembership || !['owner', 'moderator'].includes(userMembership.role)) {
        return res.status(403).json({ error: 'Not authorized to remove members' });
      }
    }

    await db
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, memberId)
        )
      );

    await db
      .update(groups)
      .set({ memberCount: sql`${groups.memberCount} - 1` })
      .where(eq(groups.id, groupId));

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Discussion Topics

// GET /api/groups/:id/topics - Get discussion topics
router.get('/groups/:id/topics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groupId = parseInt(req.params.id);

    const topics = await db
      .select()
      .from(discussionTopics)
      .where(eq(discussionTopics.groupId, groupId))
      .orderBy(desc(discussionTopics.isPinned), desc(discussionTopics.createdAt));

    res.json(topics);
  } catch (error) {
    next(error);
  }
});

// POST /api/groups/:id/topics - Create discussion topic
router.post('/groups/:id/topics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const groupId = parseInt(req.params.id);
    const schema = z.object({
      title: z.string().min(1).max(300),
      content: z.string().min(1),
      isPinned: z.boolean().optional(),
    });

    const data = schema.parse(req.body);

    // Check if user is a member
    const [member] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, 'active')
        )
      )
      .limit(1);

    if (!member) {
      return res.status(403).json({ error: 'Must be a group member to post' });
    }

    const [topic] = await db
      .insert(discussionTopics)
      .values({
        groupId,
        authorId: userId,
        ...data,
      })
      .returning();

    res.status(201).json(topic);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// Topic Replies

// POST /api/topics/:id/replies - Add reply to topic
router.post('/topics/:id/replies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const topicId = parseInt(req.params.id);
    const schema = z.object({
      content: z.string().min(1),
      parentReplyId: z.number().int().positive().optional(),
    });

    const data = schema.parse(req.body);

    // Get topic to check group membership
    const [topic] = await db
      .select()
      .from(discussionTopics)
      .where(eq(discussionTopics.id, topicId))
      .limit(1);

    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    // Check if user is a member
    const [member] = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, topic.groupId),
          eq(groupMembers.userId, userId),
          eq(groupMembers.status, 'active')
        )
      )
      .limit(1);

    if (!member) {
      return res.status(403).json({ error: 'Must be a group member to reply' });
    }

    const [reply] = await db
      .insert(topicReplies)
      .values({
        topicId,
        authorId: userId,
        ...data,
      })
      .returning();

    // Update reply count
    await db
      .update(discussionTopics)
      .set({ 
        replyCount: sql`${discussionTopics.replyCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(discussionTopics.id, topicId));

    res.status(201).json(reply);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// Workshops

// GET /api/workshops - List workshops
router.get('/workshops', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { groupId, status, upcoming } = req.query;
    const conditions = [];

    if (groupId) {
      conditions.push(eq(workshops.groupId, parseInt(groupId as string)));
    }

    if (status) {
      conditions.push(eq(workshops.status, status as string));
    }

    if (upcoming === 'true') {
      conditions.push(gte(workshops.scheduledAt, new Date()));
    }

    const workshopList = await db
      .select()
      .from(workshops)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(workshops.scheduledAt));

    res.json(workshopList);
  } catch (error) {
    next(error);
  }
});

// POST /api/workshops - Create workshop
router.post('/workshops', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Only coaches and admins can create workshops
    if (!['coach', 'admin'].includes(userRole || '')) {
      return res.status(403).json({ error: 'Only coaches and admins can create workshops' });
    }

    const schema = z.object({
      groupId: z.number().int().positive().optional(),
      title: z.string().min(1).max(300),
      titleAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      workshopType: z.string(),
      scheduledAt: z.string(),
      durationMinutes: z.number().int().positive(),
      maxAttendees: z.number().int().positive().optional(),
      price: z.number().optional(),
      meetingLink: z.string().optional(),
    });

    const data = schema.parse(req.body);

    const [workshop] = await db
      .insert(workshops)
      .values({
        ...data,
        scheduledAt: new Date(data.scheduledAt),
        instructorId: userId,
        status: 'scheduled',
      })
      .returning();

    res.status(201).json(workshop);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// ============================================================================
// F3: Referrals & Rewards
// ============================================================================

// GET /api/referrals/stats - Get referral statistics
router.get('/referrals/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userReferrals = await db
      .select()
      .from(referrals)
      .where(eq(referrals.referrerId, userId));

    const stats = {
      totalReferrals: userReferrals.length,
      conversions: userReferrals.filter(r => r.conversionStatus !== 'pending').length,
      totalRevenue: userReferrals.reduce((sum, r) => sum + (Number(r.revenueGenerated) || 0), 0),
      totalCommission: userReferrals.reduce((sum, r) => sum + (Number(r.commissionAmount) || 0), 0),
      pendingCommission: userReferrals
        .filter(r => r.commissionStatus === 'approved')
        .reduce((sum, r) => sum + (Number(r.commissionAmount) || 0), 0),
      paidCommission: userReferrals
        .filter(r => r.commissionStatus === 'paid')
        .reduce((sum, r) => sum + (Number(r.commissionAmount) || 0), 0),
      rewardsEarned: userReferrals.filter(r => r.rewardIssued).length,
    };

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// POST /api/referrals - Create referral code
router.post('/referrals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const schema = z.object({
      referralType: z.enum(['user', 'coach', 'gym', 'partner']).optional(),
    });

    const { referralType = 'user' } = schema.parse(req.body);

    // Generate unique referral code
    const code = `REF${userId}${Date.now().toString(36).toUpperCase()}`;

    const [referral] = await db
      .insert(referrals)
      .values({
        referrerId: userId,
        referralCode: code,
        referralType,
        commissionRate: 10, // Default 10%
      })
      .returning();

    res.status(201).json(referral);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    next(error);
  }
});

// GET /api/admin/referrals/commission - Admin view of commission tracking
router.get('/admin/referrals/commission', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = req.user?.role;
    if (!isPlatformAdminRole(userRole)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status } = req.query;
    const conditions = [];

    if (status) {
      conditions.push(eq(referrals.commissionStatus, status as string));
    }

    const commissions = await db
      .select()
      .from(referrals)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(referrals.createdAt));

    res.json(commissions);
  } catch (error) {
    next(error);
  }
});

// GET /api/referrals/rewards - Get user rewards
router.get('/referrals/rewards', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rewards = await db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerId, userId),
          eq(referrals.rewardIssued, true)
        )
      )
      .orderBy(desc(referrals.rewardIssuedAt));

    res.json(rewards);
  } catch (error) {
    next(error);
  }
});

// GET /api/referrals/analytics - Referral performance dashboard
router.get('/referrals/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isAdmin = userRole === 'admin';
    const conditions = isAdmin ? [] : [eq(referrals.referrerId, userId)];

    const allReferrals = await db
      .select()
      .from(referrals)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const analytics = {
      totalReferrals: allReferrals.length,
      conversionRate: allReferrals.length > 0
        ? (allReferrals.filter(r => r.conversionStatus !== 'pending').length / allReferrals.length) * 100
        : 0,
      averageRevenuePerReferral: allReferrals.length > 0
        ? allReferrals.reduce((sum, r) => sum + (Number(r.revenueGenerated) || 0), 0) / allReferrals.length
        : 0,
      topPerformers: isAdmin ? await getTopReferrers() : null,
      byStatus: {
        pending: allReferrals.filter(r => r.conversionStatus === 'pending').length,
        registered: allReferrals.filter(r => r.conversionStatus === 'registered').length,
        planPurchased: allReferrals.filter(r => r.conversionStatus === 'plan_purchased').length,
        subscriptionActive: allReferrals.filter(r => r.conversionStatus === 'subscription_active').length,
      },
    };

    res.json(analytics);
  } catch (error) {
    next(error);
  }
});

async function getTopReferrers() {
  const topReferrers = await db
    .select({
      referrerId: referrals.referrerId,
      totalReferrals: sql<number>`count(*)`,
      totalRevenue: sql<number>`sum(${referrals.revenueGenerated})`,
      totalCommission: sql<number>`sum(${referrals.commissionAmount})`,
    })
    .from(referrals)
    .groupBy(referrals.referrerId)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  return topReferrers;
}

export default router;
