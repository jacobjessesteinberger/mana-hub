ALTER TABLE goals ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS target_value NUMERIC;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS current_value NUMERIC;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS tracking_source TEXT DEFAULT 'not_connected'
  CHECK (tracking_source IN ('live_api', 'agent_report', 'manual', 'not_connected'));
ALTER TABLE goals ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'low'
  CHECK (confidence IN ('high', 'medium', 'low'));
ALTER TABLE goals ADD COLUMN IF NOT EXISTS source_label TEXT;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_goals_tracking_source ON goals(tracking_source);
CREATE INDEX IF NOT EXISTS idx_goals_deadline ON goals(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goals_project_id ON goals(project_id);
