-- Epic A: Supplements Feature
-- A1: Supplements Database (Catalog)
-- A2: Dosage Guidance
-- A3: Timing Guidance  
-- A4: Warnings & Interactions

-- Create supplements catalog table
CREATE TABLE IF NOT EXISTS supplements (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  forms JSONB, -- Array of forms: capsule, powder, tablet, liquid, etc.
  ingredients TEXT,
  dosage_range_min REAL,
  dosage_range_max REAL,
  dosage_unit TEXT, -- mg, g, ml, IU, etc.
  contraindications TEXT,
  interactions TEXT,
  warnings TEXT,
  categories JSONB, -- Array of categories: protein, vitamins, minerals, pre_workout, etc.
  evidence_notes TEXT,
  "references" TEXT,
  is_global BOOLEAN NOT NULL DEFAULT true, -- true = admin-curated, false = coach-added
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scope_coach_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- For coach-scoped supplements
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for supplements table
CREATE INDEX IF NOT EXISTS supplements_name_idx ON supplements(name);
CREATE INDEX IF NOT EXISTS supplements_global_idx ON supplements(is_global);
CREATE INDEX IF NOT EXISTS supplements_created_by_idx ON supplements(created_by);

-- Create supplement recommendations table (combines dosage and timing guidance)
CREATE TABLE IF NOT EXISTS supplement_recommendations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplement_id INTEGER NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Nullable to handle coach deletion
  
  -- A2: Dosage Guidance
  dosage_amount REAL NOT NULL,
  dosage_unit TEXT NOT NULL,
  dosage_frequency TEXT NOT NULL, -- daily, twice_daily, with_each_meal, etc.
  max_daily_limit REAL,
  
  -- Coach override
  is_custom_dosage BOOLEAN DEFAULT false,
  dosage_rationale TEXT,
  coach_notes TEXT,
  
  -- A3: Timing Guidance
  timing_type TEXT, -- morning, pre_workout, post_workout, with_meals, before_sleep
  timing_details JSONB, -- JSON object with timing specifics
  
  -- Status and tracking
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, completed, discontinued
  start_date TIMESTAMP NOT NULL DEFAULT NOW(),
  end_date TIMESTAMP,
  
  -- A4: Warnings tracking
  warnings_checked BOOLEAN DEFAULT false,
  warnings_acknowledged BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for supplement_recommendations table
CREATE INDEX IF NOT EXISTS supp_rec_user_idx ON supplement_recommendations(user_id);
CREATE INDEX IF NOT EXISTS supp_rec_supplement_idx ON supplement_recommendations(supplement_id);
CREATE INDEX IF NOT EXISTS supp_rec_coach_idx ON supplement_recommendations(coach_id);
CREATE INDEX IF NOT EXISTS supp_rec_status_idx ON supplement_recommendations(status);

-- Create supplement interactions table (A4: Warnings & Interactions)
CREATE TABLE IF NOT EXISTS supplement_interactions (
  id SERIAL PRIMARY KEY,
  supplement_id INTEGER NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  interacts_with TEXT NOT NULL, -- other supplement name, medication, condition
  interaction_type TEXT NOT NULL, -- supplement, medication, medical_condition, allergy
  severity TEXT NOT NULL, -- mild, moderate, severe, critical
  description TEXT NOT NULL,
  action_required TEXT NOT NULL DEFAULT 'warning', -- warning, confirmation_required, hard_block
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for supplement_interactions table
CREATE INDEX IF NOT EXISTS supp_int_supplement_idx ON supplement_interactions(supplement_id);
CREATE INDEX IF NOT EXISTS supp_int_severity_idx ON supplement_interactions(severity);

-- Create user supplement warnings table (A4: Track flagged users and reasons)
CREATE TABLE IF NOT EXISTS user_supplement_warnings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_id INTEGER NOT NULL REFERENCES supplement_recommendations(id) ON DELETE CASCADE,
  interaction_id INTEGER REFERENCES supplement_interactions(id) ON DELETE SET NULL,
  severity TEXT NOT NULL,
  warning_message TEXT NOT NULL,
  flagged_reason TEXT NOT NULL, -- Details of what triggered the warning
  status TEXT NOT NULL DEFAULT 'pending', -- pending, acknowledged, resolved, overridden
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Coach or admin who acknowledged
  acknowledged_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for user_supplement_warnings table
CREATE INDEX IF NOT EXISTS user_supp_warn_user_idx ON user_supplement_warnings(user_id);
CREATE INDEX IF NOT EXISTS user_supp_warn_rec_idx ON user_supplement_warnings(recommendation_id);
CREATE INDEX IF NOT EXISTS user_supp_warn_status_idx ON user_supplement_warnings(status);
CREATE INDEX IF NOT EXISTS user_supp_warn_severity_idx ON user_supplement_warnings(severity);
