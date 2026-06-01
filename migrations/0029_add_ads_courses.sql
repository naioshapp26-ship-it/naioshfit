-- Epic J: Ads & Courses (الإعلانات والدورات)
-- Migration: 0029_add_ads_courses.sql

-- ============================================================================
-- J1: Ads/Promotions (الإعلانات)
-- ============================================================================

-- Ad Campaigns table
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255),
    description TEXT,
    description_ar TEXT,
    campaign_type VARCHAR(50) NOT NULL CHECK (campaign_type IN ('offer', 'educational', 'event', 'general')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    
    -- Targeting
    target_segments JSONB, -- demographics, goals, subscription tiers, activity levels
    
    -- Scheduling
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Budgeting
    daily_budget DECIMAL(10, 2),
    total_budget DECIMAL(10, 2),
    total_spent DECIMAL(10, 2) DEFAULT 0,
    
    -- Performance summary
    total_impressions INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_dates ON ad_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_type ON ad_campaigns(campaign_type);

-- Ad Placements table
CREATE TABLE IF NOT EXISTS ad_placements (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    
    placement_type VARCHAR(50) NOT NULL CHECK (placement_type IN ('banner', 'sidebar', 'modal', 'in_feed', 'push_notification', 'email')),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    
    -- Display settings
    frequency_cap INTEGER, -- max impressions per user per day
    device_targeting VARCHAR(50)[], -- ['web', 'mobile', 'tablet']
    page_targeting VARCHAR(100)[], -- pages where ad can appear
    
    -- A/B Testing
    variant VARCHAR(50) DEFAULT 'A',
    
    -- Creative content
    creative_content JSONB, -- image URLs, video URLs, CTA buttons, etc.
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ad_placements_campaign ON ad_placements(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_placements_type ON ad_placements(placement_type);
CREATE INDEX IF NOT EXISTS idx_ad_placements_active ON ad_placements(is_active);

-- Ad Metrics table
CREATE TABLE IF NOT EXISTS ad_metrics (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    placement_id INTEGER REFERENCES ad_placements(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Metrics
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('impression', 'click', 'conversion')),
    metric_value DECIMAL(10, 2) DEFAULT 1, -- for revenue conversions
    
    -- Tracking data
    session_id VARCHAR(255),
    device_type VARCHAR(50),
    referrer TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ad_metrics
    ADD COLUMN IF NOT EXISTS user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_ad_metrics_campaign ON ad_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_user ON ad_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_type ON ad_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_created ON ad_metrics(created_at);

-- ============================================================================
-- J2: Courses (الدورات)
-- ============================================================================

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255),
    description TEXT,
    description_ar TEXT,
    
    -- Course metadata
    course_type VARCHAR(50) NOT NULL DEFAULT 'free' CHECK (course_type IN ('free', 'paid', 'subscription')),
    difficulty VARCHAR(50) CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
    duration_hours DECIMAL(5, 1), -- estimated total hours
    
    -- Pricing
    price DECIMAL(10, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    sale_price DECIMAL(10, 2),
    
    -- Access control
    required_subscription_tier VARCHAR(50), -- from subscription_plans
    prerequisites INTEGER[], -- course IDs that must be completed first
    
    -- Content
    thumbnail_url TEXT,
    intro_video_url TEXT,
    syllabus TEXT,
    syllabus_ar TEXT,
    
    -- Instructor
    instructor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Certification
    certificate_eligible BOOLEAN DEFAULT false,
    certificate_template_id INTEGER,
    
    -- Publishing
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Stats
    total_enrollments INTEGER DEFAULT 0,
    average_rating DECIMAL(3, 2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS course_type VARCHAR(50);

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS is_published BOOLEAN;

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS instructor_id INTEGER;

ALTER TABLE courses
    ADD COLUMN IF NOT EXISTS difficulty VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_courses_type ON courses(course_type);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published);
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_difficulty ON courses(difficulty);

-- Course Modules table
CREATE TABLE IF NOT EXISTS course_modules (
    id SERIAL PRIMARY KEY,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255),
    description TEXT,
    description_ar TEXT,
    
    order_index INTEGER NOT NULL,
    duration_minutes INTEGER, -- estimated duration
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(course_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_course_modules_course ON course_modules(course_id);

-- Course Lessons table
CREATE TABLE IF NOT EXISTS course_lessons (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255),
    description TEXT,
    description_ar TEXT,
    
    -- Content
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('video', 'article', 'quiz', 'assignment', 'resource')),
    content_url TEXT,
    content_text TEXT, -- for articles
    content_text_ar TEXT,
    
    -- Metadata
    order_index INTEGER NOT NULL,
    duration_minutes INTEGER,
    is_free_preview BOOLEAN DEFAULT false,
    
    -- Completion requirements
    requires_completion BOOLEAN DEFAULT true,
    pass_percentage INTEGER, -- for quizzes
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(module_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_course_lessons_module ON course_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_type ON course_lessons(content_type);
CREATE INDEX IF NOT EXISTS idx_course_lessons_preview ON course_lessons(is_free_preview);

-- Course Progress table
CREATE TABLE IF NOT EXISTS course_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    
    -- Enrollment
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    access_expires_at TIMESTAMP WITH TIME ZONE, -- for time-limited access
    
    -- Progress tracking
    status VARCHAR(50) DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    completion_percentage DECIMAL(5, 2) DEFAULT 0,
    
    -- Lesson completion
    completed_lessons JSONB DEFAULT '[]', -- array of lesson IDs
    lesson_scores JSONB DEFAULT '{}', -- {lessonId: score} for quizzes
    
    -- Time tracking
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    
    -- Notes
    user_notes TEXT,
    
    UNIQUE(user_id, course_id)
);

ALTER TABLE course_progress
    ADD COLUMN IF NOT EXISTS user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_course_progress_user ON course_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_course ON course_progress(course_id);
CREATE INDEX IF NOT EXISTS idx_course_progress_status ON course_progress(status);

-- Course Certificates table
CREATE TABLE IF NOT EXISTS course_certificates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    
    certificate_code VARCHAR(100) UNIQUE NOT NULL,
    
    -- Certificate details
    completion_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    final_score DECIMAL(5, 2), -- percentage or grade
    
    -- PDF generation
    pdf_url TEXT,
    generated_at TIMESTAMP WITH TIME ZONE,
    
    -- Verification
    is_verified BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE course_certificates
    ADD COLUMN IF NOT EXISTS user_id INTEGER;

ALTER TABLE course_certificates
    ADD COLUMN IF NOT EXISTS course_id INTEGER;

ALTER TABLE course_certificates
    ADD COLUMN IF NOT EXISTS certificate_code VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_course_certificates_user ON course_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_course_certificates_course ON course_certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_course_certificates_code ON course_certificates(certificate_code);

-- ============================================================================
-- Update triggers for updated_at timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ad_campaigns_updated_at') THEN
        CREATE TRIGGER update_ad_campaigns_updated_at BEFORE UPDATE ON ad_campaigns
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ad_placements_updated_at') THEN
        CREATE TRIGGER update_ad_placements_updated_at BEFORE UPDATE ON ad_placements
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_courses_updated_at') THEN
        CREATE TRIGGER update_courses_updated_at BEFORE UPDATE ON courses
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_course_modules_updated_at') THEN
        CREATE TRIGGER update_course_modules_updated_at BEFORE UPDATE ON course_modules
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_course_lessons_updated_at') THEN
        CREATE TRIGGER update_course_lessons_updated_at BEFORE UPDATE ON course_lessons
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
