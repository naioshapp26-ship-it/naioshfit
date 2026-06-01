-- Epic D: Files & Reports (الملفات والتقارير)
-- D1: File Management (إدارة الملفات)
-- D2: Reporting (التقارير)

-- D1: File Management
CREATE TABLE IF NOT EXISTS uploaded_files (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  file_type TEXT NOT NULL, -- progress_photo, medical_report, pdf, excel, video
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL, -- Secure URL (signed or protected)
  file_size INTEGER NOT NULL, -- In bytes
  mime_type TEXT NOT NULL,
  tags JSONB, -- Array of tags
  description TEXT,
  description_ar TEXT,
  visibility TEXT NOT NULL DEFAULT 'private', -- private, coach_visible, admin_visible
  upload_date TIMESTAMP NOT NULL DEFAULT NOW(),
  linked_entity_type TEXT, -- workout, meal, progress_log, supplement, etc.
  linked_entity_id INTEGER,
  virus_scan_status TEXT DEFAULT 'pending', -- pending, clean, infected, skipped
  virus_scan_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for uploaded_files
CREATE INDEX IF NOT EXISTS uploaded_files_user_idx ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS uploaded_files_coach_idx ON uploaded_files(coach_id);
CREATE INDEX IF NOT EXISTS uploaded_files_type_idx ON uploaded_files(file_type);
CREATE INDEX IF NOT EXISTS uploaded_files_visibility_idx ON uploaded_files(visibility);
CREATE INDEX IF NOT EXISTS uploaded_files_upload_date_idx ON uploaded_files(upload_date);

-- D2: Reports Table
CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL, -- weekly, monthly, custom
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Coach or admin
  report_data JSONB NOT NULL, -- All report metrics as JSON
  pdf_url TEXT, -- Optional PDF export URL
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for reports
CREATE INDEX IF NOT EXISTS reports_user_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_type_idx ON reports(report_type);
CREATE INDEX IF NOT EXISTS reports_period_idx ON reports(period_start, period_end);

-- D2: Progress Snapshots - Weight & Measurements
CREATE TABLE IF NOT EXISTS progress_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  record_date TIMESTAMP NOT NULL,
  weight REAL, -- kg
  body_fat REAL, -- percentage
  muscle_mass REAL, -- kg
  measurements JSONB, -- {chest, waist, hips, arms, thighs, etc}
  photos JSONB, -- Array of uploaded_files IDs
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for progress_snapshots
CREATE INDEX IF NOT EXISTS progress_snap_user_idx ON progress_snapshots(user_id);
CREATE INDEX IF NOT EXISTS progress_snap_date_idx ON progress_snapshots(record_date);
