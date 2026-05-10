ALTER TABLE agent_cron_jobs ADD COLUMN IF NOT EXISTS runbook JSONB DEFAULT '{}'::jsonb;
ALTER TABLE agent_cron_jobs ADD COLUMN IF NOT EXISTS runbook_updated_at TIMESTAMPTZ;
ALTER TABLE agent_cron_jobs ADD COLUMN IF NOT EXISTS runbook_quality_score INTEGER DEFAULT 0
  CHECK (runbook_quality_score >= 0 AND runbook_quality_score <= 100);
ALTER TABLE agent_cron_jobs ADD COLUMN IF NOT EXISTS runbook_missing_fields TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE INDEX IF NOT EXISTS idx_agent_cron_jobs_runbook_quality ON agent_cron_jobs(runbook_quality_score);

ALTER TABLE cron_requests ADD COLUMN IF NOT EXISTS improvement_area TEXT;

ALTER TABLE cron_requests DROP CONSTRAINT IF EXISTS cron_requests_improvement_area_check;
ALTER TABLE cron_requests ADD CONSTRAINT cron_requests_improvement_area_check
  CHECK (
    improvement_area IS NULL OR improvement_area IN (
      'trigger',
      'inputs',
      'processing',
      'output',
      'review',
      'sources',
      'research_rules',
      'workflow_steps',
      'output_contract',
      'quality_checks',
      'handoffs',
      'unknowns',
      'general'
    )
  );

CREATE TABLE IF NOT EXISTS agent_skills (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source TEXT DEFAULT 'local'
    CHECK (source IN ('local', 'cloud_hub', 'external', 'manual', 'inferred')),
  version TEXT,
  description TEXT,
  status TEXT DEFAULT 'installed'
    CHECK (status IN ('installed', 'available', 'disabled', 'missing', 'planned')),
  metadata JSONB DEFAULT '{}'::jsonb,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id TEXT REFERENCES agent_cron_jobs(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('knowledge_file', 'agent_file', 'slack_channel', 'external_url', 'api', 'missing')),
  url TEXT,
  kb_file_id TEXT,
  path TEXT,
  section_anchor TEXT,
  access_status TEXT DEFAULT 'unknown'
    CHECK (access_status IN ('available', 'missing', 'unknown', 'planned')),
  purpose TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_skill_refs (
  job_id TEXT REFERENCES agent_cron_jobs(id) ON DELETE CASCADE,
  skill_id TEXT REFERENCES agent_skills(id) ON DELETE CASCADE,
  purpose TEXT,
  kb_refs JSONB DEFAULT '[]'::jsonb,
  override_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (job_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_skills_agent_id ON agent_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_skills_source ON agent_skills(source);
CREATE INDEX IF NOT EXISTS idx_automation_sources_job_id ON automation_sources(job_id);
CREATE INDEX IF NOT EXISTS idx_automation_sources_type ON automation_sources(type);

CREATE TABLE IF NOT EXISTS company_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  source TEXT DEFAULT 'manual'
    CHECK (source IN ('local', 'cloud_hub', 'external', 'manual', 'inferred')),
  source_url TEXT,
  version TEXT,
  status TEXT DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'reviewing', 'safe', 'installed', 'rejected', 'disabled', 'update_available')),
  risk_level TEXT DEFAULT 'medium'
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  quality_score INTEGER DEFAULT 0
    CHECK (quality_score >= 0 AND quality_score <= 100),
  security_score INTEGER DEFAULT 0
    CHECK (security_score >= 0 AND security_score <= 100),
  review_summary TEXT,
  required_permissions TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by TEXT,
  reviewed_at TIMESTAMPTZ,
  installed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_skill_agent_assignments (
  skill_id UUID REFERENCES company_skills(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  status TEXT DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'disabled')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (skill_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_company_skills_status ON company_skills(status);
CREATE INDEX IF NOT EXISTS idx_company_skills_source ON company_skills(source);
CREATE INDEX IF NOT EXISTS idx_company_skill_assignments_agent ON company_skill_agent_assignments(agent_id);
