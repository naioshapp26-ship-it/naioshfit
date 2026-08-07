-- Migration 0028: Add Taxonomy, Archiving, Search, and Backup Infrastructure
-- Epic I: Taxonomy, Archiving, Search, Backup

-- I1: Taxonomy - Central taxonomy system for consistent categorization across platform
CREATE TABLE IF NOT EXISTS taxonomy_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    parent_id INTEGER REFERENCES taxonomy_categories(id) ON DELETE SET NULL,
    description TEXT,
    description_ar TEXT,
    icon VARCHAR(255),
    color VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_categories_parent ON taxonomy_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_categories_slug ON taxonomy_categories(slug);
CREATE INDEX IF NOT EXISTS idx_taxonomy_categories_active ON taxonomy_categories(is_active);

-- Taxonomy terms (tags) - flexible tagging system
CREATE TABLE IF NOT EXISTS taxonomy_terms (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES taxonomy_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    name_ar VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    description_ar TEXT,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_category ON taxonomy_terms(category_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_slug ON taxonomy_terms(slug);
CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_active ON taxonomy_terms(is_active);

-- Entity taxonomy mappings - links entities to taxonomy terms
CREATE TABLE IF NOT EXISTS entity_taxonomies (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'supplement', 'content', 'course', 'product', 'report', 'workout', 'meal'
    entity_id INTEGER NOT NULL,
    term_id INTEGER REFERENCES taxonomy_terms(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_type, entity_id, term_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_taxonomies_entity ON entity_taxonomies(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_taxonomies_term ON entity_taxonomies(term_id);

-- I2: Archiving - Archive old/inactive data with policies
CREATE TABLE IF NOT EXISTS archive_policies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- 'user', 'plan', 'message', 'upload', 'report'
    criteria JSONB NOT NULL, -- {"inactive_days": 180, "conditions": {...}}
    action VARCHAR(50) NOT NULL, -- 'soft_delete', 'archive', 'anonymize'
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_archive_policies_entity_type ON archive_policies(entity_type);
CREATE INDEX IF NOT EXISTS idx_archive_policies_active ON archive_policies(is_active);

-- Archive records - track what was archived
CREATE TABLE IF NOT EXISTS archive_records (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER REFERENCES archive_policies(id),
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    original_data JSONB, -- backup of original data
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_by INTEGER REFERENCES users(id),
    restore_requested_at TIMESTAMP,
    restore_requested_by INTEGER REFERENCES users(id),
    restored_at TIMESTAMP,
    restored_by INTEGER REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_archive_records_entity ON archive_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_archive_records_policy ON archive_records(policy_id);
CREATE INDEX IF NOT EXISTS idx_archive_records_archived_at ON archive_records(archived_at);

-- Advanced search index - unified search across platform
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'gyms'
    ) THEN
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS search_index (
                id SERIAL PRIMARY KEY,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                title_ar TEXT,
                content TEXT,
                content_ar TEXT,
                metadata JSONB,
                user_id INTEGER REFERENCES users(id),
                gym_id INTEGER REFERENCES gyms(id),
                coach_id INTEGER REFERENCES users(id),
                visibility VARCHAR(50) DEFAULT 'private',
                is_archived BOOLEAN DEFAULT FALSE,
                indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(entity_type, entity_id)
            );
        $sql$;
    ELSE
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS search_index (
                id SERIAL PRIMARY KEY,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                title_ar TEXT,
                content TEXT,
                content_ar TEXT,
                metadata JSONB,
                user_id INTEGER REFERENCES users(id),
                gym_id INTEGER,
                coach_id INTEGER REFERENCES users(id),
                visibility VARCHAR(50) DEFAULT 'private',
                is_archived BOOLEAN DEFAULT FALSE,
                indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(entity_type, entity_id)
            );
        $sql$;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_search_index_entity ON search_index(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_search_index_user ON search_index(user_id);
CREATE INDEX IF NOT EXISTS idx_search_index_visibility ON search_index(visibility);
CREATE INDEX IF NOT EXISTS idx_search_index_archived ON search_index(is_archived);
-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_search_index_title_fts ON search_index USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_search_index_content_fts ON search_index USING gin(to_tsvector('english', content));

-- Search history - track user searches for analytics
CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    query TEXT NOT NULL,
    filters JSONB,
    results_count INTEGER,
    clicked_result_id INTEGER,
    clicked_result_type VARCHAR(50),
    searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_searched_at ON search_history(searched_at);

-- Backup jobs - track backup/restore operations
CREATE TABLE IF NOT EXISTS backup_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'schema_only', 'data_only'
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    backup_location TEXT, -- S3 URL, file path, etc.
    backup_size_bytes BIGINT,
    tables_included TEXT[], -- array of table names
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    triggered_by INTEGER REFERENCES users(id),
    metadata JSONB, -- additional backup metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_backup_jobs_status ON backup_jobs(status);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_type ON backup_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_created_at ON backup_jobs(created_at);

-- Restore jobs - track restore operations
CREATE TABLE IF NOT EXISTS restore_jobs (
    id SERIAL PRIMARY KEY,
    backup_job_id INTEGER REFERENCES backup_jobs(id),
    restore_type VARCHAR(50) NOT NULL, -- 'full', 'partial', 'point_in_time'
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    tables_to_restore TEXT[],
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    triggered_by INTEGER REFERENCES users(id),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_restore_jobs_backup ON restore_jobs(backup_job_id);
CREATE INDEX IF NOT EXISTS idx_restore_jobs_status ON restore_jobs(status);
CREATE INDEX IF NOT EXISTS idx_restore_jobs_created_at ON restore_jobs(created_at);

-- Insert default taxonomy categories
INSERT INTO taxonomy_categories (name, name_ar, slug, description, description_ar, sort_order) VALUES
('Nutrition Services', 'خدمات التغذية', 'nutrition-services', 'Nutrition-related services and content', 'الخدمات والمحتوى المتعلق بالتغذية', 1),
('Training Services', 'خدمات التدريب', 'training-services', 'Training and workout services', 'خدمات التدريب والتمارين', 2),
('Supplements', 'المكملات', 'supplements', 'Supplements and supplementation', 'المكملات الغذائية', 3),
('Consultations', 'الاستشارات', 'consultations', 'Consultation services', 'خدمات الاستشارات', 4),
('Goals', 'الأهداف', 'goals', 'Fitness and health goals', 'أهداف اللياقة والصحة', 5),
('Conditions', 'الحالات', 'conditions', 'Health conditions and considerations', 'الحالات الصحية', 6)
ON CONFLICT (slug) DO NOTHING;

-- Insert default taxonomy terms for each category
INSERT INTO taxonomy_terms (category_id, name, name_ar, slug) 
SELECT id, 'Weight Loss', 'فقدان الوزن', 'weight-loss' FROM taxonomy_categories WHERE slug = 'nutrition-services'
UNION ALL
SELECT id, 'Muscle Gain', 'بناء العضلات', 'muscle-gain' FROM taxonomy_categories WHERE slug = 'nutrition-services'
UNION ALL
SELECT id, 'Meal Planning', 'تخطيط الوجبات', 'meal-planning' FROM taxonomy_categories WHERE slug = 'nutrition-services'
UNION ALL
SELECT id, 'Strength Training', 'تدريب القوة', 'strength-training' FROM taxonomy_categories WHERE slug = 'training-services'
UNION ALL
SELECT id, 'Cardio', 'تمارين القلب', 'cardio' FROM taxonomy_categories WHERE slug = 'training-services'
UNION ALL
SELECT id, 'Flexibility', 'المرونة', 'flexibility' FROM taxonomy_categories WHERE slug = 'training-services'
UNION ALL
SELECT id, 'Protein Supplements', 'مكملات البروتين', 'protein-supplements' FROM taxonomy_categories WHERE slug = 'supplements'
UNION ALL
SELECT id, 'Vitamins', 'الفيتامينات', 'vitamins' FROM taxonomy_categories WHERE slug = 'supplements'
UNION ALL
SELECT id, 'Pre-Workout', 'ما قبل التمرين', 'pre-workout' FROM taxonomy_categories WHERE slug = 'supplements'
UNION ALL
SELECT id, 'Nutrition Consultation', 'استشارة تغذية', 'nutrition-consultation' FROM taxonomy_categories WHERE slug = 'consultations'
UNION ALL
SELECT id, 'Training Consultation', 'استشارة تدريب', 'training-consultation' FROM taxonomy_categories WHERE slug = 'consultations'
ON CONFLICT (category_id, slug) DO NOTHING;

-- Insert default archive policy for inactive users
INSERT INTO archive_policies (name, entity_type, criteria, action, is_active) VALUES
('Archive Inactive Users', 'user', '{"inactive_days": 180, "no_login": true, "no_activity": true}'::jsonb, 'archive', true),
('Archive Old Messages', 'message', '{"age_days": 365, "status": "delivered"}'::jsonb, 'archive', false),
('Archive Completed Plans', 'plan', '{"age_days": 90, "status": "completed"}'::jsonb, 'archive', false)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE taxonomy_categories IS 'Central taxonomy categories for consistent classification across platform';
COMMENT ON TABLE taxonomy_terms IS 'Taxonomy terms (tags) within categories';
COMMENT ON TABLE entity_taxonomies IS 'Links entities to taxonomy terms for flexible categorization';
COMMENT ON TABLE archive_policies IS 'Policies for automatic archiving of old/inactive data';
COMMENT ON TABLE archive_records IS 'Records of archived entities with restore capability';
COMMENT ON TABLE search_index IS 'Unified search index across all searchable entities';
COMMENT ON TABLE search_history IS 'User search history for analytics and improvements';
COMMENT ON TABLE backup_jobs IS 'Database backup job tracking';
COMMENT ON TABLE restore_jobs IS 'Database restore job tracking';
