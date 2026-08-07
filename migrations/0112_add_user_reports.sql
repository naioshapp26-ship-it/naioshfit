-- User reports / complaints (technical issues, coach requests, etc.)
CREATE TABLE IF NOT EXISTS user_reports (
  id SERIAL PRIMARY KEY,
  report_id TEXT NOT NULL UNIQUE,
  issue_type TEXT NOT NULL,
  description TEXT NOT NULL,
  user_email TEXT,
  phone_number TEXT,
  screenshot_path TEXT,
  page_url TEXT,
  user_agent TEXT,
  reporter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_reports_created_at ON user_reports(created_at DESC);
