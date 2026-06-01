-- Add certificateImages field to coach_info table to store professional certificate images
ALTER TABLE coach_info ADD COLUMN IF NOT EXISTS certificate_images text[];
