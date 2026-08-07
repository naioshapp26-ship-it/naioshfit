-- Tenant Migration: Combine WhatsApp fields
-- This applies the same WhatsApp field consolidation from central migration 0011

-- Add new combined whatsapp_with_code field
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "whatsapp_with_code" TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'country_code'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'whatsapp_number'
  ) THEN
    -- Migrate existing data: combine country_code and whatsapp_number
    UPDATE "users" 
    SET "whatsapp_with_code" = CONCAT(
      REPLACE(REPLACE("country_code", '+', ''), '00', ''),
      "whatsapp_number"
    )
    WHERE "whatsapp_number" IS NOT NULL;

    -- Drop the old separate fields
    ALTER TABLE "users" DROP COLUMN "country_code";
    ALTER TABLE "users" DROP COLUMN "whatsapp_number";
  END IF;
END $$;

-- Note: phone_number field is kept as it might be used elsewhere
