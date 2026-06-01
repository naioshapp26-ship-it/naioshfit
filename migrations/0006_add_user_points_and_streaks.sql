CREATE TABLE IF NOT EXISTS "user_points_and_streaks" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL UNIQUE,
  "total_points" integer DEFAULT 0 NOT NULL,
  "current_streak" integer DEFAULT 0 NOT NULL,
  "longest_streak" integer DEFAULT 0 NOT NULL,
  "last_activity_date" timestamp,
  "last_breakfast_log_date" timestamp,
  "last_lunch_log_date" timestamp,
  "last_dinner_log_date" timestamp,
  "last_snack_log_date" timestamp,
  "snack_logs_today" integer DEFAULT 0 NOT NULL,
  "last_workout_log_date" timestamp,
  "last_weight_log_date" timestamp,
  "last_store_purchase_date" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_points_and_streaks_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "user_points_and_streaks"
      ADD CONSTRAINT "user_points_and_streaks_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
