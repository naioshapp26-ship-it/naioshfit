-- Epic C: Smart Alerts & Notifications (التنبيهات الذكية)
-- C1: Meal Reminders
-- C2: Workout Reminders & Missed Detection
-- C3: Supplements Reminders (integrated with Epic B1)
-- C4: Sleep & Water Reminders
-- C5: Motivational Messages
-- C6: Achievement Notifications

-- Unified Notifications System
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- meal, workout, supplement, sleep, water, motivational, achievement
  title TEXT NOT NULL,
  title_ar TEXT,
  message TEXT NOT NULL,
  message_ar TEXT,
  scheduled_for TIMESTAMP,
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, read, dismissed
  related_entity_type TEXT, -- recommendation, workout, meal, etc.
  related_entity_id INTEGER,
  metadata JSONB, -- Additional context data
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS notif_user_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notif_type_idx ON notifications(type);
CREATE INDEX IF NOT EXISTS notif_status_idx ON notifications(status);
CREATE INDEX IF NOT EXISTS notif_scheduled_idx ON notifications(scheduled_for);

-- Reminder Settings (C1, C2, C3, C4)
CREATE TABLE IF NOT EXISTS reminder_settings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- meal, workout, supplement, sleep, water
  enabled BOOLEAN NOT NULL DEFAULT true,
  times JSONB, -- Array of HH:MM times
  days JSONB, -- Array of day names
  custom_message TEXT,
  custom_message_ar TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for reminder_settings
CREATE INDEX IF NOT EXISTS reminder_set_user_idx ON reminder_settings(user_id);
CREATE INDEX IF NOT EXISTS reminder_set_type_idx ON reminder_settings(reminder_type);
CREATE INDEX IF NOT EXISTS reminder_set_enabled_idx ON reminder_settings(enabled);
CREATE UNIQUE INDEX IF NOT EXISTS reminder_set_user_type_idx ON reminder_settings(user_id, reminder_type);

-- C5: Motivational Message Templates
CREATE TABLE IF NOT EXISTS motivational_templates (
  id SERIAL PRIMARY KEY,
  trigger TEXT NOT NULL, -- streak_achieved, inactivity_detected, goal_milestone, etc.
  title TEXT NOT NULL,
  title_ar TEXT,
  message TEXT NOT NULL,
  message_ar TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER DEFAULT 0,
  min_streak_days INTEGER, -- For streak_achieved trigger
  inactivity_days INTEGER, -- For inactivity_detected trigger
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for motivational_templates
CREATE INDEX IF NOT EXISTS motiv_tmpl_trigger_idx ON motivational_templates(trigger);
CREATE INDEX IF NOT EXISTS motiv_tmpl_active_idx ON motivational_templates(is_active);

-- C6: Achievements
CREATE TABLE IF NOT EXISTS achievements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL, -- workout_streak, nutrition_adherence, weight_milestone, supplement_adherence
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT,
  description_ar TEXT,
  value INTEGER, -- Numeric value (e.g., 7 for 7-day streak)
  metadata JSONB,
  achieved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notification_sent BOOLEAN DEFAULT false
);

-- Indexes for achievements
CREATE INDEX IF NOT EXISTS achievement_user_idx ON achievements(user_id);
CREATE INDEX IF NOT EXISTS achievement_type_idx ON achievements(achievement_type);
CREATE INDEX IF NOT EXISTS achievement_achieved_idx ON achievements(achieved_at);

-- C2: Missed Workouts Tracking
CREATE TABLE IF NOT EXISTS missed_workouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMP NOT NULL,
  workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
  notification_sent BOOLEAN DEFAULT false,
  coach_notified BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for missed_workouts
CREATE INDEX IF NOT EXISTS missed_workout_user_idx ON missed_workouts(user_id);
CREATE INDEX IF NOT EXISTS missed_workout_scheduled_idx ON missed_workouts(scheduled_date);
