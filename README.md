# Narad Muni

**Speak once, inform all three worlds.**

Like the divine messenger [Narad Muni](https://en.wikipedia.org/wiki/Narada) who travels across *Akasha*, *Prithvi*, and *Patala* carrying word to the right people at the right time — this tool takes a single voice recording and delivers formatted daily updates to **Slack**, **Microsoft Teams**, and **Jira** work logs.

Record once, publish everywhere.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 + React 19 (App Router) |
| Language | TypeScript |
| UI | Tailwind CSS 4 + shadcn/ui + Framer Motion |
| State | Zustand 5 |
| Database | SQLite + Prisma 6 |
| Speech-to-Text | Deepgram Nova-3 |
| AI Processing | Claude API / Gemini / Local Claude CLI |
| Icons | Lucide React |

## Getting Started

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

### Environment Variables

The `.env` file (committed) contains the database path:

```env
DATABASE_URL="file:./dev.db"
```

Create a `.env.local` file in the project root for API keys:

```env
# Required — Deepgram (speech-to-text)
DEEPGRAM_API_KEY=your_deepgram_key

# Optional — only needed if using the Claude API provider
ANTHROPIC_API_KEY=your_anthropic_key

# Optional — only needed if using the Gemini provider
GEMINI_API_KEY=your_gemini_key
```

> API keys can also be set from the Settings page inside the app (stored in the database).

### Where to Get Keys & URLs

| Service | What You Need | Where to Get It |
|---------|--------------|-----------------|
| **Deepgram** | API Key | [console.deepgram.com](https://console.deepgram.com/) — create a project, go to API Keys |
| **Claude API** | API Key | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| **Gemini** | API Key | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Slack** | Incoming Webhook URL | [api.slack.com/apps](https://api.slack.com/apps) — create app, enable Incoming Webhooks, add to channel |
| **Teams** | Incoming Webhook URL | In Teams channel: Connectors > Incoming Webhook > configure and copy URL |
| **Jira** | Base URL | Your Atlassian instance, e.g. `https://yourcompany.atlassian.net` |
| **Jira** | Email | The email tied to your Atlassian account |
| **Jira** | API Token | [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens) — Create API Token |

## How It Works

```
Calendar day click
  -> Record voice or type text
  -> Deepgram transcribes audio to text
  -> AI parses transcript into structured data
     (tasks, blockers, time entries, Slack/Teams formats)
  -> Preview & edit per-platform output
  -> "Share All" publishes to enabled platforms
  -> Results saved to SQLite
```

### The 4-Step Flow

1. **Input** — Record audio (with live waveform) or type your daily update
2. **Processing** — AI extracts tasks, blockers, time entries and formats output for each platform
3. **Preview** — Tabbed view (Slack / Teams / Jira) with editable content and per-platform toggles
4. **Publish** — One click sends to all enabled platforms simultaneously

### Repeat Entries

A core feature — configure recurring Jira work log entries (e.g. daily standup, EOD sync) in Settings. These are auto-injected into every day's work log so you never have to re-enter them manually.

## Scripts

```bash
npm run dev        # Start development server
npm run build      # Production build
npm run lint       # ESLint
npm run db:push    # Push Prisma schema to SQLite
npm run db:seed    # Seed default platform configs
npm run db:reset   # Reset DB + re-seed
```

## Project Structure

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
  seed.ts                 # Default config seeder
```
