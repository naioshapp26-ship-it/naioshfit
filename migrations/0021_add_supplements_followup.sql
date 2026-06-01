-- Epic B: Supplements Follow-up (المتابعة)
-- B1: Supplement Reminders (تذكير بالمكملات)
-- B2: Side Effects Logging (تسجيل الأعراض الجانبية)
-- B3: Effectiveness Rating (تقييم الفاعلية)

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

-- Indexes for supplement_reminders
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

-- Indexes for supplement_side_effects
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

-- Indexes for supplement_effectiveness_ratings
CREATE INDEX IF NOT EXISTS supp_eff_rating_user_idx ON supplement_effectiveness_ratings(user_id);
CREATE INDEX IF NOT EXISTS supp_eff_rating_rec_idx ON supplement_effectiveness_ratings(recommendation_id);
CREATE INDEX IF NOT EXISTS supp_eff_rating_supp_idx ON supplement_effectiveness_ratings(supplement_id);
CREATE INDEX IF NOT EXISTS supp_eff_rating_rating_idx ON supplement_effectiveness_ratings(rating);
