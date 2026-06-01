-- Migration: Add Educational Content Hub (Epic G)
-- Description: Content management system for articles, videos, FAQs, and success stories
-- Epic: G - Educational Content Hub

-- Content Items Table
CREATE TABLE IF NOT EXISTS content_items (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('article', 'video', 'faq', 'story')),
  category VARCHAR(50) NOT NULL CHECK (category IN ('nutrition', 'workout', 'supplement', 'mindset', 'recovery', 'general')),
  
  -- Bilingual content
  title VARCHAR(255) NOT NULL,
  title_ar VARCHAR(255),
  description TEXT,
  description_ar TEXT,
  content TEXT NOT NULL,
  content_ar TEXT,
  
  -- Metadata
  tags JSONB DEFAULT '[]'::jsonb,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  
  -- Publishing controls
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'trainees_only', 'group_only', 'admin_only')),
  featured BOOLEAN DEFAULT FALSE,
  
  -- Type-specific fields (JSONB for flexibility)
  -- For video: {url, duration, thumbnail}
  -- For story: {before_weight, after_weight, duration_weeks, photos}
  -- For faq: {question, answer}
  type_metadata JSONB DEFAULT '{}',
  
  -- Engagement tracking
  view_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  
  -- Timestamps
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Content Ratings Table
CREATE TABLE IF NOT EXISTS content_ratings (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(content_id, user_id)
);

-- Content Bookmarks Table
CREATE TABLE IF NOT EXISTS content_bookmarks (
  id SERIAL PRIMARY KEY,
  content_id INTEGER NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  completed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(content_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_items_type ON content_items(type);
CREATE INDEX IF NOT EXISTS idx_content_items_category ON content_items(category);
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_visibility ON content_items(visibility);
CREATE INDEX IF NOT EXISTS idx_content_items_author ON content_items(author_id);
CREATE INDEX IF NOT EXISTS idx_content_items_coach ON content_items(coach_id);
CREATE INDEX IF NOT EXISTS idx_content_items_group ON content_items(group_id);
CREATE INDEX IF NOT EXISTS idx_content_items_featured ON content_items(featured);
CREATE INDEX IF NOT EXISTS idx_content_items_tags ON content_items USING GIN ((tags::jsonb));
CREATE INDEX IF NOT EXISTS idx_content_ratings_content ON content_ratings(content_id);
CREATE INDEX IF NOT EXISTS idx_content_ratings_user ON content_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_content ON content_bookmarks(content_id);
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_user ON content_bookmarks(user_id);
