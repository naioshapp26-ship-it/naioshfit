-- Migration: Add Content Categories Table for Tenants
-- Created: 2026-03-01
-- Description: Create table to store content library categories in tenant databases

CREATE TABLE IF NOT EXISTS content_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories for tenants
INSERT INTO content_categories (name, slug, description, display_order) VALUES
  ('Strength Training', 'strength', 'Weight lifting and resistance exercises', 1),
  ('Cardio', 'cardio', 'Cardiovascular and aerobic exercises', 2),
  ('Flexibility', 'flexibility', 'Stretching and mobility exercises', 3),
  ('Nutrition', 'nutrition', 'Nutrition tips and meal ideas', 4),
  ('Tutorial', 'tutorial', 'Educational and how-to content', 5),
  ('Motivation', 'motivation', 'Inspirational and motivational content', 6),
  ('Workout', 'workout', 'Complete workout routines', 7),
  ('Exercise', 'exercise', 'Individual exercise demonstrations', 8),
  ('Stretching', 'stretching', 'Stretching routines and techniques', 9)
ON CONFLICT (slug) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_content_categories_slug ON content_categories(slug);
CREATE INDEX IF NOT EXISTS idx_content_categories_active ON content_categories(is_active);
