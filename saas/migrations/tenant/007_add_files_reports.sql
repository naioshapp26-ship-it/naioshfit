-- Add Files & Reports tables for tenant databases

CREATE TABLE IF NOT EXISTS uploaded_files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    file_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    tags JSON,
    description TEXT,
    description_ar TEXT,
    visibility TEXT NOT NULL DEFAULT 'private',
    upload_date TIMESTAMP NOT NULL DEFAULT NOW(),
    linked_entity_type TEXT,
    linked_entity_id INTEGER,
    virus_scan_status TEXT DEFAULT 'pending',
    virus_scan_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS uploaded_files_user_idx ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS uploaded_files_coach_idx ON uploaded_files(coach_id);
CREATE INDEX IF NOT EXISTS uploaded_files_type_idx ON uploaded_files(file_type);
CREATE INDEX IF NOT EXISTS uploaded_files_visibility_idx ON uploaded_files(visibility);
CREATE INDEX IF NOT EXISTS uploaded_files_upload_date_idx ON uploaded_files(upload_date);

CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    report_data JSON NOT NULL,
    pdf_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_user_idx ON reports(user_id);
CREATE INDEX IF NOT EXISTS reports_type_idx ON reports(report_type);
CREATE INDEX IF NOT EXISTS reports_period_idx ON reports(period_start, period_end);

CREATE TABLE IF NOT EXISTS progress_snapshots (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    record_date TIMESTAMP NOT NULL,
    weight REAL,
    body_fat REAL,
    muscle_mass REAL,
    measurements JSON,
    photos JSON,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS progress_snap_user_idx ON progress_snapshots(user_id);
CREATE INDEX IF NOT EXISTS progress_snap_date_idx ON progress_snapshots(record_date);
