CREATE TABLE IF NOT EXISTS public_site_settings (
  id SERIAL PRIMARY KEY,
  quick_links JSON NOT NULL DEFAULT '[]'::json,
  social_links JSON NOT NULL DEFAULT '{}'::json,
  contact_email TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_address TEXT NOT NULL DEFAULT '',
  footer_gradient_from TEXT NOT NULL DEFAULT '#0f172a',
  footer_gradient_to TEXT NOT NULL DEFAULT '#1e293b',
  updated_by_user_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS static_pages (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title_en TEXT NOT NULL DEFAULT '',
  title_ar TEXT NOT NULL DEFAULT '',
  content_en TEXT NOT NULL DEFAULT '',
  content_ar TEXT NOT NULL DEFAULT '',
  updated_by_user_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS static_pages_slug_idx ON static_pages(slug);
