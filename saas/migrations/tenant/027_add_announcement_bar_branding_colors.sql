-- Add announcement bar color controls to tenant branding settings

ALTER TABLE branding_settings
  ADD COLUMN IF NOT EXISTS announcement_bar_background_color TEXT NOT NULL DEFAULT '#111827',
  ADD COLUMN IF NOT EXISTS announcement_bar_text_color TEXT NOT NULL DEFAULT '#ffffff';
