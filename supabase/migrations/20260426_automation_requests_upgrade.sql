ALTER TABLE cron_requests ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'automation_change'
  CHECK (request_type IN ('automation_create', 'automation_update', 'automation_delete', 'automation_improve', 'automation_change'));
ALTER TABLE cron_requests ADD COLUMN IF NOT EXISTS proposed_changes JSONB DEFAULT '{}'::jsonb;
ALTER TABLE cron_requests ADD COLUMN IF NOT EXISTS current_snapshot JSONB DEFAULT '{}'::jsonb;
ALTER TABLE cron_requests ADD COLUMN IF NOT EXISTS user_feedback TEXT;
ALTER TABLE cron_requests ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'medium'
  CHECK (risk_level IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE cron_requests ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'
  CHECK (source IN ('manual', 'agent', 'system'));
ALTER TABLE cron_requests ADD COLUMN IF NOT EXISTS improvement_area TEXT
  CHECK (improvement_area IS NULL OR improvement_area IN ('trigger', 'inputs', 'processing', 'output', 'review', 'general'));

ALTER TABLE agent_cron_jobs ADD COLUMN IF NOT EXISTS automation_type TEXT DEFAULT 'agent_cron'
  CHECK (automation_type IN ('agent_cron', 'http_cron', 'self_cron'));
ALTER TABLE agent_cron_jobs ADD COLUMN IF NOT EXISTS output_kind TEXT DEFAULT 'cron'
  CHECK (output_kind IN ('cron', 'briefing', 'task', 'outcome', 'finance_action'));
ALTER TABLE agent_cron_jobs ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'low'
  CHECK (risk_level IN ('low', 'medium', 'high', 'critical'));

CREATE INDEX IF NOT EXISTS idx_cron_requests_request_type ON cron_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_cron_requests_risk_level ON cron_requests(risk_level);
CREATE INDEX IF NOT EXISTS idx_agent_cron_jobs_type ON agent_cron_jobs(automation_type);
