-- ============================================================================
-- Planning Context for Issues — AI-assisted issue planning
-- ============================================================================

ALTER TABLE issues ADD COLUMN IF NOT EXISTS planning_context JSONB DEFAULT NULL;

COMMENT ON COLUMN issues.planning_context IS
  'AI planning conversation that led to this issue — max 100KB';
