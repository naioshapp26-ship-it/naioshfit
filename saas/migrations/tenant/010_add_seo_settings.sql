-- Add SEO settings table (tenant)
CREATE TABLE IF NOT EXISTS seo_settings (
    id SERIAL PRIMARY KEY,
    title_template TEXT NOT NULL,
    meta_description TEXT NOT NULL,
    og_title TEXT,
    og_description TEXT,
    og_image_url TEXT,
    twitter_title TEXT,
    twitter_description TEXT,
    twitter_image_url TEXT,
    robots_index BOOLEAN NOT NULL DEFAULT TRUE,
    robots_follow BOOLEAN NOT NULL DEFAULT TRUE,
    canonical_base_url TEXT,
    hreflang_map JSONB NOT NULL DEFAULT '{}'::jsonb,
    sitemap_includes JSONB NOT NULL DEFAULT '[]'::jsonb,
    sitemap_excludes JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
