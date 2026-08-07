-- Add media support for tenant content creation forms (ads + group challenges)

ALTER TABLE ad_campaigns
  ADD COLUMN IF NOT EXISTS media_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE group_challenges
  ADD COLUMN IF NOT EXISTS media_urls JSONB NOT NULL DEFAULT '[]'::jsonb;
