-- Add unified Ads Management tables/columns for tenant schema
-- Categories shared by ad campaigns and announcements

CREATE TABLE IF NOT EXISTS marketing_categories (
  id SERIAL PRIMARY KEY,
  name_en VARCHAR(120) NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_categories_active ON marketing_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_marketing_categories_display_order ON marketing_categories(display_order, id);

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES marketing_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_category_id ON ad_campaigns(category_id);

CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title_en VARCHAR(255) NOT NULL,
  title_ar VARCHAR(255) NOT NULL,
  category_id INTEGER REFERENCES marketing_categories(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  show_in_top_bar BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_announcements_status_enabled ON announcements(status, enabled);
CREATE INDEX IF NOT EXISTS idx_announcements_top_bar ON announcements(show_in_top_bar, sort_order, updated_at);
CREATE INDEX IF NOT EXISTS idx_announcements_category_id ON announcements(category_id);

INSERT INTO marketing_categories (name_en, name_ar, slug, is_active, display_order)
VALUES
  ('General', 'عام', 'general', TRUE, 1),
  ('Offers', 'العروض', 'offers', TRUE, 2),
  ('Events', 'الفعاليات', 'events', TRUE, 3),
  ('Education', 'التعليم', 'education', TRUE, 4)
ON CONFLICT (slug) DO NOTHING;
