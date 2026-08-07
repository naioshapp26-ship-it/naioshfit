-- Create coach_products table
CREATE TABLE IF NOT EXISTS "coach_products" (
  "id" SERIAL PRIMARY KEY,
  "coach_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "title" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create index on coach_id for faster lookups
CREATE INDEX IF NOT EXISTS "idx_coach_products_coach_id" ON "coach_products"("coach_id");
