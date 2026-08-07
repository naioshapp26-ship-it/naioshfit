-- Migration: Add Announcement Bar Colors to Branding Settings
-- Created: 2026-03-18

ALTER TABLE branding_settings
  ADD COLUMN IF NOT EXISTS announcement_bar_background_color TEXT NOT NULL DEFAULT '#111827',
  ADD COLUMN IF NOT EXISTS announcement_bar_text_color TEXT NOT NULL DEFAULT '#ffffff';
