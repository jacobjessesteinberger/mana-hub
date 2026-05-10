CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  issue_id UUID,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  ticket_id UUID,
  reply_to_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'offline',
  session_uptime_minutes INTEGER,
  context_usage_percent INTEGER,
  tokens_used_today INTEGER,
  last_compaction_at TIMESTAMPTZ,
  current_task TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  active BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'idle',
  current_task TEXT,
  event_summary TEXT,
  permission_pending BOOLEAN DEFAULT FALSE,
  permission_prompt TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  color TEXT,
  owner_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  level TEXT DEFAULT 'project',
  parent_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  project TEXT,
  agent_name TEXT,
  owner_agent TEXT,
  status TEXT DEFAULT 'active',
  progress INTEGER DEFAULT 0,
  target_value NUMERIC,
  current_value NUMERIC,
  unit TEXT,
  deadline TIMESTAMPTZ,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  tracking_source TEXT DEFAULT 'not_connected',
  confidence TEXT DEFAULT 'low',
  source_label TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'medium',
  agent_name TEXT,
  reviewer_agent TEXT,
  project TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  labels TEXT[] DEFAULT ARRAY[]::TEXT[],
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ,
  acceptance_criteria TEXT,
  next_action TEXT,
  blocked_reason TEXT,
  source_type TEXT,
  source_id TEXT,
  result TEXT,
  planning_context JSONB DEFAULT '{}'::jsonb,
  archived BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issue_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  author TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issue_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) ON DELETE CASCADE,
  agent_name TEXT,
  status TEXT DEFAULT 'queued',
  output TEXT,
  tokens_used INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT,
  title TEXT,
  description TEXT,
  action_type TEXT,
  action_payload JSONB DEFAULT '{}'::jsonb,
  action_summary TEXT,
  risk_reason TEXT,
  risk_level TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  execution_status TEXT DEFAULT 'waiting_approval',
  reviewer_feedback TEXT,
  reason TEXT,
  policy_id UUID,
  related_issue_id UUID REFERENCES issues(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  feedback_sent_at TIMESTAMPTZ,
  decided_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approval_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'risk_level',
  trigger_value TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'approvals_policy_id_fkey'
      AND conrelid = 'approvals'::regclass
  ) THEN
    ALTER TABLE approvals
      ADD CONSTRAINT approvals_policy_id_fkey
      FOREIGN KEY (policy_id)
      REFERENCES approval_policies(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS agent_cron_jobs (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  schedule_hour INTEGER,
  schedule_minute INTEGER,
  schedule_day INTEGER,
  output_to_slack BOOLEAN DEFAULT FALSE,
  http_target TEXT,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cron_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
  job_name TEXT NOT NULL,
  schedule_hour INTEGER,
  schedule_minute INTEGER,
  schedule_day INTEGER,
  prompt TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  target_job_id TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  proposed_changes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_cron_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_requests ENABLE ROW LEVEL SECURITY;

-- WARNING: Mana Hub Starter ships single-tenant. The default RLS policies grant
-- full read/write to every authenticated user. For multi-tenant deployments,
-- restrict per (auth.uid() = owner_id) or similar. See SECURITY.md.

DROP POLICY IF EXISTS "authenticated_all_agent_messages" ON agent_messages;
CREATE POLICY "authenticated_all_agent_messages" ON agent_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_agent_heartbeats" ON agent_heartbeats;
CREATE POLICY "authenticated_all_agent_heartbeats" ON agent_heartbeats FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_agent_activity" ON agent_activity;
CREATE POLICY "authenticated_all_agent_activity" ON agent_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_projects" ON projects;
CREATE POLICY "authenticated_all_projects" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_goals" ON goals;
CREATE POLICY "authenticated_all_goals" ON goals FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_issues" ON issues;
CREATE POLICY "authenticated_all_issues" ON issues FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_issue_comments" ON issue_comments;
CREATE POLICY "authenticated_all_issue_comments" ON issue_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_issue_runs" ON issue_runs;
CREATE POLICY "authenticated_all_issue_runs" ON issue_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_approvals" ON approvals;
CREATE POLICY "authenticated_all_approvals" ON approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_approval_policies" ON approval_policies;
CREATE POLICY "authenticated_all_approval_policies" ON approval_policies FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_agent_cron_jobs" ON agent_cron_jobs;
CREATE POLICY "authenticated_all_agent_cron_jobs" ON agent_cron_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_cron_requests" ON cron_requests;
CREATE POLICY "authenticated_all_cron_requests" ON cron_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_agent_messages_agent_created ON agent_messages(agent_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_reply_to ON agent_messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON agent_activity(agent_name);
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_goals_project_id ON goals(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_project_id ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_agent_status ON issues(agent_name, status);
CREATE INDEX IF NOT EXISTS idx_issue_runs_agent_status ON issue_runs(agent_name, status);
CREATE INDEX IF NOT EXISTS idx_approvals_status_requested ON approvals(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_approvals_agent_status ON approvals(agent_name, status);
