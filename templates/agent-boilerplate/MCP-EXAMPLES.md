# MCP Server Examples

Drop-in blocks for `.mcp.json`. Pick the ones you need, paste them into the
`mcpServers` object, and put the secrets into this agent's own
`.env` file (next to `CLAUDE.md`, **never** in `.mcp.json` directly and
**never** in the repo).

Reload by restarting `claude` inside the agent's tmux session.

---

## Perplexity (live web search)

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-perplexity-ask"],
      "env": {
        "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}"
      }
    }
  }
}
```

`.env` line: `PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxx`

Get a key: <https://www.perplexity.ai/settings/api>.

## Playwright (browser automation, screenshots, headless tests)

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    }
  }
}
```

No API key. The agent gets `browser_navigate`, `browser_click`,
`browser_screenshot`, etc.

## Context7 (live library / API docs)

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

No key needed for the public version. The agent gets `resolve-library-id`
and `get-library-docs` so it can pull current docs for any library on demand.

## YouTube Data (channel + video metadata)

```json
{
  "mcpServers": {
    "youtube": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-youtube"],
      "env": {
        "YOUTUBE_API_KEY": "${YOUTUBE_API_KEY}"
      }
    }
  }
}
```

`.env` line: `YOUTUBE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXX`

Enable YouTube Data API v3 in <https://console.cloud.google.com/apis> and
create an API key.

## Filesystem (give the agent read access to a folder)

Useful when the agent needs to read your knowledge base or local repo files
without the dashboard's KB indexer.

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/<your-user>/path/to/folder"
      ]
    }
  }
}
```

No env needed. Pin the folder you want exposed — the agent cannot escape it.

## Slack (post + read in your workspace)

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-slack"],
      "env": {
        "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}",
        "SLACK_TEAM_ID": "${SLACK_TEAM_ID}"
      }
    }
  }
}
```

`.env` lines:

```
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxxxxxxxxx
SLACK_TEAM_ID=Txxxxxxxxxx
```

Create a Slack app at <https://api.slack.com/apps>, give it
`channels:read`, `chat:write`, `users:read`, install in your workspace.

---

## Combining multiple servers

`.mcp.json` accepts any number of entries inside `mcpServers`. Use one block
per server. Example with three servers active:

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-perplexity-ask"],
      "env": { "PERPLEXITY_API_KEY": "${PERPLEXITY_API_KEY}" }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

## Permissions

For every server you enable, also add the corresponding tool calls to
`.claude/settings.json` under `permissions.allow` — otherwise Claude Code
will prompt before each tool call, which deadlocks LaunchAgent setups.
Example:

```json
{
  "permissions": {
    "allow": [
      "mcp__perplexity__perplexity_ask",
      "mcp__playwright__browser_navigate",
      "mcp__playwright__browser_screenshot",
      "mcp__context7__resolve-library-id",
      "mcp__context7__get-library-docs"
    ]
  }
}
```

The exact tool names appear in Claude Code's logs the first time you call
each tool — copy them from there.
