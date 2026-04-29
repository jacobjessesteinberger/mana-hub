# Agent Template

Use this as the neutral contract for a local Mana Hub agent.

## Minimum Responsibilities

- Read new user messages for its `agent_name`.
- Ignore messages with `metadata.lifecycle_status = retracted`.
- Prefer edited replacement messages over superseded originals.
- Read attachments from `metadata.attachments`.
- Write assistant responses back to `agent_messages`.
- Update `agent_heartbeats.context_usage_percent`.
- Respect `/api/agents/[id]/stop` events and host runner interrupts.

## Suggested Files In User Space

```text
my-agents/
  orchestrator/
    AGENT.md
    run.sh
  researcher/
    AGENT.md
    run.sh
```

Keep this directory outside updateable Core files.
