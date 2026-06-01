ALTER TABLE branding_settings
  ADD COLUMN IF NOT EXISTS hero_media_items JSONB NOT NULL DEFAULT '[]'::jsonb;
