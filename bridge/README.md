# Bridge

This directory documents the local bridge or connector contract. It intentionally does not include private host paths or secrets.

## Supported Starter Modes

- Demo mode: no live bridge required.
- `tmux` mode: local sessions are interrupted through `/api/agents/[id]/stop` when configured.
- Custom connector mode: a user-owned process reads and writes Supabase rows.

## Connector Contract

A connector should:

- Poll or subscribe to `agent_messages`.
- Process only active user messages.
- Ignore retracted and superseded messages.
- Pass attachment metadata to the agent runtime.
- Write assistant replies to `agent_messages`.
- Update `agent_activity` and `agent_heartbeats`.
- Handle stop requests by interrupting the running process or recording a stopped state.

Private connector code can live here during local work, but production secrets and user-specific paths must stay out of Git.
