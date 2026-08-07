-- Add courses and related tables to tenant schema
-- This enables tenants to have their own courses isolated from other tenants

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  
  -- Bilingual content
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  
  -- Course details
  category TEXT NOT NULL,
  level TEXT NOT NULL,
  duration INTEGER,
  
  -- Media
  thumbnail_url TEXT,
  preview_video_url TEXT,
  
  -- Pricing
  price REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  is_free BOOLEAN DEFAULT false,
  
  -- Metadata
  tags JSON DEFAULT '[]'::json,
  instructor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Publishing controls
  status TEXT NOT NULL DEFAULT 'draft',
  featured BOOLEAN DEFAULT false,
  
  -- Certificate
  certificate_enabled BOOLEAN DEFAULT false,
  certificate_template TEXT,
  
  -- Engagement
  enrollment_count INTEGER DEFAULT 0,
  average_rating REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  
  -- Timestamps
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS courses_category_idx ON courses(category);
CREATE INDEX IF NOT EXISTS courses_level_idx ON courses(level);
CREATE INDEX IF NOT EXISTS courses_status_idx ON courses(status);
CREATE INDEX IF NOT EXISTS courses_instructor_idx ON courses(instructor_id);
CREATE INDEX IF NOT EXISTS courses_featured_idx ON courses(featured);

-- Lessons table
CREATE TABLE IF NOT EXISTS lessons (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  
  -- Bilingual content
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  content TEXT,
  content_ar TEXT,
  
  -- Lesson details
  order_index INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL,
  duration INTEGER,
  
  -- Media
  video_url TEXT,
  attachments JSON DEFAULT '[]'::json,
  
  -- Quiz data
  quiz_data JSON,
  
  -- Publishing
  is_preview BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft',
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lessons_course_idx ON lessons(course_id);
CREATE INDEX IF NOT EXISTS lessons_order_idx ON lessons(order_index);
CREATE INDEX IF NOT EXISTS lessons_type_idx ON lessons(type);

-- Course enrollments table
CREATE TABLE IF NOT EXISTS course_enrollments (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Progress tracking
  progress INTEGER DEFAULT 0,
  current_lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  
  -- Certificate
  certificate_issued BOOLEAN DEFAULT false,
  certificate_url TEXT,
  certificate_issued_at TIMESTAMP,
  
  -- Timestamps
  enrolled_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_accessed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS course_enrollments_course_idx ON course_enrollments(course_id);
CREATE INDEX IF NOT EXISTS course_enrollments_user_idx ON course_enrollments(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS course_enrollments_unique ON course_enrollments(course_id, user_id);

-- Lesson progress table
CREATE TABLE IF NOT EXISTS lesson_progress (
  id SERIAL PRIMARY KEY,
  enrollment_id INTEGER NOT NULL REFERENCES course_enrollments(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Progress
  completed BOOLEAN DEFAULT false,
  time_spent INTEGER DEFAULT 0,
  
  -- Quiz results
  quiz_score INTEGER,
  quiz_attempts INTEGER DEFAULT 0,
  
  -- Timestamps
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  last_accessed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS lesson_progress_enrollment_idx ON lesson_progress(enrollment_id);
CREATE INDEX IF NOT EXISTS lesson_progress_lesson_idx ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS lesson_progress_user_idx ON lesson_progress(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS lesson_progress_unique ON lesson_progress(enrollment_id, lesson_id);

-- Course reviews table
CREATE TABLE IF NOT EXISTS course_reviews (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  rating INTEGER NOT NULL,
  review TEXT,
  
  -- Moderation
  is_approved BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS course_reviews_course_idx ON course_reviews(course_id);
CREATE INDEX IF NOT EXISTS course_reviews_user_idx ON course_reviews(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS course_reviews_unique ON course_reviews(course_id, user_id);

-- Course certificates table
CREATE TABLE IF NOT EXISTS course_certificates (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  
  -- Bilingual certificate info
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  template_url TEXT,
  
  -- Issuance settings
  issue_automatically BOOLEAN DEFAULT false,
  issue_upon_completion BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS course_certificates_course_idx ON course_certificates(course_id);
CREATE UNIQUE INDEX IF NOT EXISTS course_certificates_unique ON course_certificates(course_id, title);

-- Course certificate issuances table
CREATE TABLE IF NOT EXISTS course_certificate_issuances (
  id SERIAL PRIMARY KEY,
  certificate_id INTEGER NOT NULL REFERENCES course_certificates(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  
  -- Status
  issued_at TIMESTAMP DEFAULT NOW(),
  certificate_url TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cert_issuances_cert_idx ON course_certificate_issuances(certificate_id);
CREATE INDEX IF NOT EXISTS cert_issuances_user_idx ON course_certificate_issuances(user_id);
CREATE INDEX IF NOT EXISTS cert_issuances_course_idx ON course_certificate_issuances(course_id);
CREATE UNIQUE INDEX IF NOT EXISTS cert_issuances_unique ON course_certificate_issuances(certificate_id, user_id);
