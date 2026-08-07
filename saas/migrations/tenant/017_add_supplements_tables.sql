-- Add Supplements System to Tenant Database
-- Epic A: Supplements Feature + Epic B: Supplements Follow-up

-- A1: Create supplements catalog table
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

CREATE INDEX IF NOT EXISTS supplements_name_idx ON supplements(name);
CREATE INDEX IF NOT EXISTS supplements_global_idx ON supplements(is_global);
CREATE INDEX IF NOT EXISTS supplements_created_by_idx ON supplements(created_by);

-- A2+A3: Create supplement recommendations table (combines dosage and timing guidance)
CREATE TABLE IF NOT EXISTS supplement_recommendations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  supplement_id INTEGER NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
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
  timing_details JSONB,
  
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

CREATE INDEX IF NOT EXISTS supp_rec_user_idx ON supplement_recommendations(user_id);
CREATE INDEX IF NOT EXISTS supp_rec_supplement_idx ON supplement_recommendations(supplement_id);
CREATE INDEX IF NOT EXISTS supp_rec_coach_idx ON supplement_recommendations(coach_id);
CREATE INDEX IF NOT EXISTS supp_rec_status_idx ON supplement_recommendations(status);

-- A4: Create supplement interactions table
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

CREATE INDEX IF NOT EXISTS supp_int_supplement_idx ON supplement_interactions(supplement_id);
CREATE INDEX IF NOT EXISTS supp_int_severity_idx ON supplement_interactions(severity);

-- A4: Create user supplement warnings table
CREATE TABLE IF NOT EXISTS user_supplement_warnings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_id INTEGER NOT NULL REFERENCES supplement_recommendations(id) ON DELETE CASCADE,
  interaction_id INTEGER REFERENCES supplement_interactions(id) ON DELETE SET NULL,
  severity TEXT NOT NULL,
  warning_message TEXT NOT NULL,
  flagged_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, acknowledged, resolved, overridden
  acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_supp_warn_user_idx ON user_supplement_warnings(user_id);
CREATE INDEX IF NOT EXISTS user_supp_warn_rec_idx ON user_supplement_warnings(recommendation_id);
CREATE INDEX IF NOT EXISTS user_supp_warn_status_idx ON user_supplement_warnings(status);
CREATE INDEX IF NOT EXISTS user_supp_warn_severity_idx ON user_supplement_warnings(severity);

-- B1: Create supplement_reminders table
CREATE TABLE IF NOT EXISTS supplement_reminders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_id INTEGER NOT NULL REFERENCES supplement_recommendations(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  reminder_times JSONB, -- Array of times in HH:MM format
  reminder_days JSONB, -- Array of days: monday, tuesday, etc.
  last_sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supp_reminder_user_idx ON supplement_reminders(user_id);
CREATE INDEX IF NOT EXISTS supp_reminder_rec_idx ON supplement_reminders(recommendation_id);
CREATE INDEX IF NOT EXISTS supp_reminder_enabled_idx ON supplement_reminders(enabled);

-- B2: Create supplement_side_effects table
CREATE TABLE IF NOT EXISTS supplement_side_effects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_id INTEGER NOT NULL REFERENCES supplement_recommendations(id) ON DELETE CASCADE,
  supplement_id INTEGER REFERENCES supplements(id) ON DELETE SET NULL,
  severity TEXT NOT NULL, -- mild, moderate, severe, critical
  symptoms TEXT NOT NULL,
  notes TEXT,
  photo TEXT, -- URL or path to photo
  occurred_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active', -- active, resolved, escalated
  escalated_to INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Coach or admin
  escalated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supp_side_eff_user_idx ON supplement_side_effects(user_id);
CREATE INDEX IF NOT EXISTS supp_side_eff_rec_idx ON supplement_side_effects(recommendation_id);
CREATE INDEX IF NOT EXISTS supp_side_eff_severity_idx ON supplement_side_effects(severity);
CREATE INDEX IF NOT EXISTS supp_side_eff_status_idx ON supplement_side_effects(status);

-- B3: Create supplement_effectiveness_ratings table
CREATE TABLE IF NOT EXISTS supplement_effectiveness_ratings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recommendation_id INTEGER NOT NULL REFERENCES supplement_recommendations(id) ON DELETE CASCADE,
  supplement_id INTEGER REFERENCES supplements(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL, -- 1-5 scale
  notes TEXT,
  rating_period_start TIMESTAMP,
  rating_period_end TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS supp_eff_rating_user_idx ON supplement_effectiveness_ratings(user_id);
CREATE INDEX IF NOT EXISTS supp_eff_rating_rec_idx ON supplement_effectiveness_ratings(recommendation_id);
CREATE INDEX IF NOT EXISTS supp_eff_rating_supp_idx ON supplement_effectiveness_ratings(supplement_id);
CREATE INDEX IF NOT EXISTS supp_eff_rating_rating_idx ON supplement_effectiveness_ratings(rating);
