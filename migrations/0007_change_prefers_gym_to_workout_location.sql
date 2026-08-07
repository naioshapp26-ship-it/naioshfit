-- Change prefers_gym from boolean to workout_location text field (idempotent)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workout_location" text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'prefers_gym'
  ) THEN
    -- Migrate existing data: true -> 'gym', false -> 'home', null -> null
    UPDATE "users" 
    SET "workout_location" = CASE 
      WHEN "prefers_gym" = true THEN 'gym'
      WHEN "prefers_gym" = false THEN 'home'
      ELSE NULL
    END;

    -- Drop the old column
    ALTER TABLE "users" DROP COLUMN "prefers_gym";
  END IF;
END $$;
