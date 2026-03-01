<div align="center">

<img src="resources/icon.png" alt="Narad Muni" width="120" />

# Narad Muni

**Narayan Narayan! Speak once, and I shall carry your word across all three worlds.**

[![Download](https://img.shields.io/badge/Download-Landing_Page-blue?style=for-the-badge&logo=github)](https://nonstopio.github.io/Narad-Muni/)
[![Release](https://img.shields.io/github/v/release/nonstopio/Narad-Muni?style=for-the-badge&logo=electron&label=Latest)](https://github.com/nonstopio/Narad-Muni/releases/latest)
[![License](https://img.shields.io/github/license/nonstopio/Narad-Muni?style=for-the-badge)](LICENSE)

<br />

*Like the divine messenger [Narad Muni](https://en.wikipedia.org/wiki/Narada) who travels across Devalok, Prithvilok, and Patallok carrying sacred word to the right souls at the right time — this tool takes a single voice recording and delivers formatted daily updates to **Slack**, **Microsoft Teams**, and **Jira** work logs.*

**Record once, publish everywhere.** 🚀

[Download the App](https://nonstopio.github.io/Narad-Muni/) · [View Releases](https://github.com/nonstopio/Narad-Muni/releases) · [Report Issue](https://github.com/nonstopio/Narad-Muni/issues)

> 🎉 **Founded by [Ajay Kumar](https://github.com/ProjectAJ14)** 🎉

</div>

---

## ✨ The Sage's Sacred Flow

```
   🎙️ Speak            🔮 AI Oracle           📜 Preview            🌐 Publish
  ─────────── ──▶ ─────────────── ──▶ ─────────────── ──▶ ───────────────
  Record your       Deepgram + AI        Edit per-platform      Slack, Teams,
  daily standup     extract tasks,       formatted output       Jira — all at
  naturally         times, blockers      with toggles           once
```

1. 🎙️ **Invoke** — Record audio (with live waveform) or type your daily update
2. 🔮 **Oracle** — AI extracts tasks, blockers, time entries and formats output for each realm
3. 👁️ **Preview** — Tabbed view (Slack / Teams / Jira) with editable content and per-platform toggles
4. 🌐 **Deliver** — One click sends your scrolls to all enabled worlds simultaneously

---

## 🛠️ Tech Stack

| Layer | Technology |
|:------|:-----------|
| **Framework** | Next.js 16 + React 19 (App Router) |
| **Desktop** | Electron 33 (macOS native, hiddenInset titlebar) |
| **Language** | TypeScript |
| **UI** | Tailwind CSS 4 + shadcn/ui + Framer Motion |
| **State** | Zustand 5 |
| **Database** | SQLite + Prisma 6 |
| **Speech-to-Text** | Deepgram Nova-3 |
| **AI Processing** | Claude API / Gemini / Local Claude CLI |
| **Icons** | Lucide React |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm / pnpm / yarn
- (Optional) [Claude Code CLI](https://claude.ai/code) — if using the `local-claude` AI provider

### Setup

```bash
# Install dependencies
npm install

# Push the database schema and seed default configs
npm run db:reset

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 🔑 API Keys

No `.env` files needed. All API keys are configured from the **Settings** page inside the app and stored in the database.

| Service | What You Need | Where to Get It |
|:--------|:-------------|:----------------|
| **Deepgram** | API Key | [console.deepgram.com](https://console.deepgram.com/) |
| **Claude API** | API Key | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| **Gemini** | API Key | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Slack** | Incoming Webhook URL | [api.slack.com/apps](https://api.slack.com/apps) — Incoming Webhooks |
| **Teams** | Incoming Webhook URL | Channel > Connectors > Incoming Webhook |
| **Jira** | Base URL + Email + API Token | [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |

---

## 🔁 Repeat Entries

A sacred feature — configure recurring Jira work log entries (e.g. daily standup, EOD sync) in Settings. These are auto-injected into every day's work log and the AI scales times to meet the 8-hour minimum. Never re-enter the same entries manually again.

---

## 🤖 MCP Server — Log Work from Your AI Assistant

Narad Muni ships an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets AI coding assistants log completed work directly into your daily draft — without leaving the editor.

**How it works:** Your AI assistant calls `log_work` → entry is saved to the day's draft in SQLite → you open Narad Muni later to preview and publish to Slack, Teams, and Jira as usual.

### Installed App (Recommended)

The desktop app **auto-registers** with Claude Code on every launch. No manual setup needed — just install the app, open it once, and the MCP server is ready.

The app writes its config to `~/.claude.json`, pointing Claude Code at the Electron binary with `--mcp`. You can verify the registration in **Settings > Divine Messenger Protocol**.

Then you can say things like:
- *"Log that I finished the auth refactor on PROJ-123"*
- *"Log work: Fixed flaky tests in CI pipeline"*

### Developer Setup (Source Checkout)

If you're working from the source repo, the MCP server is auto-discovered via `.mcp.json`. Just build it once:

```bash
npm run mcp:compile
```

### Manual Configuration (Cursor, Windsurf, etc.)

Add the server to your MCP client config. Example for `~/.cursor/mcp.json` or equivalent:

```json
{
  "mcpServers": {
    "narada": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/Narad-Muni/dist-mcp/server.js"]
    }
  }
}
```

### `log_work` Tool

| Parameter | Type | Required | Description |
|:----------|:-----|:---------|:------------|
| `message` | string | Yes | What you worked on — *"Implemented user auth flow"* |
| `ticket` | string | No | Jira ticket key — *"PROJ-123"* |
| `date` | string | No | `YYYY-MM-DD` format, defaults to today |

Entries are formatted as `- TICKET: message` (or `- message` if no ticket) and appended to the day's draft. Multiple calls accumulate in the same draft.

> **Note:** Narad Muni must have been launched at least once to create the database. The MCP server writes directly to SQLite — the app doesn't need to be running.

---

## 📜 Scripts

```bash
# Web
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run lint             # ESLint

# Electron
npm run electron:dev     # Dev mode (Next.js + Electron concurrently)
npm run electron:build   # Production build + package

# MCP Server
npm run mcp:compile      # Build the MCP server
npm run mcp:dev          # Build + run (for testing with MCP Inspector)

# Database
npm run db:push          # Push Prisma schema to SQLite
npm run db:seed          # Seed default platform configs
npm run db:reset         # Reset DB + re-seed
```

---

## 📂 Project Structure

```
src/
  app/                    # Next.js App Router pages + API routes
    api/
      parse/              # AI parsing endpoint
      transcribe/         # Deepgram transcription
      updates/            # CRUD + publish (Slack/Teams/Jira)
      settings/           # Platform config + AI provider
    page.tsx              # Home — calendar dashboard
    history/              # Past updates list
    settings/             # Platform & AI configuration
    update/               # Update creation flow
  components/
    layout/               # Sidebar, gradient blobs
    ui/                   # shadcn/ui base components
    updates/              # Calendar, stats bar
    update/               # Recording, processing, preview, outputs
    settings/             # Platform config cards, AI provider
    history/              # History list, detail modal
  hooks/                  # useAudioRecorder, useUpdateFlow, useCalendar
  stores/                 # Zustand (app, update, settings)
  lib/                    # Prisma client, Deepgram, AI providers
  types/                  # TypeScript interfaces
prisma/
  schema.prisma           # Database schema (5 models)
  migrations/             # SQL migration files (used by Electron)
  seed.ts                 # Default config seeder
electron/
  main.ts                 # Electron main process
  db.ts                   # DB init + auto-migration runner
  config.ts               # User config (window bounds, DB path)
  dev-start.js            # Dev mode orchestrator
  preload.ts              # Context bridge
mcp/
  server.ts               # MCP server entry point (stdio transport)
  db.ts                   # Direct SQLite access for drafts
docs/
  index.html              # GitHub Pages landing page
```

---

## 🏷️ Releasing

Pushing a version tag triggers the CI/CD pipeline which builds cross-platform installers and creates a GitHub Release.

```bash
npm version patch    # or minor / major
git push origin main --follow-tags
```

The [landing page](https://nonstopio.github.io/Narad-Muni/) automatically picks up the latest release.

---

<div align="center">

Built with devotion at [nonstop.io](https://nonstopio.com) ✨

*Narayan Narayan!* 🙏

</div>
