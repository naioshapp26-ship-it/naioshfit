CREATE TABLE IF NOT EXISTS branding_settings (
  id SERIAL PRIMARY KEY,
  primary_color TEXT NOT NULL DEFAULT '#dc2626',
  secondary_color TEXT NOT NULL DEFAULT '#f3f4f6',
  accent_color TEXT NOT NULL DEFAULT '#f97316',
  header_background_color TEXT NOT NULL DEFAULT '#ffffff',
  sidebar_background_color TEXT NOT NULL DEFAULT '#7c2525',
  sidebar_hover_color TEXT NOT NULL DEFAULT '#4a1616',
  badge_background_color TEXT NOT NULL DEFAULT '#dc2626',
  updated_by_user_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
