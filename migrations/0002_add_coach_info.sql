-- Add coach_info table
CREATE TABLE IF NOT EXISTS "coach_info" (
  "id" SERIAL PRIMARY KEY,
  "coach_id" INTEGER NOT NULL UNIQUE REFERENCES "users"("id"),
  "about_me" TEXT,
  "qualifications" TEXT,
  "training_approach" TEXT,
  "success_stories" TEXT,
  "services_and_programs" TEXT,
  "contact" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on coach_id for faster lookups
CREATE INDEX IF NOT EXISTS "coach_info_coach_id_idx" ON "coach_info"("coach_id");
