-- Migration: Add AI Assistant System (Epic E)
-- Created: 2025-12-21
-- Description: Adds AI assistant capabilities including basic Q&A, advanced insights, plan suggestions, and escalation workflow

-- E1: AI Conversations (Basic Assistant)
-- Stores conversation history between users and AI assistant
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('question', 'answer', 'guidance', 'error', 'escalation')),
  message_text TEXT NOT NULL,
  message_text_ar TEXT, -- Arabic translation
  context_data JSONB, -- User context used (plans, recent logs, profile data)
  confidence_score REAL, -- 0.0-1.0 for AI response confidence
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created ON ai_conversations(created_at DESC);

-- E2: AI Insights (Advanced Assistant - Behavior Analysis)
-- Stores AI-generated insights about user behavior and predictions
CREATE TABLE IF NOT EXISTS ai_insights (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('adherence_pattern', 'risk_prediction', 'progress_analysis', 'recommendation')),
  title TEXT NOT NULL, -- Brief title in English
  title_ar TEXT, -- Arabic title
  description TEXT NOT NULL, -- Detailed explanation in English
  description_ar TEXT, -- Arabic description
  key_signals JSONB, -- Array of key data points that led to this insight
  confidence_score REAL NOT NULL, -- 0.0-1.0
  risk_level TEXT CHECK (risk_level IN ('low', 'moderate', 'high', 'critical')),
  trend TEXT CHECK (trend IN ('improving', 'stable', 'declining')),
  language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'ar')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP -- Some insights may be time-limited
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_user ON ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_type ON ai_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_risk ON ai_insights(risk_level) WHERE risk_level IN ('high', 'critical');
CREATE INDEX IF NOT EXISTS idx_ai_insights_active ON ai_insights(is_active, created_at DESC);

-- E2: AI Plan Suggestions (Advanced Assistant - Auto-personalization)
-- Stores AI-generated plan adjustment suggestions requiring coach approval
CREATE TABLE IF NOT EXISTS ai_plan_suggestions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  insight_id INTEGER REFERENCES ai_insights(id) ON DELETE SET NULL,
  suggestion_type TEXT NOT NULL CHECK (suggestion_type IN ('workout_intensity', 'rest_days', 'calorie_target', 'macro_ratio', 'exercise_substitution', 'other')),
  title TEXT NOT NULL,
  title_ar TEXT,
  rationale TEXT NOT NULL, -- Why this change is suggested
  rationale_ar TEXT,
  current_plan JSONB, -- Current plan settings
  suggested_plan JSONB, -- Proposed changes
  diff_summary TEXT, -- Human-readable summary of changes
  diff_summary_ar TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied')),
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  applied_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user ON ai_plan_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_coach ON ai_plan_suggestions(coach_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_plan_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_pending ON ai_plan_suggestions(status, created_at DESC) WHERE status = 'pending';

-- E3: Escalation Requests (Escalation Workflow)
-- Unified escalation tracking for routing complex cases to experts
CREATE TABLE IF NOT EXISTS escalation_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  escalation_type TEXT NOT NULL CHECK (escalation_type IN ('coach_handoff', 'admin_support', 'consultation_booking', 'medical_referral')),
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('side_effect', 'repeated_failure', 'user_request', 'risk_prediction', 'medical_concern', 'ai_assistant')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'scheduled', 'in_progress', 'completed', 'cancelled')),
  title TEXT NOT NULL,
  title_ar TEXT,
  description TEXT NOT NULL,
  description_ar TEXT,
  
  -- Linked entities (optional foreign keys)
  side_effect_id INTEGER REFERENCES supplement_side_effects(id) ON DELETE SET NULL,
  missed_workout_id INTEGER REFERENCES missed_workouts(id) ON DELETE SET NULL,
  insight_id INTEGER REFERENCES ai_insights(id) ON DELETE SET NULL,
  conversation_id INTEGER REFERENCES ai_conversations(id) ON DELETE SET NULL,
  
  -- Assignment and scheduling
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Coach or admin
  assigned_at TIMESTAMP,
  scheduled_at TIMESTAMP, -- For consultation bookings
  
  -- Resolution
  resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_escalation_user ON escalation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_escalation_assigned ON escalation_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_escalation_status ON escalation_requests(status);
CREATE INDEX IF NOT EXISTS idx_escalation_priority ON escalation_requests(priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalation_pending ON escalation_requests(status, priority) WHERE status IN ('pending', 'assigned');
CREATE INDEX IF NOT EXISTS idx_escalation_type ON escalation_requests(escalation_type);

-- Comments
COMMENT ON TABLE ai_conversations IS 'E1: Stores conversation history between users and AI assistant';
COMMENT ON TABLE ai_insights IS 'E2: AI-generated insights about user behavior, risks, and recommendations';
COMMENT ON TABLE ai_plan_suggestions IS 'E2: AI-generated plan adjustments requiring coach approval';
COMMENT ON TABLE escalation_requests IS 'E3: Unified escalation tracking for routing complex cases to experts';

COMMENT ON COLUMN ai_conversations.context_data IS 'User context used: plans, recent logs, profile data';
COMMENT ON COLUMN ai_conversations.confidence_score IS '0.0-1.0 confidence level for AI response';

COMMENT ON COLUMN ai_insights.key_signals IS 'Array of key data points that led to this insight';
COMMENT ON COLUMN ai_insights.risk_level IS 'Risk assessment: low, moderate, high, critical';
COMMENT ON COLUMN ai_insights.trend IS 'Progress trend: improving, stable, declining';

COMMENT ON COLUMN ai_plan_suggestions.diff_summary IS 'Human-readable summary of proposed changes';
COMMENT ON COLUMN ai_plan_suggestions.status IS 'Approval workflow: pending → approved/rejected → applied';

COMMENT ON COLUMN escalation_requests.trigger_source IS 'What triggered escalation: side_effect, repeated_failure, user_request, risk_prediction, medical_concern, ai_assistant';
COMMENT ON COLUMN escalation_requests.escalation_type IS 'Type of escalation: coach_handoff, admin_support, consultation_booking, medical_referral';
