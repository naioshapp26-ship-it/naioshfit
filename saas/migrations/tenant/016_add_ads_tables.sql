-- Add Ads & Courses tables to tenant schema
-- This enables ad campaign management on tenant databases

-- Ad Campaigns table
CREATE TABLE IF NOT EXISTS ad_campaigns (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    title_ar VARCHAR(255),
    description TEXT,
    description_ar TEXT,
    campaign_type VARCHAR(50) NOT NULL DEFAULT 'general'
        CHECK (campaign_type IN ('offer', 'educational', 'event', 'general')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),

    -- Targeting
    target_segments JSONB,

    -- Scheduling
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    timezone VARCHAR(50) DEFAULT 'Asia/Riyadh',

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
    placement_type VARCHAR(50) NOT NULL DEFAULT 'banner'
        CHECK (placement_type IN ('banner', 'sidebar', 'modal', 'in_feed', 'push_notification', 'email')),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),

    -- Display settings
    frequency_cap INTEGER,
    device_targeting VARCHAR(50)[],
    page_targeting VARCHAR(100)[],

    -- A/B Testing
    variant VARCHAR(50) DEFAULT 'A',

    -- Creative content
    creative_content JSONB,

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

    metric_type VARCHAR(50) NOT NULL
        CHECK (metric_type IN ('impression', 'click', 'conversion')),
    metric_value DECIMAL(10, 2) DEFAULT 1,

    -- Tracking
    session_id VARCHAR(255),
    device_type VARCHAR(50),
    referrer TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ad_metrics_campaign ON ad_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_user ON ad_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_type ON ad_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_created ON ad_metrics(created_at);

-- Auto-update trigger for ad_campaigns
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
        CREATE TRIGGER update_ad_campaigns_updated_at
            BEFORE UPDATE ON ad_campaigns
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ad_placements_updated_at') THEN
        CREATE TRIGGER update_ad_placements_updated_at
            BEFORE UPDATE ON ad_placements
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Track migration
INSERT INTO tenant_migrations (filename, applied_at)
VALUES ('016_add_ads_tables.sql', NOW())
ON CONFLICT DO NOTHING;
