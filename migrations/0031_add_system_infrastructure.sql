-- Migration 0031: System-wide Infrastructure, Security, Compliance & KPIs
-- Epic L: Infrastructure, Security, Privacy, Multi-platform, KPIs

-- ============================================================================
-- L1: Infrastructure & Scalability
-- ============================================================================

-- Background Jobs Queue (for scheduled tasks, reminders, reports)
DO $$
DECLARE
    tenant_id_type text;
BEGIN
    SELECT data_type INTO tenant_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'id';

    IF tenant_id_type = 'uuid' THEN
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS background_jobs (
                id SERIAL PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                job_type VARCHAR(100) NOT NULL,
                job_name VARCHAR(200) NOT NULL,
                queue_name VARCHAR(100) NOT NULL DEFAULT 'default',
                payload JSONB NOT NULL DEFAULT '{}',
                priority INTEGER NOT NULL DEFAULT 5,
                max_attempts INTEGER NOT NULL DEFAULT 3,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                scheduled_at TIMESTAMP WITH TIME ZONE,
                started_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,
                failed_at TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                result JSONB,
                error_message TEXT,
                error_stack TEXT,
                worker_id VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CHECK (priority >= 1 AND priority <= 10),
                CHECK (progress >= 0 AND progress <= 100),
                CHECK (attempt_count >= 0 AND attempt_count <= max_attempts)
            );
        $sql$;
    ELSE
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS background_jobs (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                job_type VARCHAR(100) NOT NULL,
                job_name VARCHAR(200) NOT NULL,
                queue_name VARCHAR(100) NOT NULL DEFAULT 'default',
                payload JSONB NOT NULL DEFAULT '{}',
                priority INTEGER NOT NULL DEFAULT 5,
                max_attempts INTEGER NOT NULL DEFAULT 3,
                attempt_count INTEGER NOT NULL DEFAULT 0,
                scheduled_at TIMESTAMP WITH TIME ZONE,
                started_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,
                failed_at TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50) NOT NULL DEFAULT 'pending',
                progress INTEGER DEFAULT 0,
                result JSONB,
                error_message TEXT,
                error_stack TEXT,
                worker_id VARCHAR(100),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CHECK (priority >= 1 AND priority <= 10),
                CHECK (progress >= 0 AND progress <= 100),
                CHECK (attempt_count >= 0 AND attempt_count <= max_attempts)
            );
        $sql$;
    END IF;
END $$;

