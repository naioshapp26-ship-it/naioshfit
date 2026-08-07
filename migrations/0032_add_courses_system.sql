-- Create courses table
CREATE TABLE IF NOT EXISTS "courses" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "title_ar" TEXT,
  "description" TEXT,
  "description_ar" TEXT,
  "category" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "duration" INTEGER,
  "thumbnail_url" TEXT,
  "preview_video_url" TEXT,
  "price" REAL DEFAULT 0,
  "currency" TEXT DEFAULT 'USD',
  "is_free" BOOLEAN DEFAULT false,
  "tags" JSON DEFAULT '[]',
  "instructor_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "featured" BOOLEAN DEFAULT false,
  "certificate_enabled" BOOLEAN DEFAULT false,
  "certificate_template" TEXT,
  "enrollment_count" INTEGER DEFAULT 0,
  "average_rating" REAL DEFAULT 0,
  "rating_count" INTEGER DEFAULT 0,
  "published_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create lessons table
CREATE TABLE IF NOT EXISTS "lessons" (
  "id" SERIAL PRIMARY KEY,
  "course_id" INTEGER NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "title_ar" TEXT,
  "description" TEXT,
  "description_ar" TEXT,
  "content" TEXT,
  "content_ar" TEXT,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "type" TEXT NOT NULL,
  "duration" INTEGER,
  "video_url" TEXT,
  "attachments" JSON DEFAULT '[]',
  "quiz_data" JSON,
  "is_preview" BOOLEAN DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create course enrollments table
CREATE TABLE IF NOT EXISTS "course_enrollments" (
  "id" SERIAL PRIMARY KEY,
  "course_id" INTEGER NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "progress" INTEGER DEFAULT 0,
  "current_lesson_id" INTEGER REFERENCES "lessons"("id") ON DELETE SET NULL,
  "completed" BOOLEAN DEFAULT false,
  "completed_at" TIMESTAMP,
  "certificate_issued" BOOLEAN DEFAULT false,
  "certificate_url" TEXT,
  "certificate_issued_at" TIMESTAMP,
  "enrolled_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "last_accessed_at" TIMESTAMP
);

-- Create lesson progress table
CREATE TABLE IF NOT EXISTS "lesson_progress" (
  "id" SERIAL PRIMARY KEY,
  "enrollment_id" INTEGER NOT NULL REFERENCES "course_enrollments"("id") ON DELETE CASCADE,
  "lesson_id" INTEGER NOT NULL REFERENCES "lessons"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "completed" BOOLEAN DEFAULT false,
  "time_spent" INTEGER DEFAULT 0,
  "quiz_score" INTEGER,
  "quiz_attempts" INTEGER DEFAULT 0,
  "started_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "completed_at" TIMESTAMP,
  "last_accessed_at" TIMESTAMP
);

-- Create course reviews table
CREATE TABLE IF NOT EXISTS "course_reviews" (
  "id" SERIAL PRIMARY KEY,
  "course_id" INTEGER NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rating" INTEGER NOT NULL,
  "review" TEXT,
  "is_approved" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for courses
CREATE INDEX IF NOT EXISTS "courses_category_idx" ON "courses"("category");
CREATE INDEX IF NOT EXISTS "courses_level_idx" ON "courses"("level");
CREATE INDEX IF NOT EXISTS "courses_status_idx" ON "courses"("status");
CREATE INDEX IF NOT EXISTS "courses_instructor_idx" ON "courses"("instructor_id");
CREATE INDEX IF NOT EXISTS "courses_featured_idx" ON "courses"("featured");

-- Create indexes for lessons
CREATE INDEX IF NOT EXISTS "lessons_course_idx" ON "lessons"("course_id");
CREATE INDEX IF NOT EXISTS "lessons_order_idx" ON "lessons"("order_index");
CREATE INDEX IF NOT EXISTS "lessons_type_idx" ON "lessons"("type");

-- Create indexes for course enrollments
CREATE INDEX IF NOT EXISTS "course_enrollments_course_idx" ON "course_enrollments"("course_id");
CREATE INDEX IF NOT EXISTS "course_enrollments_user_idx" ON "course_enrollments"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "course_enrollments_unique" ON "course_enrollments"("course_id", "user_id");

-- Create indexes for lesson progress
CREATE INDEX IF NOT EXISTS "lesson_progress_enrollment_idx" ON "lesson_progress"("enrollment_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_lesson_idx" ON "lesson_progress"("lesson_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_user_idx" ON "lesson_progress"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_progress_unique" ON "lesson_progress"("enrollment_id", "lesson_id");

-- Create indexes for course reviews
CREATE INDEX IF NOT EXISTS "course_reviews_course_idx" ON "course_reviews"("course_id");
CREATE INDEX IF NOT EXISTS "course_reviews_user_idx" ON "course_reviews"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "course_reviews_unique" ON "course_reviews"("course_id", "user_id");
