# Repository agent instructions

These instructions apply equally to Claude Code, Codex, and every other agent working in this repository.

## Shared rules and required verification

- `CLAUDE.md` and `AGENTS.md` in each directory must contain identical instructions. Any agent changing either file must update its partner in the same change. Create both files when adding nested guidance; never add agent-specific exceptions.
- Whenever code, configuration, architecture, or workflow changes, review and update the applicable paired instruction files together so they describe the resulting behavior. Keep relevant guidance current, rather than adding a chronological log of every edit.
- Run `node scripts/check-agent-rules.mjs` before finishing. CI checks pair parity, including nested directories.
- Read the relevant code and existing tests before editing. Preserve authentication, per-user isolation, leave guards, and Jira validation.
- Verify changed user flows with the installed Playwright MCP or Chrome DevTools MCP, in addition to focused tests and type checks. Use isolated fixture accounts and mocked external APIs for publishing tests; never send test posts to real channels or worklogs.
- Required checks: `npm run lint`, `npx tsc --noEmit`, `npm run electron:compile`, focused tests, and `npm run build`. Report any environment limitation honestly; do not claim a mocked browser check proves live VPN or third-party delivery.
- Do not discard unrelated local edits, publish a release, or push to `main` without authorization.

## Project Overview

Narad Muni is a productivity platform that converts a single typed update into formatted daily updates for Slack, Microsoft Teams, and Jira work logs. Write once, publish everywhere. Named after the divine messenger [Narad Muni](https://en.wikipedia.org/wiki/Narada) who carries word across the three worlds — this tool does the same for your daily standups.

The application is **fully implemented** and functional. Supports ~100 users with per-user cloud data via Firebase.

## Tech Stack

- **Framework:** Next.js 16 with TypeScript (App Router, React 19)
- **UI:** Tailwind CSS 4 + shadcn/ui + Framer Motion
- **State:** Zustand 5; immediate per-user local draft snapshots and cached page reads
- **Database:** Firebase Firestore (cloud, per-user data)
- **Auth:** Firebase Authentication (Google Sign-In)
- **Analytics:** Firebase Analytics
- **AI Processing:** Local Claude CLI (default), Local Cursor CLI, Claude API, Gemini, Groq, OpenAI, Azure OpenAI
- **Icons:** Lucide React

## Common Commands

```bash
npm run dev        # Start dev server
npm run build      # Production build
npm run lint       # ESLint
npx tsc --noEmit   # Type-check without emitting
npm run electron:compile
node scripts/check-agent-rules.mjs
node --import tsx electron/drafts.test.ts
node --import tsx src/lib/local-drafts.test.ts
node --import tsx src/lib/publish-delivery.test.ts
node --import tsx src/app/api/updates/route.test.ts
```

On hosts where the `tsx` CLI cannot create its local IPC pipe, use `node --import tsx <test-file>` instead. The production font download may need `NEXT_TURBOPACK_EXPERIMENTAL_USE_SYSTEM_TLS_CERTS=1` behind an OS-trusted corporate proxy; never disable TLS verification.

The installed Playwright MCP can run `scripts/verify-performance-ui.js` through `browser_run_code_unsafe` with its absolute `filename`; it uses an isolated Firebase fixture identity and intercepted APIs. `scripts/verify-review-regressions.js` checks publish/refresh races, same-day conflicts, Jira retry receipts/new rows, and failed desktop ownership handoff after the performance fixture is initialized. `scripts/verify-desktop-drafts.cjs` uses the real compiled Electron main/preload to verify actual Quit/restart with mocked APIs. Run stage 1 and then stage 2 with the same temporary `NARADA_TEST_USER_DATA=/private/tmp/narada-desktop-<unique-name>` and `NARADA_TEST_STAGE=1` or `2`; it requires the local dev server on port 3947. Never point that harness at the user's real desktop profile.

## Architecture

```
Client (Next.js React) -> Firebase Auth (Google Sign-In)
                       -> API Routes (Bearer token auth) -> External Services
                                                            |- Claude/Gemini (parsing/formatting)
                                                            |- Slack (webhook POST)
                                                            |- Teams (Adaptive Card webhook)
                                                            |- Jira REST v3 (worklogs)
                       -> Firebase Firestore (per-user data)
```

**Data flow:** Calendar click -> text input -> `/api/parse` (AI extracts tasks, times, blockers into structured JSON) -> tabbed preview (editable per platform) -> "Share All" triggers POST `/api/updates` which publishes to enabled platforms -> results stored in Firestore.

**Auth flow:** All pages wrapped in `<AuthShell>` (AuthProvider + AuthGuard). Unauthenticated users see login screen. All API routes verify Firebase ID tokens via `verifyAuth()`. Client uses `authedFetch()` to inject Bearer tokens.

## Firestore Data Models

All user data is scoped under `users/{userId}/`:

- **`updates/{updateId}`** — one per calendar day (new IDs are `YYYY-MM-DD`; legacy random IDs remain readable); stores raw transcript, formatted outputs per platform, publish statuses, and embedded `workLogEntries[]` array
- **`configs/{platform}`** — SLACK, TEAMS, or JIRA config with embedded `repeatEntries[]` array
- **`settings/app`** — AI provider selection + API keys + notification settings (singleton doc)
- **`drafts/{YYYY-MM-DD}`** — Draft text keyed by date string, plus `source` (`"manual"` | `"projects"`; missing = manual). Updates store the same `source`
- **`leaves/{YYYY-MM-DD}`** — `{ date, kind, createdAt }` (`kind`: `"leave"` | `"holiday"`; missing = leave); the doc ID is the day key. A holiday behaves exactly like leave, only labelled differently. A day on leave refuses update publishes and draft writes, and a day with an update cannot go on leave
- **`broadcasts/{templateId}`** — Missive template: name, body (with `{{name}}`/`{{first_name}}` placeholders), `recipients[]`, and `scheduled[]` refs for queued Slack sends

## API Routes

All routes require `Authorization: Bearer <firebaseIdToken>` header.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/parse` | Transcript -> AI -> structured JSON (tasks, times, formats) |
| GET | `/api/updates?month=YYYY-MM` | Fetch all updates for a month (with work log entries) |
| POST | `/api/updates` | Create update + publish to Slack/Teams/Jira |
| PUT | `/api/updates` | Retry failed platform publishes |
| DELETE | `/api/updates?id=<id>` | Delete update |
| GET | `/api/settings` | Fetch platform configs with repeat entries |
| PUT | `/api/settings` | Update a platform config |
| GET | `/api/settings/ai-provider` | Fetch AI provider + masked key status |
| PUT | `/api/settings/ai-provider` | Update AI provider + API keys |
| GET/PUT | `/api/drafts` | Read/write draft text and source for a date (409 while the day is on leave) |
| GET | `/api/leaves?month=YYYY-MM` / `?date=YYYY-MM-DD` | Leave day keys for a month (all with no params) / whether one day is on leave |
| PUT | `/api/leaves` | Mark `{ date, kind? }` as leave or holiday (409 `update-exists` if the day has an update) |
| DELETE | `/api/leaves?date=YYYY-MM-DD` | Undo leave |
| POST | `/api/auth/seed` | Seed default configs for new user (idempotent) |
| GET/POST/DELETE | `/api/broadcast` | Missive template CRUD |
| GET | `/api/broadcast/members` | Slack workspace members for the recipient picker |
| POST | `/api/broadcast/send` | Send DMs now, or queue a weekly/monthly cadence with Slack |
| DELETE | `/api/broadcast/send?templateId=<id>` | Withdraw all queued sends for a template |

## Pages

All pages are client components that fetch data via `authedFetch()` in `useEffect`.

| Path | Purpose |
|------|---------|
| `/` | Home — calendar dashboard with stats (updates count, streak, time saved) |
| `/update?date=YYYY-MM-DD` | Update creation — type -> AI process -> preview -> publish |
| `/history` | Past updates list with search, detail modal, delete |
| `/settings` | Platform configs (Slack/Teams/Jira), repeat entries, AI provider |
| `/broadcast` | Missives — DM templates, recipient picker, send now or on a weekly/monthly cadence |

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

## Design System

Dark glassmorphism theme (inspired by Linear/Raycast/Arc).

- **Backgrounds:** `#0A0A0F` (base), `#12121A` (surface), `#1A1A2E` (elevated)
- **Accent colors:** Blue `#3B82F6` (primary), Violet `#8B5CF6` (secondary), Emerald `#10B981` (success), Amber `#F59E0B` (warning), Rose `#EF4444` (error)
- **Fonts:** Inter (UI), JetBrains Mono (code/URLs/tokens)
- **Glass effect:** `background: rgba(255,255,255,0.03)`, `border: 1px solid rgba(255,255,255,0.06)`, `backdrop-filter: blur(20px)`
- **Layout:** 64px icon sidebar + fluid main content
- **CSS classes:** `glass-card`, `glass-input` are reusable glassmorphism presets defined in `globals.css`

## Key Domain Concepts

- **Repeat/Fixed Entries:** Jira work log entries auto-injected into every day's work log (configured in Settings under Jira). The AI merges these with transcript-derived entries and `/api/parse` treats the hours the user picked as a floor: a shorter day is scaled up to meet it, a longer one keeps its true total. The floor is picked under Invoke the Sage (`targetHours`, default 8h, 0.5–24h in half-hour steps; see `src/lib/ai/time-rules.ts`).
- **Draft durability:** `electron/drafts.ts` writes private per-user, per-day atomic snapshots under `<userData>/drafts/<hashed uid>/`. The renderer synchronously acknowledges small local writes before returning from an edit, preserving text, chosen hours, platform choices, and edited previews across Quit/restart and localhost port changes. Browser mode falls back to user-scoped localStorage. Cloud sync serializes per day, retries on reconnect and every 30 seconds, and acknowledges only the uploaded revision. Deleted-draft tombstones prevent resurrection and are retired only after cloud deletion is acknowledged; retry previews stay local. Metadata initialization must not overwrite an unseen cloud draft. Clean snapshots revalidate on mount, focus, and reconnect; dirty snapshots and edits made during refresh win. Refreshing identical text preserves edited previews; changed cloud text invalidates stale previews. Publish completion retires only its captured local revision and account, preserving newer edits in the editor. Every native draft operation must assert the expected Firebase UID against the main process owner; failed ownership handoff blocks editing with a retry screen. Do not replace local edits with a late cloud response or silently overwrite unreadable local storage.
- **Fast page reads:** Home uses `/api/updates?dashboard=1&month=YYYY-MM&today=YYYY-MM-DD` (monthly details, projected date keys for streak, leave keys). Editor uses `/api/settings?editor=1`, excluding credentials. `resource-cache.ts` caches only credential-free responses per user, coalesces reads, shows cached data during refresh, refreshes on focus/reconnect, and invalidates on mutations. The editor mounts immediately, even before its first settings fetch; account changes remount the protected UI to prevent old-account state leaking. Never persist webhook URLs or API tokens in that cache.
- **Delivery safety:** POST atomically creates one update per date, including a legacy-ID lookup. Repeated POSTs return the existing record without resending only when the original normalized content identity matches. Different content for the same day returns 409 and keeps the new local draft. PUT uses server statuses and receipts, never client success flags. Retry restoration overlays editable local rows onto fresh server receipts. Newly added rows receive server IDs; unknown supplied IDs and duplicates are rejected. Slack/Teams/Jira run concurrently; Jira entries remain sequential and each successful worklog ID is persisted immediately. `updates/{id}/deliveries/{deliveryId-platform or deliveryId-jira-entry-id}` holds transactional claims and receipts. `UNCERTAIN` or an interrupted `SENDING` claim must never be resent automatically: webhook services cannot guarantee exactly-once delivery after a lost response. Only a definite rejection becomes retryable `FAILED`. A pending platform without a send claim can resume; an existing claim blocks replay. Explicitly erasing a resolved update starts a new delivery generation if the user publishes that day again. Preserve these ledgers and do not erase unresolved deliveries.
- **Platform toggles:** Users can enable/disable Slack, Teams, and Jira per update before publishing. Disabled platforms get status `SKIPPED`.
- **Calendar interaction:** Clicking a date with an existing update opens a detail modal (read-only + delete). Clicking a date without an update opens the creation flow.
- **Leave:** Marked from the day view, stored in `leaves/`. Never counts as a message, hours or time saved; the streak (`src/lib/streak.ts`) steps over leave days without counting or breaking. Weekends without an update still break it. Server enforces: no publish or draft write on a leave day, no leave on a day with an update (deleting the update does not retract posts).
- **Fetch from Projects (desktop):** Settings → Sacred Repositories lists local git folders per signed-in user. The day view's Projects button collects that day's own non-merge commits (by author time in the workday timezone, read-only git), previews them, then inserts a `[Project activity]` block and sets the draft source to `projects`. For that source the AI treats the block as untrusted evidence, `/api/parse` blanks unevidenced ticket keys and still scales the day up to the chosen hours (commits show coding, not testing or deploying).
- **Jira publish guard:** `jiraPublishBlocker` (`src/lib/jira-guard.ts`) disables Dispatch and makes POST/PUT `/api/updates` return 400 when Jira is on and an entry has an invalid key, or has no duration or one off half-hour steps. It applies to every update.
- **AI providers:** Configurable in Settings: `local-claude`, `local-cursor`, `claude-api`, `gemini`, `groq`, `openai`, `azure-openai`. Local CLI providers still contact their remote AI services.

## API Integration Notes

- **Slack:** Incoming Webhook POST with plain text + user mention (`<@userId>`).
- **Teams:** Incoming Webhook POST with Adaptive Card format + `<at>` mention entity.
- **Jira:** REST API v3, Basic auth (email + API token), worklog endpoint. Times stored as wall-clock in user's timezone, converted to true UTC before API call. No unconditional worklog delay. A confirmed rejection may be retried explicitly; timeouts, lost responses, and server errors require checking delivery before another send.
- **AI parsing:** System prompt treats the user-chosen daily hours (default 8h) as a minimum, never shrinking a longer day, 30-min granularity, 30-min minimum per entry. Output is structured JSON with `tasks[]`, `blockers[]`, `timeEntries[]`, `tomorrowTasks[]`, `slackFormat`, `teamsFormat`.

## Environment Variables

- **`FIREBASE_SERVICE_ACCOUNT_BASE64`** — Base64-encoded Firebase service account JSON. Set by Electron main process from bundled `resources/firebase-sa.json`. For local dev, set by `electron/dev-start.js`.
- **API keys (Anthropic, Gemini):** All stored in Firestore `users/{uid}/settings/app`, configurable from the Settings page ("Divine Oracle" card).

## Firebase Setup

- Firebase client config is hardcoded in `src/lib/firebase.ts` (safe for client bundles)
- Firebase Admin SDK initializes from `FIREBASE_SERVICE_ACCOUNT_BASE64` env var in `src/lib/firebase-admin.ts`
- Firestore security rules: each user can only read/write their own `users/{uid}/**` path
- Default configs are seeded via `POST /api/auth/seed` on first login (idempotent)

## Electron Desktop App

The app ships as a native macOS desktop app via Electron.

- **Entry:** `electron/main.ts` — sets Firebase env vars, launches BrowserWindow
- **Config:** `electron/config.ts` — reads/writes `narada.config.json` in user data dir (window bounds, Firebase user ID)
- **Projects:** `electron/projects.ts` — per-user local git folders in `<userData>/projects.json` (never synced) and the read-only git runner. IPC channels `projects:list`, `projects:add` (main opens the folder dialog), `projects:update`, `projects:remove`, `projects:setTimeZone`, `projects:collect`. The uid always comes from config, never from IPC args, and every IPC handler rejects senders other than our window on the local app origin
- **Outbound HTTPS:** in the packaged app, `electron/net-fetch.ts` routes every HTTPS `fetch` (AI SDKs, Slack, Jira) through Chromium's `net.fetch`, which trusts the OS keychain, so TLS-intercepting corporate proxies work. Dev mode runs Next in plain Node and doesn't get this. API routes report errors with `errorMessage()` (`src/lib/utils.ts`), which includes the `cause` chain, so "Connection error." carries its real reason
- **Dev mode:** `electron/dev-start.js` — loads Firebase service account, starts Next.js dev server + Electron concurrently
- **Build:** `npm run electron:build` — production build + electron-builder packaging

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
| `src/lib/ai-settings.ts` | AI settings write/response for `/api/settings/ai-provider` (masks keys, purges the old Deepgram key) |
| `src/hooks/use-update-flow.ts` | Orchestrates parse -> preview |
| `src/lib/streak.ts` | Devotion streak over day keys, skipping leave days |
| `src/lib/project-activity.ts` | Builds/inserts the `[Project activity]` block from fetched commits |
| `src/lib/ai/project-rules.ts` | Time-entry rules for commit-sourced drafts (estimates flagged, unevidenced keys blanked) |
| `electron/projects.ts` | Local git projects store + read-only commit collection |
| `src/app/api/updates/route.ts` | Core publish logic (Slack webhook, Teams Adaptive Card, Jira worklog) |
| `electron/main.ts` | Electron main process entry point |
| `electron/dev-start.js` | Dev mode orchestrator |

## Reference Files

- `Narada-PRD.md` — Complete product requirements, the authoritative spec
- `narada-ui-prototype.html` — Interactive HTML/CSS/JS prototype with all screens
