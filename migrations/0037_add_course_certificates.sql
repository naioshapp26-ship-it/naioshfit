-- Create course_certificates table to manage certificate templates and assignments
CREATE TABLE IF NOT EXISTS course_certificates (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  
  -- Certificate template info
  title VARCHAR(255) NOT NULL,
  title_ar VARCHAR(255),
  description TEXT,
  description_ar TEXT,
  template_url TEXT, -- URL to certificate design template
  
  -- Issuance settings
  issue_automatically BOOLEAN DEFAULT false, -- Issue after course completion
  issue_upon_completion BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT course_certificates_unique UNIQUE (course_id, title)
);

CREATE INDEX IF NOT EXISTS course_certificates_course_idx ON course_certificates(course_id);

-- Add junction table for manual certificate issuance
CREATE TABLE IF NOT EXISTS course_certificate_issuances (
  id SERIAL PRIMARY KEY,
  certificate_id INTEGER NOT NULL REFERENCES course_certificates(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  
  -- Status
  issued_at TIMESTAMP DEFAULT NOW(),
  certificate_url TEXT,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT certificate_issuance_unique UNIQUE (certificate_id, user_id)
);

CREATE INDEX IF NOT EXISTS cert_issuances_cert_idx ON course_certificate_issuances(certificate_id);
CREATE INDEX IF NOT EXISTS cert_issuances_user_idx ON course_certificate_issuances(user_id);
CREATE INDEX IF NOT EXISTS cert_issuances_course_idx ON course_certificate_issuances(course_id);
