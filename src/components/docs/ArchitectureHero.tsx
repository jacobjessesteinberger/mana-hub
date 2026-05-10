'use client'

import { ArrowRight } from 'lucide-react'

/**
 * Statisches Architektur-Schema im "Box-and-Arrow"-Stil. Vier Prozesse,
 * dazwischen die wichtigsten Datenflüsse. Reines HTML/CSS, keine externen
 * Diagramm-Libraries — funktioniert in jedem Theme.
 */
export default function ArchitectureHero() {
  return (
    <div className="card">
      <div className="card-hd">
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Architektur (Big Picture)</h3>
        <span className="badge">vier Prozesse, ein gemeinsames Schema</span>
      </div>
      <div className="docs-arch">
        <div className="docs-arch-row">
          <div className="docs-arch-node">
            <div className="docs-arch-node-label">User</div>
            <div className="docs-arch-node-name">Browser</div>
            <div className="docs-arch-node-meta">Chat, Approvals, Briefings, Outcomes — alles im Dashboard.</div>
          </div>
          <div className="docs-arch-node">
            <div className="docs-arch-node-label">Web App</div>
            <div className="docs-arch-node-name">Next.js Dashboard</div>
            <div className="docs-arch-node-meta">Server- und Client-Komponenten, REST-APIs, Realtime-Subscriptions.</div>
          </div>
          <div className="docs-arch-node">
            <div className="docs-arch-node-label">Backend</div>
            <div className="docs-arch-node-name">Supabase</div>
            <div className="docs-arch-node-meta">Postgres, Auth, RLS, Realtime, Storage. Single Source of Truth.</div>
          </div>
          <div className="docs-arch-node">
            <div className="docs-arch-node-label">Connector</div>
            <div className="docs-arch-node-name">Bridge (Node)</div>
            <div className="docs-arch-node-meta">Polling + Realtime, dispatch von Repliess, Cron-Tick, File-Drop.</div>
          </div>
        </div>

        <div className="docs-arch-flow">
          <span className="docs-arch-flow-line" />
          <ArrowRight size={12} />
          <span>Realtime + REST</span>
          <ArrowRight size={12} />
          <span className="docs-arch-flow-line" />
        </div>

        <div className="docs-arch-row">
          <div className="docs-arch-node">
            <div className="docs-arch-node-label">Agent</div>
            <div className="docs-arch-node-name">Claude Code (tmux)</div>
            <div className="docs-arch-node-meta">Eigener Prozess pro Agent, eigene CLAUDE.md / MEMORY / CURRENT, eigene MCPs.</div>
          </div>
          <div className="docs-arch-node">
            <div className="docs-arch-node-label">Inbox / Outbox</div>
            <div className="docs-arch-node-name">File-Drop</div>
            <div className="docs-arch-node-meta">~/agents/&lt;name&gt;/inbox, outbox, memory — User-Space, nicht im Core-Repo.</div>
          </div>
          <div className="docs-arch-node">
            <div className="docs-arch-node-label">Wissen</div>
            <div className="docs-arch-node-name">Knowledge Base</div>
            <div className="docs-arch-node-meta">Karpathy-Wiki Markdown-Tree, vom Dashboard live indiziert.</div>
          </div>
          <div className="docs-arch-node">
            <div className="docs-arch-node-label">Tools</div>
            <div className="docs-arch-node-name">MCP-Server</div>
            <div className="docs-arch-node-meta">Perplexity, Playwright, Context7 etc. — pro Agent konfigurierbar.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
