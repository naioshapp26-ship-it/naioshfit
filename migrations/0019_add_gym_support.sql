ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "gym_id" integer REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "users_gym_id_idx" ON "users" ("gym_id");
