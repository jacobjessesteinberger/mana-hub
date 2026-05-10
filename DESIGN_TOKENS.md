# Mana Hub — Design Tokens

> **Authoritative source is the code** (`src/app/globals.css`, the dashboard
> components). If this document and the code disagree, the code wins. This
> file exists so contributors and theme adapters know what tokens are
> intended to remain stable across releases.

## Farben

### Light Mode
| Token | Wert |
|---|---|
| `--bg` | `#F7F7F8` |
| `--bg-elev` | `#FFFFFF` |
| `--bg-sunk` | `#F1F1F3` |
| `--bg-hover` | `rgba(0,0,0,0.035)` |
| `--bg-active` | `rgba(0,0,0,0.055)` |
| `--fg` | `#0B0B0F` |
| `--fg-muted` | `#52525B` |
| `--fg-subtle` | `#71717A` |
| `--fg-faint` | `#A1A1AA` |
| `--border` | `rgba(0,0,0,0.07)` |
| `--border-strong` | `rgba(0,0,0,0.12)` |
| `--accent` | `#10B981` (Emerald, **NICHT** Indigo!) |
| `--accent-soft` | `rgba(16,185,129,0.10)` |
| `--accent-strong` | `#059669` |
| `--accent-fg` | `#052E20` |
| `--ok` | `#10B981` |
| `--warn` | `#D97706` |
| `--err` | `#DC2626` (**NICHT** `--danger`) |
| `--info` | `#2563EB` |
| `--demo` | `#D97706` |
| `--prod` | `#10B981` |

### Dark Mode
| Token | Wert |
|---|---|
| `--bg` | `#1C1C1F` |
| `--bg-elev` | `#26262B` |
| `--bg-sunk` | `#18181B` |
| `--fg` | `#F4F4F5` |
| `--fg-muted` | `#A1A1AA` |
| `--accent` | `#34D399` |
| `--accent-strong` | `#6EE7B7` |
| `--err` | `#F87171` |

## Typografie

| Token | Wert |
|---|---|
| `--font-sans` | `'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif` |
| `--font-mono` | `ui-monospace, 'SF Mono', Menlo, Consolas, monospace` |

> **Wichtig:** Inter wird via `next/font/google` (Weights 400/500/600/700) eingebunden.
> `--font-display` existiert in der Vorlage **NICHT** und darf nicht verwendet werden.

### Body
- `font-size: 13.5px`, `line-height: 1.5`
- `font-feature-settings: "cv11", "ss01"`
- `-webkit-font-smoothing: antialiased`

### Headings
- `.ph h1`: **22px / 600 / -0.015em** (Mobile @720: 19px, @480: 18px)
- `.card-hd h3`: **13.5px / 600 / -0.005em**
- `.step h4`: **14px / 600 / -0.005em**
- `.ph-sub`: 13px, color `--fg-muted`, max-width 720px
- `.briefing-body`: 14px / line-height 1.65, max-width 68ch

### Sidebar
- `.sb-section`: **10px / 600 / 0.08em letter-spacing / UPPERCASE**, color `--fg-faint`
- `.sb-item`: **13px**, height 32px, active weight 500

## Border-Radien

| Token | Wert |
|---|---|
| `--r-sm` | `8px` (**NICHT** 10px wie im README behauptet) |
| `--r-md` | `12px` (**NICHT** 14px) |
| `--r-lg` | `16px` (**NICHT** 18px) |
| `--r-xl` | `22px` (fehlt im README) |
| `--r-card` | `24px` |

Buttons, Badges, Tabs, Inputs: alle `border-radius: 999px` (Pill).
Sidebar: `24px`. KBD: `4px` (oder `6px`).

## Glas-Effekt (existiert tatsächlich!)

- `.card`: `backdrop-filter: blur(20px) saturate(160%)`, background `rgba(255,255,255,0.62)` light / `rgba(22,22,26,0.55)` dark
- `.sb`: `backdrop-filter: blur(24px) saturate(160%)`, background `rgba(255,255,255,0.72)` light / `rgba(22,22,26,0.65)` dark
- `.modal-bg`: `backdrop-filter: blur(4px)`
- `.sb-backdrop`: `backdrop-filter: blur(2px)`

## Schatten

| Token | Wert |
|---|---|
| `--shadow-card` | `0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.04)` |

