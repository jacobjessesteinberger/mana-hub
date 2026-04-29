-- Agent Work OS fields for professional task workflows.
ALTER TABLE issues ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS next_action TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE issues ADD COLUMN IF NOT EXISTS source_id TEXT;

CREATE INDEX IF NOT EXISTS idx_issues_due_at
  ON issues(due_at)
  WHERE due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_issues_source
  ON issues(source_type, source_id)
  WHERE source_type IS NOT NULL;
