export const integrations = {
  supabase: {
    required: true,
  },
  anthropic: {
    required: false,
    env: 'ANTHROPIC_API_KEY',
  },
  localAgentConnector: {
    required: false,
    env: 'AGENT_WORKSPACE_DIR',
  },
}