> `--shadow-pop` und `--shadow-glass` aus dem README **existieren nicht** im Code.

## Layout

| Token | Wert |
|---|---|
| `--sb-w` | `232px` Desktop (collapse @1180 → 64px) |
| `--hero-glow` | `radial-gradient(120% 100% at 0% 0%, rgba(16,185,129,0.08), transparent 60%)` |

## Per-Agent Farben (aus `shell.jsx` Zeile 36-42)

| Agent | Farbe | Rolle |
|---|---|---|
| Orchestrator | `#F59E0B` | Amber (Coordination) |
| Researcher | `#06B6D4` | Cyan (Research) |
| Creator | `#8B5CF6` | Violet (Content) |
| Operator | `#10B981` | Emerald (Operations) |
| Builder | `#EF4444` | Red (Engineering) |

## Sidebar NAV-Reihenfolge (aus `shell.jsx` Z. 64-88)

```
TOP (no section header):
  - New Task (Plus)
  - Dashboard (Home)
  - Inbox (Inbox, count: 3)

SECTION: WORK
  - Tasks (ListCheck, count: 12)
  - Workspaces (Layers)
  - Outcomes (Target)
  - Briefings (FileText)
  - Risk Approval (Shield, count: 2)
  - Jobs & Skills (Workflow)

SECTION: AGENTS
  - Orchestrator (status: live)
  - Researcher (status: live)
  - Creator (status: live)
  - Operator (status: idle)
  - Builder (status: idle)

SECTION: COMPANY
  - Setup (Rocket)
  - Knowledge Base (Book)
  - Health (Activity)
  - Org (Building)
  - Settings (Settings)
```

> **Diskrepanz im README** (auch v2): Der README listet eine andere Sektionierung. **Code gewinnt.**

## Dimensionen

| Komponente | Wert |
|---|---|
| Topbar (`.tb`) | Höhe **56px** borderless |
| Sidebar Header | padding `14px 14px 10px`, Logo 26×26 mit gradient |
| Sidebar Search | Höhe **30px**, padding `0 11px`, font 12.5px |
| Sidebar Item | Höhe **32px**, padding `0 12px`, margin `1px 10px`, radius 10px |
| Buttons | 32 / 28 / 22px (default / sm / xs) |
| Inputs | Höhe **34px**, padding `0 14px`, radius 999px |
| Badges | Höhe **22px**, padding `0 9px`, font 11px |
| Tabs | Pill 4px padding, Tab `6px 14px` 12.5px |
| Card-Hd | padding `18px 22px` mit border-bottom |
| Card-Bd / Card-Pad | padding `18px 22px` / `22px 24px` |
| Page-Header (`.ph`) | padding `26px 28px 20px` |
| Step-Number | 28×28 px, Border-Radius 999px |
| Check-Circle | 16×16 px, 1.5px border |
| Progress-Bar (`.bar`) | Höhe **5px** |
| Mode-Pill | padding `5px 12px 5px 8px`, font 11.5px |
| Avatar | 24×24 (sm: 20, lg: 32) |
| KBD | Höhe 18px, 11px mono, radius 6px |
| Modal | Width 520px, radius 24px |

## Responsive Breakpoints

| Breakpoint | Verhalten |
|---|---|
| `≤1180px` | Sidebar collapse → 64px (icons-only); Section-Headers/Search/Mode-Card hidden; cols-5→3, cols-4→2 |
| `≤960px` | Briefings 1-Spalte; cols-5/4/3→2; org-reports 2x2 |
| `≤720px` | Sidebar Drawer (slide from left); Hamburger sichtbar; alle Grids 1-Spalte; H1 → 19px; tb-search hidden |
| `≤480px` | H1 → 18px; ph-actions 100% width |

## Wichtige NICHT-Werte (alte/falsche Daten aus README)

- ~~Indigo `#6366f1` Akzent~~ → falsch, ist `#10B981`
- ~~SF Pro Font-Stack~~ → falsch, ist Inter
- ~~`--danger` Token~~ → falsch, heißt `--err`
- ~~`--font-display` Token~~ → existiert nicht
- ~~`--shadow-pop` / `--shadow-glass`~~ → existieren nicht
- ~~Radien 10/14/18~~ → falsch, sind 8/12/16/22/24