-- Indexes for background jobs
CREATE INDEX IF NOT EXISTS idx_background_jobs_tenant ON background_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_scheduled ON background_jobs(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON background_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_queue ON background_jobs(queue_name, status);

-- System Logs (for observability)
DO $$
DECLARE
    tenant_id_type text;
BEGIN
    SELECT data_type INTO tenant_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'id';

    IF tenant_id_type = 'uuid' THEN
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS system_logs (
                id SERIAL PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                log_level VARCHAR(20) NOT NULL,
                component VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                context JSONB DEFAULT '{}',
                request_id VARCHAR(100),
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                error_code VARCHAR(50),
                error_stack TEXT,
                duration_ms INTEGER,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CHECK (log_level IN ('debug', 'info', 'warn', 'error', 'fatal'))
            );
        $sql$;
    ELSE
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS system_logs (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                log_level VARCHAR(20) NOT NULL,
                component VARCHAR(100) NOT NULL,
                message TEXT NOT NULL,
                context JSONB DEFAULT '{}',
                request_id VARCHAR(100),
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                error_code VARCHAR(50),
                error_stack TEXT,
                duration_ms INTEGER,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CHECK (log_level IN ('debug', 'info', 'warn', 'error', 'fatal'))
            );
        $sql$;
    END IF;
END $$;

-- Indexes for system logs
CREATE INDEX IF NOT EXISTS idx_system_logs_tenant ON system_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON system_logs(component);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_request ON system_logs(request_id) WHERE request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_logs_user ON system_logs(user_id) WHERE user_id IS NOT NULL;

-- ============================================================================
-- L2: Security & Privacy
-- ============================================================================

-- Audit Logs (comprehensive action tracking)
DO $$
DECLARE
    tenant_id_type text;
BEGIN
    SELECT data_type INTO tenant_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'id';

    IF tenant_id_type = 'uuid' THEN
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                user_role VARCHAR(50),
                user_email VARCHAR(255),
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(100) NOT NULL,
                entity_id INTEGER,
                old_values JSONB,
                new_values JSONB,
                ip_address INET,
                user_agent TEXT,
                request_id VARCHAR(100),
                endpoint VARCHAR(255),
                http_method VARCHAR(10),
                status VARCHAR(20) NOT NULL,
                failure_reason TEXT,
                is_sensitive BOOLEAN DEFAULT FALSE,
                retention_period_days INTEGER DEFAULT 365,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        $sql$;
    ELSE
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                user_role VARCHAR(50),
                user_email VARCHAR(255),
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(100) NOT NULL,
                entity_id INTEGER,
                old_values JSONB,
                new_values JSONB,
                ip_address INET,
                user_agent TEXT,
                request_id VARCHAR(100),
                endpoint VARCHAR(255),
                http_method VARCHAR(10),
                status VARCHAR(20) NOT NULL,
                failure_reason TEXT,
                is_sensitive BOOLEAN DEFAULT FALSE,
                retention_period_days INTEGER DEFAULT 365,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        $sql$;
    END IF;
END $$;

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_sensitive ON audit_logs(is_sensitive) WHERE is_sensitive = TRUE;

-- ============================================================================
-- L4: KPIs / Metrics
-- ============================================================================

-- Event Tracking (for analytics and KPIs)
DO $$
DECLARE
    tenant_id_type text;
BEGIN
    SELECT data_type INTO tenant_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'id';

    IF tenant_id_type = 'uuid' THEN
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS event_tracking (
                id SERIAL PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                session_id VARCHAR(100),
                event_name VARCHAR(100) NOT NULL,
                event_category VARCHAR(50) NOT NULL,
                properties JSONB DEFAULT '{}',
                platform VARCHAR(20),
                device_type VARCHAR(20),
                country_code VARCHAR(3),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        $sql$;
    ELSE
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS event_tracking (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                session_id VARCHAR(100),
                event_name VARCHAR(100) NOT NULL,
                event_category VARCHAR(50) NOT NULL,
                properties JSONB DEFAULT '{}',
                platform VARCHAR(20),
                device_type VARCHAR(20),
                country_code VARCHAR(3),
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        $sql$;
    END IF;
END $$;

-- Indexes for event tracking
CREATE INDEX IF NOT EXISTS idx_event_tracking_tenant ON event_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_tracking_user ON event_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_event_tracking_event ON event_tracking(event_name);
CREATE INDEX IF NOT EXISTS idx_event_tracking_category ON event_tracking(event_category);
CREATE INDEX IF NOT EXISTS idx_event_tracking_created ON event_tracking(created_at);
CREATE INDEX IF NOT EXISTS idx_event_tracking_session ON event_tracking(session_id) WHERE session_id IS NOT NULL;

-- KPI Metrics (pre-aggregated for performance)
DO $$
DECLARE
    tenant_id_type text;
BEGIN
    SELECT data_type INTO tenant_id_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'id';

    IF tenant_id_type = 'uuid' THEN
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS kpi_metrics (
                id SERIAL PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                metric_name VARCHAR(100) NOT NULL,
                metric_category VARCHAR(50) NOT NULL,
                period_type VARCHAR(20) NOT NULL,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                metric_value DECIMAL(15, 2) NOT NULL,
                metric_unit VARCHAR(50),
                segment_type VARCHAR(50),
                segment_value VARCHAR(100),
                data_source VARCHAR(100),
                calculation_method TEXT,
                sample_size INTEGER,
                target_value DECIMAL(15, 2),
                benchmark_value DECIMAL(15, 2),
                is_final BOOLEAN DEFAULT FALSE,
                calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        $sql$;
    ELSE
        EXECUTE $sql$
            CREATE TABLE IF NOT EXISTS kpi_metrics (
                id SERIAL PRIMARY KEY,
                tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
                metric_name VARCHAR(100) NOT NULL,
                metric_category VARCHAR(50) NOT NULL,
                period_type VARCHAR(20) NOT NULL,
                period_start DATE NOT NULL,
                period_end DATE NOT NULL,
                metric_value DECIMAL(15, 2) NOT NULL,
                metric_unit VARCHAR(50),
                segment_type VARCHAR(50),
                segment_value VARCHAR(100),
                data_source VARCHAR(100),
                calculation_method TEXT,
                sample_size INTEGER,
                target_value DECIMAL(15, 2),
                benchmark_value DECIMAL(15, 2),
                is_final BOOLEAN DEFAULT FALSE,
                calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        $sql$;
    END IF;
END $$;

-- Indexes for KPI metrics
CREATE INDEX IF NOT EXISTS idx_kpi_metrics_tenant ON kpi_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kpi_metrics_name ON kpi_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_kpi_metrics_category ON kpi_metrics(metric_category);
CREATE INDEX IF NOT EXISTS idx_kpi_metrics_period ON kpi_metrics(period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_kpi_metrics_segment ON kpi_metrics(segment_type, segment_value);
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpi_metrics_unique ON kpi_metrics(
    tenant_id, metric_name, period_type, period_start, period_end, 
    COALESCE(segment_type, ''), COALESCE(segment_value, '')
);

-- ============================================================================
-- Triggers for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_background_jobs_updated_at
    BEFORE UPDATE ON background_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kpi_metrics_updated_at
    BEFORE UPDATE ON kpi_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Default KPI Metrics Definitions (for reference)
-- ============================================================================

-- Customer Satisfaction Metrics:
-- - Net Promoter Score (NPS): percentage
-- - Customer Satisfaction Score (CSAT): percentage
-- - App Store Rating: 1-5 scale
-- - Support Response Time: minutes
-- - Issue Resolution Rate: percentage

-- Adherence Rate Metrics:
-- - Workout Adherence: percentage
-- - Nutrition Plan Adherence: percentage
-- - Supplement Adherence: percentage
-- - Overall Plan Adherence: percentage
-- - Streak Length (average): days

-- User Growth Metrics:
-- - Daily Active Users (DAU): count
-- - Monthly Active Users (MAU): count
-- - New User Signups: count
-- - User Retention Rate (7/30/90 day): percentage
-- - Churn Rate: percentage
-- - User Growth Rate: percentage

-- Revenue Metrics:
-- - Monthly Recurring Revenue (MRR): currency
-- - Annual Recurring Revenue (ARR): currency
-- - Average Revenue Per User (ARPU): currency
-- - Customer Lifetime Value (LTV): currency
-- - Conversion Rate (free to paid): percentage
-- - Revenue Growth Rate: percentage

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE background_jobs IS 'Queue for scheduled and background tasks';
COMMENT ON TABLE system_logs IS 'Centralized logging for observability and debugging';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for security and compliance';
COMMENT ON TABLE event_tracking IS 'User behavior and analytics events';
COMMENT ON TABLE kpi_metrics IS 'Pre-aggregated KPI metrics for dashboards';

COMMENT ON COLUMN background_jobs.priority IS '1=highest priority, 10=lowest priority';
COMMENT ON COLUMN system_logs.duration_ms IS 'Operation duration in milliseconds for performance tracking';
COMMENT ON COLUMN audit_logs.is_sensitive IS 'Flag for PII or sensitive data requiring special retention';
COMMENT ON COLUMN kpi_metrics.is_final IS 'True when the period is complete and metric wont change';

-- End of migration
