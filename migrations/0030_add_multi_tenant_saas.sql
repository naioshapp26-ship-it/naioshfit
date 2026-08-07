-- Epic K: Multi-Partner SaaS Platform
-- Migration 0030: Add multi-tenant architecture with tenant isolation
-- Created: 2025-12-21

-- ============================================================================
-- PART 1: TENANT MANAGEMENT TABLES
-- ============================================================================

-- Tenants table: Core tenant configuration
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

DO $$
DECLARE
    tenant_id_type text;
BEGIN
    SELECT data_type INTO tenant_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'id';

    IF tenant_id_type IS NULL THEN
        tenant_id_type := 'uuid';
    END IF;

    IF tenant_id_type = 'uuid' THEN
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS tenant_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
                feature_flags JSONB DEFAULT '{}'::jsonb,
                custom_settings JSONB DEFAULT '{}'::jsonb,
                notification_settings JSONB DEFAULT '{}'::jsonb,
                integration_config JSONB DEFAULT '{}'::jsonb,
                security_settings JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        $sql$;
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS partner_admins (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                user_id INTEGER,
                role TEXT NOT NULL DEFAULT 'admin',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        $sql$;
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS tenant_analytics (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                metric_name TEXT NOT NULL,
                metric_value NUMERIC,
                recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        $sql$;
    ELSE
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS tenant_settings (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
                feature_flags JSONB DEFAULT '{}'::jsonb,
                custom_settings JSONB DEFAULT '{}'::jsonb,
                notification_settings JSONB DEFAULT '{}'::jsonb,
                integration_config JSONB DEFAULT '{}'::jsonb,
                security_settings JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        $sql$;
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS partner_admins (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                user_id INTEGER,
                role TEXT NOT NULL DEFAULT 'admin',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        $sql$;
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS tenant_analytics (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                metric_name TEXT NOT NULL,
                metric_value NUMERIC,
                recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        $sql$;
    END IF;

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON tenant_settings(tenant_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_partner_admins_tenant_id ON partner_admins(tenant_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tenant_analytics_tenant_id ON tenant_analytics(tenant_id)';
END $$;

-- Add tenant_id column to all existing tables (if not already present)
DO $$
DECLARE
    tenant_id_type text;
    tbl text;
BEGIN
    SELECT data_type INTO tenant_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'id';

    IF tenant_id_type IS NULL THEN
        tenant_id_type := 'uuid';
    END IF;

    FOREACH tbl IN ARRAY ARRAY[
        'users',
        'supplements',
        'supplement_recommendations',
        'supplement_interactions',
        'user_supplement_warnings',
        'supplement_reminders',
        'supplement_side_effects',
        'supplement_effectiveness_ratings',
        'notifications',
        'reminder_settings',
        'motivational_templates',
        'achievements',
        'missed_workouts',
        'uploaded_files',
        'progress_snapshots',
        'reports',
        'ai_conversations',
        'ai_insights',
        'ai_plan_suggestions',
        'escalation_requests',
        'friendships',
        'achievement_shares',
        'group_challenges',
        'challenge_participants',
        'encouragements',
        'content_reports',
        'groups',
        'group_members',
        'discussion_topics',
        'topic_replies',
        'workshops',
        'workshop_attendees',
        'referrals',
        'content_items',
        'content_ratings',
        'content_bookmarks',
        'payment_methods',
        'payments',
        'subscription_plans',
        'subscriptions',
        'invoices',
        'discount_coupons',
        'financial_transactions',
        'refund_requests',
        'taxonomy_categories',
        'taxonomy_terms',
        'entity_taxonomies',
        'archive_policies',
        'archive_records',
        'search_index',
        'search_history',
        'backup_jobs',
        'restore_jobs',
        'ad_campaigns',
        'ad_placements',
        'ad_metrics',
        'courses',
        'course_modules',
        'course_lessons',
        'course_progress',
        'course_certificates'
    ] LOOP
        IF tenant_id_type = 'uuid' THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id UUID', tbl);
        ELSE
            EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id INTEGER', tbl);
        END IF;

        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_tenant_id ON %I(tenant_id, id)', tbl, tbl);
    END LOOP;
END $$;

ALTER TABLE progress_snapshots ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_progress_snapshots_tenant_id ON progress_snapshots(tenant_id, id);

ALTER TABLE reports ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_reports_tenant_id ON reports(tenant_id, id);

-- AI Assistant (Epic E)
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_tenant_id ON ai_conversations(tenant_id, id);

ALTER TABLE ai_insights ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_tenant_id ON ai_insights(tenant_id, id);

ALTER TABLE ai_plan_suggestions ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_ai_plan_suggestions_tenant_id ON ai_plan_suggestions(tenant_id, id);

ALTER TABLE escalation_requests ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_escalation_requests_tenant_id ON escalation_requests(tenant_id, id);

-- Community & Engagement (Epic F)
ALTER TABLE friendships ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_friendships_tenant_id ON friendships(tenant_id, id);

ALTER TABLE achievement_shares ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_achievement_shares_tenant_id ON achievement_shares(tenant_id, id);

ALTER TABLE group_challenges ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_group_challenges_tenant_id ON group_challenges(tenant_id, id);

ALTER TABLE challenge_participants ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_tenant_id ON challenge_participants(tenant_id, id);

ALTER TABLE encouragements ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_encouragements_tenant_id ON encouragements(tenant_id, id);

ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_content_reports_tenant_id ON content_reports(tenant_id, id);

ALTER TABLE groups ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_groups_tenant_id ON groups(tenant_id, id);

ALTER TABLE group_members ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_group_members_tenant_id ON group_members(tenant_id, id);

ALTER TABLE discussion_topics ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_discussion_topics_tenant_id ON discussion_topics(tenant_id, id);

ALTER TABLE topic_replies ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_topic_replies_tenant_id ON topic_replies(tenant_id, id);

ALTER TABLE workshops ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_workshops_tenant_id ON workshops(tenant_id, id);

ALTER TABLE workshop_attendees ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_workshop_attendees_tenant_id ON workshop_attendees(tenant_id, id);

ALTER TABLE referrals ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_referrals_tenant_id ON referrals(tenant_id, id);

-- Content Hub (Epic G)
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_content_items_tenant_id ON content_items(tenant_id, id);

ALTER TABLE content_ratings ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_content_ratings_tenant_id ON content_ratings(tenant_id, id);

ALTER TABLE content_bookmarks ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_content_bookmarks_tenant_id ON content_bookmarks(tenant_id, id);

-- Payments & Subscriptions (Epic H)
ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_tenant_id ON payment_methods(tenant_id, id);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id, id);

ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_tenant_id ON subscription_plans(tenant_id, id);

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id, id);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id, id);

ALTER TABLE discount_coupons ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_discount_coupons_tenant_id ON discount_coupons(tenant_id, id);

ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_financial_transactions_tenant_id ON financial_transactions(tenant_id, id);

ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_tenant_id ON refund_requests(tenant_id, id);

-- Taxonomy & Archiving (Epic I)
ALTER TABLE taxonomy_categories ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_categories_tenant_id ON taxonomy_categories(tenant_id, id);

ALTER TABLE taxonomy_terms ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_terms_tenant_id ON taxonomy_terms(tenant_id, id);

ALTER TABLE entity_taxonomies ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_entity_taxonomies_tenant_id ON entity_taxonomies(tenant_id, id);

ALTER TABLE archive_policies ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_archive_policies_tenant_id ON archive_policies(tenant_id, id);

ALTER TABLE archive_records ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_archive_records_tenant_id ON archive_records(tenant_id, id);

ALTER TABLE search_index ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_search_index_tenant_id ON search_index(tenant_id, id);

ALTER TABLE search_history ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_search_history_tenant_id ON search_history(tenant_id, id);

ALTER TABLE backup_jobs ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_tenant_id ON backup_jobs(tenant_id, id);

ALTER TABLE restore_jobs ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_restore_jobs_tenant_id ON restore_jobs(tenant_id, id);

-- Ads & Courses (Epic J)
ALTER TABLE ad_campaigns ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_tenant_id ON ad_campaigns(tenant_id, id);

ALTER TABLE ad_placements ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_ad_placements_tenant_id ON ad_placements(tenant_id, id);

ALTER TABLE ad_metrics ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_tenant_id ON ad_metrics(tenant_id, id);

ALTER TABLE courses ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_courses_tenant_id ON courses(tenant_id, id);

ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_course_modules_tenant_id ON course_modules(tenant_id, id);

ALTER TABLE course_lessons ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_course_lessons_tenant_id ON course_lessons(tenant_id, id);

ALTER TABLE course_progress ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_course_progress_tenant_id ON course_progress(tenant_id, id);

ALTER TABLE course_certificates ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);
CREATE INDEX IF NOT EXISTS idx_course_certificates_tenant_id ON course_certificates(tenant_id, id);

-- ============================================================================
-- PART 3: ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable Row-Level Security on all tables
-- Note: In production, you would enable this after setting up proper policies

-- Example RLS policy for users table:
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY tenant_isolation_policy ON users
--     USING (tenant_id = current_setting('app.current_tenant_id')::integer);

-- Similar policies would be created for all other tables

-- ============================================================================
-- PART 4: HELPER FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to tenant tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenants_updated_at') THEN
        EXECUTE 'CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenant_settings_updated_at') THEN
        EXECUTE 'CREATE TRIGGER update_tenant_settings_updated_at BEFORE UPDATE ON tenant_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_partner_admins_updated_at') THEN
        EXECUTE 'CREATE TRIGGER update_partner_admins_updated_at BEFORE UPDATE ON partner_admins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()';
    END IF;
END $$;

-- ============================================================================
-- PART 5: DEFAULT DATA
-- ============================================================================

-- Insert default tenant (for existing single-tenant deployment compatibility)
DO $$
DECLARE
    tenant_id_type text;
BEGIN
    SELECT data_type INTO tenant_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'id';

    IF tenant_id_type = 'integer' THEN
        INSERT INTO tenants (id, name, subdomain, status, created_at)
        VALUES (1, 'Default Tenant', 'app', 'active', CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- Insert default tenant settings
DO $$
DECLARE
    tenant_id_type text;
BEGIN
    SELECT data_type INTO tenant_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'id';

    IF tenant_id_type = 'integer' THEN
        INSERT INTO tenant_settings (tenant_id, feature_flags, custom_settings)
        VALUES (1, '{"all_features_enabled": true}'::jsonb, '{}'::jsonb)
        ON CONFLICT (tenant_id) DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE tenants IS 'Epic K: Multi-tenant SaaS - Tenant management';
COMMENT ON TABLE tenant_settings IS 'Epic K: Multi-tenant SaaS - Tenant configuration and feature flags';
COMMENT ON TABLE partner_admins IS 'Epic K: Multi-tenant SaaS - Partner admin role assignments';
COMMENT ON TABLE tenant_analytics IS 'Epic K: Multi-tenant SaaS - Pre-aggregated tenant metrics';
