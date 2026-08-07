-- Create global food items table
CREATE TABLE IF NOT EXISTS "food_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "name_ar" text,
  "brand" text,
  "brand_ar" text,
  "calories" real NOT NULL,
  "proteins" real NOT NULL,
  "carbs" real NOT NULL,
  "fats" real NOT NULL,
  "fiber" real NOT NULL,
  "serving_size" text NOT NULL,
  "serving_size_grams" real NOT NULL,
  "category" text NOT NULL,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indices for efficient searching
CREATE INDEX IF NOT EXISTS "idx_food_items_name" ON "food_items" ("name");
CREATE INDEX IF NOT EXISTS "idx_food_items_name_ar" ON "food_items" ("name_ar");
CREATE INDEX IF NOT EXISTS "idx_food_items_brand" ON "food_items" ("brand");
CREATE INDEX IF NOT EXISTS "idx_food_items_brand_ar" ON "food_items" ("brand_ar");
CREATE INDEX IF NOT EXISTS "idx_food_items_category" ON "food_items" ("category");
CREATE INDEX IF NOT EXISTS "idx_food_items_created_at" ON "food_items" ("created_at" DESC);
