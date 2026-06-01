-- Epic F: Community & Engagement
-- Migration: 0025_add_community_engagement.sql

-- F1: Social Interactions

-- Friendships table
CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, accepted, rejected, blocked
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_friendship UNIQUE(user_id, friend_id),
  CONSTRAINT no_self_friendship CHECK (user_id != friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- Achievement Shares table
CREATE TABLE IF NOT EXISTS achievement_shares (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  visibility VARCHAR(20) NOT NULL DEFAULT 'friends_only', -- private, friends_only, public
  share_type VARCHAR(20) NOT NULL DEFAULT 'general', -- general, group, challenge
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  message TEXT,
  message_ar TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_achievement_shares_user_id ON achievement_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_achievement_shares_achievement_id ON achievement_shares(achievement_id);
CREATE INDEX IF NOT EXISTS idx_achievement_shares_visibility ON achievement_shares(visibility);
CREATE INDEX IF NOT EXISTS idx_achievement_shares_group_id ON achievement_shares(group_id);

-- Group Challenges table
CREATE TABLE IF NOT EXISTS group_challenges (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200),
  description TEXT,
  description_ar TEXT,
  challenge_type VARCHAR(50) NOT NULL, -- workout_count, weight_loss, step_count, nutrition_adherence, custom
  metric_name VARCHAR(100) NOT NULL,
  target_value DECIMAL(10,2),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_challenges_created_by ON group_challenges(created_by);
CREATE INDEX IF NOT EXISTS idx_group_challenges_group_id ON group_challenges(group_id);
CREATE INDEX IF NOT EXISTS idx_group_challenges_dates ON group_challenges(start_date, end_date);

-- Challenge Participants table
CREATE TABLE IF NOT EXISTS challenge_participants (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES group_challenges(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_value DECIMAL(10,2) DEFAULT 0,
  rank INTEGER,
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_participant UNIQUE(challenge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_id ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user_id ON challenge_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_rank ON challenge_participants(rank);

-- Encouragements table (likes/cheers)
CREATE TABLE IF NOT EXISTS encouragements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(50) NOT NULL, -- achievement_share, challenge_progress, discussion_topic, topic_reply
  target_id INTEGER NOT NULL,
  reaction_type VARCHAR(20) NOT NULL DEFAULT 'like', -- like, cheer, fire, celebrate, strong
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_encouragement UNIQUE(user_id, target_type, target_id, reaction_type)
);

CREATE INDEX IF NOT EXISTS idx_encouragements_user_id ON encouragements(user_id);
CREATE INDEX IF NOT EXISTS idx_encouragements_target ON encouragements(target_type, target_id);

-- Content Reports table (moderation)
CREATE TABLE IF NOT EXISTS content_reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  content_type VARCHAR(50) NOT NULL, -- achievement_share, discussion_topic, topic_reply, user_profile
  content_id INTEGER NOT NULL,
  report_type VARCHAR(50) NOT NULL, -- spam, harassment, inappropriate, fake_profile, other
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, under_review, resolved, dismissed
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_reports_reporter_id ON content_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_content ON content_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_assigned_to ON content_reports(assigned_to);

-- F2: Groups

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  name_ar VARCHAR(200),
  description TEXT,
  description_ar TEXT,
  goal_type VARCHAR(50) NOT NULL, -- weight_loss, muscle_gain, endurance, flexibility, general_fitness
  group_type VARCHAR(20) NOT NULL DEFAULT 'public', -- public, private
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  max_members INTEGER,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_owner_id ON groups(owner_id);
CREATE INDEX IF NOT EXISTS idx_groups_goal_type ON groups(goal_type);
CREATE INDEX IF NOT EXISTS idx_groups_group_type ON groups(group_type);

-- Group Members table
CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member', -- owner, moderator, member
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- pending, active, removed, banned
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_group_member UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_role ON group_members(role);
CREATE INDEX IF NOT EXISTS idx_group_members_status ON group_members(status);

-- Discussion Topics table
CREATE TABLE IF NOT EXISTS discussion_topics (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'open', -- open, closed, locked
  reply_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discussion_topics_group_id ON discussion_topics(group_id);
CREATE INDEX IF NOT EXISTS idx_discussion_topics_author_id ON discussion_topics(author_id);
CREATE INDEX IF NOT EXISTS idx_discussion_topics_status ON discussion_topics(status);
CREATE INDEX IF NOT EXISTS idx_discussion_topics_pinned ON discussion_topics(is_pinned);

-- Topic Replies table
CREATE TABLE IF NOT EXISTS topic_replies (
  id SERIAL PRIMARY KEY,
  topic_id INTEGER NOT NULL REFERENCES discussion_topics(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  parent_reply_id INTEGER REFERENCES topic_replies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_replies_topic_id ON topic_replies(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_replies_author_id ON topic_replies(author_id);
CREATE INDEX IF NOT EXISTS idx_topic_replies_parent_id ON topic_replies(parent_reply_id);

-- Workshops table
CREATE TABLE IF NOT EXISTS workshops (
  id SERIAL PRIMARY KEY,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  title VARCHAR(300) NOT NULL,
  title_ar VARCHAR(300),
  description TEXT,
  description_ar TEXT,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  workshop_type VARCHAR(50) NOT NULL, -- nutrition, workout, mindset, supplement, general
  scheduled_at TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL,
  max_attendees INTEGER,
  price DECIMAL(10,2) DEFAULT 0,
  meeting_link TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  attendee_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshops_group_id ON workshops(group_id);
CREATE INDEX IF NOT EXISTS idx_workshops_instructor_id ON workshops(instructor_id);
CREATE INDEX IF NOT EXISTS idx_workshops_scheduled_at ON workshops(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_workshops_status ON workshops(status);

-- Workshop Attendees (extends group_members or separate tracking)
-- Using a join table for attendance tracking
CREATE TABLE IF NOT EXISTS workshop_attendees (
  id SERIAL PRIMARY KEY,
  workshop_id INTEGER NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  registration_status VARCHAR(20) NOT NULL DEFAULT 'registered', -- registered, attended, cancelled, no_show
  registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
  attended_at TIMESTAMP,
  CONSTRAINT unique_workshop_attendee UNIQUE(workshop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workshop_attendees_workshop_id ON workshop_attendees(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_attendees_user_id ON workshop_attendees(user_id);

-- F3: Referrals & Rewards

-- Referrals table (unified)
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL UNIQUE,
  referral_type VARCHAR(20) NOT NULL DEFAULT 'user', -- user, coach, gym, partner
  
  -- Referred user tracking
  referred_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  conversion_status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, registered, plan_purchased, subscription_active, revenue_milestone
  conversion_date TIMESTAMP,
  
  -- Commission tracking
  revenue_generated DECIMAL(10,2) DEFAULT 0,
  commission_rate DECIMAL(5,2) DEFAULT 0, -- percentage
  commission_amount DECIMAL(10,2) DEFAULT 0,
  commission_status VARCHAR(20) DEFAULT 'pending', -- pending, approved, paid, cancelled
  commission_paid_at TIMESTAMP,
  
  -- Reward tracking
  reward_type VARCHAR(50), -- credits, discount, free_month, bonus_features, cash
  reward_value DECIMAL(10,2),
  reward_issued BOOLEAN DEFAULT false,
  reward_issued_at TIMESTAMP,
  reward_expires_at TIMESTAMP,
  
  -- Fraud prevention
  is_suspicious BOOLEAN DEFAULT false,
  fraud_check_notes TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_user_id ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_conversion_status ON referrals(conversion_status);
CREATE INDEX IF NOT EXISTS idx_referrals_commission_status ON referrals(commission_status);
CREATE INDEX IF NOT EXISTS idx_referrals_suspicious ON referrals(is_suspicious);
