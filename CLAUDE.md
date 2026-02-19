# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Narad Muni is a voice-first productivity platform that converts a single voice recording into formatted daily updates for Slack, Microsoft Teams, and Jira work logs. Record once, publish everywhere. Named after the divine messenger [Narad Muni](https://en.wikipedia.org/wiki/Narada) who carries word across the three worlds — this tool does the same for your daily standups.

The application is **fully implemented** and functional.

## Tech Stack

- **Framework:** Next.js 16 with TypeScript (App Router, React 19)
- **UI:** Tailwind CSS 4 + shadcn/ui + Framer Motion
- **State:** Zustand 5
- **Database:** SQLite + Prisma 6
- **Speech-to-Text:** Deepgram Nova-3
- **AI Processing:** Supports 3 providers — Local Claude CLI (default), Claude API (Anthropic SDK), Gemini (Google AI SDK)
- **Icons:** Lucide React

## Common Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # ESLint
npm run db:push    # Push Prisma schema to SQLite
npm run db:seed    # Seed default platform configs
npm run db:reset   # Reset DB + re-seed (prisma db push --force-reset && tsx prisma/seed.ts)
npx tsc --noEmit   # Type-check without emitting
```

## Architecture

```
Client (Next.js React) -> API Routes -> External Services
                                        |- Deepgram (transcription)
                                        |- Claude/Gemini (parsing/formatting)
                                        |- Slack (webhook POST)
                                        |- Teams (Adaptive Card webhook)
                                        |- Jira REST v3 (worklogs)
                       -> SQLite (Prisma) for persistence
```

**Data flow:** Calendar click -> voice/text input -> `/api/transcribe` (Deepgram) -> `/api/parse` (AI extracts tasks, times, blockers into structured JSON) -> tabbed preview (editable per platform) -> "Share All" triggers POST `/api/updates` which publishes to enabled platforms -> results stored in SQLite.

## Data Models (Prisma)

- **Update** — one per calendar day; stores raw transcript, formatted outputs per platform (`slackOutput`, `teamsOutput`), and publish status (PENDING/SENT/FAILED/SKIPPED) per platform
- **WorkLogEntry** — Jira time entries linked to an Update (cascade delete); includes `isRepeat` flag and `jiraWorklogId` from API response
- **PlatformConfig** — per-platform settings (webhook URLs, API tokens, Jira credentials)
- **RepeatEntry** — recurring Jira work log entries auto-injected daily (configured in Settings)
- **AppSettings** — AI provider selection + API keys + Deepgram key (singleton row, all keys DB-stored)

## API Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/transcribe` | Audio blob -> Deepgram -> transcript text |
| POST | `/api/parse` | Transcript -> AI -> structured JSON (tasks, times, formats) |
| GET | `/api/updates?month=YYYY-MM` | Fetch all updates for a month (with work log entries) |
| POST | `/api/updates` | Create update + publish to Slack/Teams/Jira |
| DELETE | `/api/updates?id=<id>` | Delete update (cascades to work log entries) |
| GET | `/api/settings` | Fetch platform configs with repeat entries |
| PUT | `/api/settings` | Update a platform config |
| GET | `/api/settings/ai-provider` | Fetch AI provider + masked key status (includes Deepgram) |
| PUT | `/api/settings/ai-provider` | Update AI provider + API keys (includes Deepgram) |

## Pages

| Path | Purpose |
|------|---------|
| `/` | Home — calendar dashboard with stats (updates count, streak, time saved) |
| `/update?date=YYYY-MM-DD` | Update creation — record/type -> AI process -> preview -> publish |
| `/history` | Past updates list with search, detail modal, delete |
| `/settings` | Platform configs (Slack/Teams/Jira), repeat entries, AI provider |

## Voice & Personality

All user-facing text must be written as if spoken by Narad Muni himself — the wandering divine sage who travels the three worlds (Devalok, Prithvilok, Patallok). Follow these guidelines:

- **First person:** Narad speaks directly — "I shall carry your word", not "Your word will be carried"
- **Signature greeting:** Use "Narayan Narayan!" as the characteristic exclamation (equivalent to "Hey!" or "Success!")
- **Mythological metaphors:** Use "scrolls" (not messages), "chronicles" (not history), "three worlds" (not platforms), "invoke the sage" (not process), "sacred" (not important), "devotion" (not streak)
- **Tone:** Warm, wise, slightly playful — like a benevolent sage who enjoys his work. Never robotic or corporate.
- **Error messages:** Even failures should sound like a sage's lament — "Alas!" not "Error:"
- **Keep it concise:** Narad is wise, not verbose. One-liners are preferred over paragraphs.

Examples of good copy:
- "Narayan Narayan! Your word has reached all three worlds!"
- "The scrolls will materialize once the sage has spoken..."
- "Alas! The oracle could not be reached"
- "Grant me the Deepgram mantra in Sacred Configurations to hear your voice"

## Design System

Dark glassmorphism theme (inspired by Linear/Raycast/Arc).

