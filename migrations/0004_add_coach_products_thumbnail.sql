-- Add thumbnail_url column to coach_products table
ALTER TABLE "coach_products" ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT;
