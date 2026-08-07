-- Platform AI settings (single-row) for main domain
CREATE TABLE IF NOT EXISTS platform_ai_settings (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE,
  ai_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_ai_settings (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;