- **Backgrounds:** `#0A0A0F` (base), `#12121A` (surface), `#1A1A2E` (elevated)
- **Accent colors:** Blue `#3B82F6` (primary), Violet `#8B5CF6` (secondary), Emerald `#10B981` (success), Amber `#F59E0B` (warning), Rose `#EF4444` (error/recording)
- **Fonts:** Inter (UI), JetBrains Mono (code/URLs/tokens)
- **Glass effect:** `background: rgba(255,255,255,0.03)`, `border: 1px solid rgba(255,255,255,0.06)`, `backdrop-filter: blur(20px)`
- **Layout:** 64px icon sidebar + fluid main content
- **CSS classes:** `glass-card`, `glass-input` are reusable glassmorphism presets defined in `globals.css`

## Key Domain Concepts

- **Repeat/Fixed Entries:** Jira work log entries auto-injected into every day's work log (configured in Settings under Jira). The AI merges these with transcript-derived entries and scales times to meet the 8h minimum.
- **Platform toggles:** Users can enable/disable Slack, Teams, and Jira per update before publishing. Disabled platforms get status `SKIPPED`.
- **Calendar interaction:** Clicking a date with an existing update opens a detail modal (read-only + delete). Clicking a date without an update opens the creation flow.
- **AI providers:** Three options (configurable in Settings): `local-claude` (spawns Claude CLI, no API key needed), `claude-api` (Anthropic SDK), `gemini` (Google AI SDK).

## API Integration Notes

- **Slack:** Incoming Webhook POST with plain text + user mention (`<@userId>`).
- **Teams:** Incoming Webhook POST with Adaptive Card format + `<at>` mention entity.
- **Jira:** REST API v3, Basic auth (email + API token), worklog endpoint. Times stored as wall-clock in user's timezone, converted to true UTC before API call. 1 second delay between worklog POSTs to avoid rate limiting.
- **Deepgram:** Pre-recorded mode (upload WebM blob). Config: `smart_format=true`, `punctuate=true`, `diarize=false`.
- **AI parsing:** System prompt enforces 8h minimum total time, 30-min granularity, 30-min minimum per entry. Output is structured JSON with `tasks[]`, `blockers[]`, `timeEntries[]`, `tomorrowTasks[]`, `slackFormat`, `teamsFormat`.

## Environment Variables

No `.env` files are needed. All configuration is DB-backed:

- **DATABASE_URL:** Hardcoded fallback `file:./dev.db` in `src/lib/prisma.ts`. Electron sets it programmatically to the user data directory path.
- **API keys (Deepgram, Anthropic, Gemini):** All stored in the `AppSettings` table, configurable from the Settings page ("Divine Oracle" card). No env var fallbacks — DB is the single source of truth.

## Electron Desktop App

The app ships as a native macOS desktop app via Electron.

- **Entry:** `electron/main.ts` — sets `DATABASE_URL`, initializes DB, launches BrowserWindow
- **DB init:** `electron/db.ts` — runs bundled Prisma migration SQL files via better-sqlite3 (no Prisma CLI needed in packaged app). Applies pending migrations automatically on every startup.
- **Config:** `electron/config.ts` — reads/writes `narada.config.json` in user data dir (window bounds, custom DB path)
- **Dev mode:** `electron/dev-start.js` — sets `DATABASE_URL` to Electron DB path, runs `prisma db push` to sync schema, then starts Next.js dev server + Electron concurrently
- **Build:** `npm run electron:build` — production build + electron-builder packaging

```bash
npm run electron:dev      # Compile TS + sync DB + start Next.js + Electron
npm run electron:compile  # Compile electron/ TypeScript only
npm run electron:build    # Full production build + package
```

**Schema migrations:** When adding columns to Prisma schema, also create a migration SQL file in `prisma/migrations/` so the Electron app can apply it to existing databases. `electron/db.ts` reads the `_prisma_migrations` table to skip already-applied migrations.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/ai/prompt.ts` | AI system prompt + JSON schema for parsing |
| `src/lib/ai/index.ts` | AI provider factory (selects active provider) |
| `src/lib/deepgram.ts` | Deepgram transcription (reads API key from DB) |
| `src/lib/prisma.ts` | Prisma client singleton + DATABASE_URL fallback |
| `src/hooks/use-update-flow.ts` | Orchestrates transcribe -> parse -> preview |
| `src/hooks/use-audio-recorder.ts` | Microphone + MediaRecorder + AnalyserNode |
| `src/app/api/updates/route.ts` | Core publish logic (Slack webhook, Teams Adaptive Card, Jira worklog) |
| `prisma/schema.prisma` | Database schema (5 models) |
| `prisma/seed.ts` | Seeds default platform configs + app settings |
| `electron/main.ts` | Electron main process entry point |
| `electron/db.ts` | DB initialization + auto-migration runner |
| `electron/dev-start.js` | Dev mode orchestrator (DB sync + concurrently) |

## Reference Files

- `Narada-PRD.md` — Complete product requirements, the authoritative spec
- `narada-ui-prototype.html` — Interactive HTML/CSS/JS prototype with all screens
