-- Add content tables to tenant schema
-- This enables tenants to have blog posts, videos, and content library

-- Groups table (required by content_items FK)
CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  description_ar TEXT,
  goal_type TEXT NOT NULL DEFAULT 'general_fitness',
  group_type TEXT NOT NULL DEFAULT 'public',
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  max_members INTEGER,
  member_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS groups_owner_idx ON groups(owner_id);
CREATE INDEX IF NOT EXISTS groups_goal_idx ON groups(goal_type);
CREATE INDEX IF NOT EXISTS groups_type_idx ON groups(group_type);

-- Group Members table
CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'active',
  joined_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS group_members_group_idx ON group_members(group_id);
CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members(user_id);
CREATE INDEX IF NOT EXISTS group_members_role_idx ON group_members(role);
CREATE INDEX IF NOT EXISTS group_members_status_idx ON group_members(status);

-- Content Library table (for coach videos and media)
CREATE TABLE IF NOT EXISTS content_library (
  id SERIAL PRIMARY KEY,
  coach_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  category TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  duration INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_library_coach_idx ON content_library(coach_id);
CREATE INDEX IF NOT EXISTS content_library_type_idx ON content_library(type);
CREATE INDEX IF NOT EXISTS content_library_category_idx ON content_library(category);

-- Content Items table (for blog posts, articles, etc.)
CREATE TABLE IF NOT EXISTS content_items (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  content TEXT NOT NULL,
  content_ar TEXT,
  tags JSON DEFAULT '[]'::json,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'public',
  featured BOOLEAN DEFAULT false,
  type_metadata JSON DEFAULT '{}'::json,
  view_count INTEGER DEFAULT 0,
  average_rating REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_items_type_idx ON content_items(type);
CREATE INDEX IF NOT EXISTS content_items_category_idx ON content_items(category);
CREATE INDEX IF NOT EXISTS content_items_status_idx ON content_items(status);
CREATE INDEX IF NOT EXISTS content_items_visibility_idx ON content_items(visibility);
CREATE INDEX IF NOT EXISTS content_items_author_idx ON content_items(author_id);
CREATE INDEX IF NOT EXISTS content_items_coach_idx ON content_items(coach_id);
CREATE INDEX IF NOT EXISTS content_items_group_idx ON content_items(group_id);
CREATE INDEX IF NOT EXISTS content_items_featured_idx ON content_items(featured);

-- Content Ratings table
CREATE TABLE IF NOT EXISTS content_ratings (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  review_text TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_ratings_content_idx ON content_ratings(content_id);
CREATE INDEX IF NOT EXISTS content_ratings_user_idx ON content_ratings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS content_ratings_unique ON content_ratings(content_id, user_id);

-- Content Bookmarks table
CREATE TABLE IF NOT EXISTS content_bookmarks (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  progress_percent INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_bookmarks_content_idx ON content_bookmarks(content_id);
CREATE INDEX IF NOT EXISTS content_bookmarks_user_idx ON content_bookmarks(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS content_bookmarks_unique ON content_bookmarks(content_id, user_id);
