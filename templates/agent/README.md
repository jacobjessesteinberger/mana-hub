# Agent Template (legacy contract)

> **Looking for the agent boilerplate?** Use `templates/agent-boilerplate/`
> instead — it ships with `CLAUDE.md`, `MEMORY.md`, `CURRENT.md`, `.mcp.json`,
> `.claude/settings.json`, and the `inbox/` / `outbox/` / `memory/` folders
> wired for the file-drop Bridge.
>
> This page lists the **neutral runtime contract** any agent must satisfy if
> you swap out the boilerplate for your own runner. Read it once, then use
> the boilerplate.

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
