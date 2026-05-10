ALTER TABLE approvals ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'high'
  CHECK (risk_level IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS action_summary TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS risk_reason TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS execution_status TEXT DEFAULT 'waiting_approval'
  CHECK (execution_status IN ('waiting_approval', 'approved_for_execution', 'rejected', 'executed', 'failed', 'expired'));
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS execution_error TEXT;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS feedback_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_approvals_risk_level ON approvals(risk_level);
CREATE INDEX IF NOT EXISTS idx_approvals_expires_at ON approvals(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approvals_execution_status ON approvals(execution_status);
