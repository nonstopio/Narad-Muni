# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Narad Muni is a voice-first productivity platform that converts a single voice recording into formatted daily updates for Slack, Microsoft Teams, and Jira work logs. Record once, publish everywhere. Named after the divine messenger [Narad Muni](https://en.wikipedia.org/wiki/Narada) who carries word across the three worlds — this tool does the same for your daily standups.

The application is **fully implemented** and functional. Supports ~100 users with per-user cloud data via Firebase.

## Tech Stack

- **Framework:** Next.js 16 with TypeScript (App Router, React 19)
- **UI:** Tailwind CSS 4 + shadcn/ui + Framer Motion
- **State:** Zustand 5
- **Database:** Firebase Firestore (cloud, per-user data)
- **Auth:** Firebase Authentication (Google Sign-In)
- **Analytics:** Firebase Analytics
- **Speech-to-Text:** Deepgram Nova-3
- **AI Processing:** Supports 3 providers — Local Claude CLI (default), Claude API (Anthropic SDK), Gemini (Google AI SDK)
- **Icons:** Lucide React

## Common Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # ESLint
npx tsc --noEmit   # Type-check without emitting
```

## Architecture

```
Client (Next.js React) -> Firebase Auth (Google Sign-In)
                       -> API Routes (Bearer token auth) -> External Services
                                                            |- Deepgram (transcription)
                                                            |- Claude/Gemini (parsing/formatting)
                                                            |- Slack (webhook POST)
                                                            |- Teams (Adaptive Card webhook)
                                                            |- Jira REST v3 (worklogs)
                       -> Firebase Firestore (per-user data)
```

**Data flow:** Calendar click -> voice/text input -> `/api/transcribe` (Deepgram) -> `/api/parse` (AI extracts tasks, times, blockers into structured JSON) -> tabbed preview (editable per platform) -> "Share All" triggers POST `/api/updates` which publishes to enabled platforms -> results stored in Firestore.

**Auth flow:** All pages wrapped in `<AuthShell>` (AuthProvider + AuthGuard). Unauthenticated users see login screen. All API routes verify Firebase ID tokens via `verifyAuth()`. Client uses `authedFetch()` to inject Bearer tokens.

## Firestore Data Models

All user data is scoped under `users/{userId}/`:

- **`updates/{updateId}`** — one per calendar day; stores raw transcript, formatted outputs per platform, publish statuses, and embedded `workLogEntries[]` array
- **`configs/{platform}`** — SLACK, TEAMS, or JIRA config with embedded `repeatEntries[]` array
- **`settings/app`** — AI provider selection + API keys + Deepgram key + notification settings (singleton doc)
- **`drafts/{YYYY-MM-DD}`** — Draft text keyed by date string

## API Routes

All routes require `Authorization: Bearer <firebaseIdToken>` header.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/transcribe` | Audio blob -> Deepgram -> transcript text |
| POST | `/api/parse` | Transcript -> AI -> structured JSON (tasks, times, formats) |
| GET | `/api/updates?month=YYYY-MM` | Fetch all updates for a month (with work log entries) |
| POST | `/api/updates` | Create update + publish to Slack/Teams/Jira |
| PUT | `/api/updates` | Retry failed platform publishes |
| DELETE | `/api/updates?id=<id>` | Delete update |
| GET | `/api/settings` | Fetch platform configs with repeat entries |
| PUT | `/api/settings` | Update a platform config |
| GET | `/api/settings/ai-provider` | Fetch AI provider + masked key status |
| PUT | `/api/settings/ai-provider` | Update AI provider + API keys |
| GET/PUT | `/api/drafts` | Read/write draft text for a date |
| POST | `/api/auth/seed` | Seed default configs for new user (idempotent) |

## Pages

All pages are client components that fetch data via `authedFetch()` in `useEffect`.

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

- **`FIREBASE_SERVICE_ACCOUNT_BASE64`** — Base64-encoded Firebase service account JSON. Set by Electron main process from bundled `resources/firebase-sa.json`. For local dev, set by `electron/dev-start.js`.
- **API keys (Deepgram, Anthropic, Gemini):** All stored in Firestore `users/{uid}/settings/app`, configurable from the Settings page ("Divine Oracle" card).

## Firebase Setup

- Firebase client config is hardcoded in `src/lib/firebase.ts` (safe for client bundles)
- Firebase Admin SDK initializes from `FIREBASE_SERVICE_ACCOUNT_BASE64` env var in `src/lib/firebase-admin.ts`
- Firestore security rules: each user can only read/write their own `users/{uid}/**` path
- Default configs are seeded via `POST /api/auth/seed` on first login (idempotent)

## Electron Desktop App

The app ships as a native macOS desktop app via Electron.

- **Entry:** `electron/main.ts` — sets Firebase env vars, launches BrowserWindow
- **Config:** `electron/config.ts` — reads/writes `narada.config.json` in user data dir (window bounds, Firebase user ID)
- **Dev mode:** `electron/dev-start.js` — loads Firebase service account, starts Next.js dev server + Electron concurrently
- **Build:** `npm run electron:build` — production build + electron-builder packaging
- **MCP mode:** `electron/main.ts --mcp` — headless MCP stdio server, reads user ID from config and service account from `NARADA_FIREBASE_SA_PATH`

```bash
npm run electron:dev      # Compile TS + start Next.js + Electron
npm run electron:compile  # Compile electron/ TypeScript only
npm run electron:build    # Full production build + package
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/firebase.ts` | Firebase client SDK init (Auth + Analytics) |
| `src/lib/firebase-admin.ts` | Firebase Admin SDK init (Firestore + Auth verification) |
| `src/lib/auth-middleware.ts` | `verifyAuth()` + `handleAuthError()` for API routes |
| `src/lib/api-client.ts` | `authedFetch()` client wrapper injecting Bearer tokens |
| `src/lib/seed-user.ts` | Seeds default configs for new users |
| `src/components/auth/auth-provider.tsx` | React context for Firebase Auth state |
| `src/lib/ai/prompt.ts` | AI system prompt + JSON schema for parsing |
| `src/lib/ai/index.ts` | AI provider factory (selects active provider) |
| `src/lib/deepgram.ts` | Deepgram transcription |
| `src/hooks/use-update-flow.ts` | Orchestrates transcribe -> parse -> preview |
| `src/hooks/use-audio-recorder.ts` | Microphone + MediaRecorder + AnalyserNode |
| `src/app/api/updates/route.ts` | Core publish logic (Slack webhook, Teams Adaptive Card, Jira worklog) |
| `mcp/server.ts` | MCP server for Claude Code integration |
| `mcp/db.ts` | MCP Firestore operations (draft append) |
| `electron/main.ts` | Electron main process entry point |
| `electron/dev-start.js` | Dev mode orchestrator |

## Reference Files

- `Narada-PRD.md` — Complete product requirements, the authoritative spec
- `narada-ui-prototype.html` — Interactive HTML/CSS/JS prototype with all screens
