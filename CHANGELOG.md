# Changelog

All notable changes to Narada will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.19.3] - 2026-10-06

### 🐛 Bug Fixes
- **jira:** send a non-browser User-Agent on worklog POSTs

## [1.19.2] - 2026-10-06

### 🧹 Chores
- Maintenance release.

## [1.19.1] - 2026-10-05

### 🐛 Bug Fixes
- **jira:** opt worklog POSTs out of the XSRF check

## [1.19.0] - 2026-10-05

### ✨ Features
- **update:** choose hours worked per day

### 🐛 Bug Fixes
- **parse:** treat chosen hours as a minimum
- **jira:** block worklogs off half-hour steps
- **update:** snap custom hours to half-hour steps

## [1.18.2] - 2026-10-05

### ♻️ Refactoring
- **analytics:** drop transcription metrics
- **settings:** remove Deepgram API key
- **update:** remove voice input and Deepgram transcription

### 📝 Documentation
- describe typed input, drop Deepgram

## [1.18.1] - 2026-10-05

### 🐛 Bug Fixes
- **logs:** stop writing every log line twice
- **report:** enrich issues with the shared Azure client
- **errors:** include the underlying cause in API error messages
- **network:** route HTTPS through Chromium so TLS-intercepting proxies work

## [1.18.0] - 2026-10-05

### ✨ Features
- **leaves:** mark a day as holiday

## [1.17.0] - 2026-10-04

### ✨ Features
- **projects:** insert commit activity and confirm estimates
- **projects:** fetch a day's commits into a preview
- **projects:** desktop Sacred Repositories settings
- **leave:** mark a day as on leave

### 🐛 Bug Fixes
- **projects:** tidy estimate chips and keyless lines
- **drafts:** never autosave before a date's draft has loaded

### 📝 Documentation
- leave days and fetch from projects
- leave and project fetch handoff

## [1.16.0] - 2026-10-04

### ✨ Features
- I now arrive on your Mac signed and notarized by Apple. No more right-click-to-open rites or Gatekeeper warnings; drag me into Applications and open me like any other app.
- I keep myself current. At startup and every six hours I look for a newer release, fetch it quietly in the background, then ask before I restart — **Restart and Install** or **Later**. Prefer to ask me yourself? **Narad Muni → Check for Updates…** in the menu bar. Your settings, data, and chronicles are kept.

### 📝 Documentation
- Install steps in the README and on the landing page now describe the signed macOS install and in-app updates.

### ⚠️ Upgrading
- If you are on 1.15.1 or earlier, install this release by hand once from the [landing page](https://nonstopio.github.io/Narad-Muni/). Those older builds cannot update themselves; from 1.16.0 onward, every release reaches you through the app.

## [1.15.1] - 2026-09-03

### 🐛 Bug Fixes
- "Alas! The oracle is silent: 404" — I had been calling the Claude oracle by a name it has outgrown. I now speak to `claude-sonnet-5`, and it answers. This struck both the daily parsing of your word and the Test Connection rite in Sacred Configurations.

## [1.15.0] - 2026-08-13

### ✨ Features
- "Missives" — a new hall in the sidebar. Compose a scroll once and I shall carry it to each soul by name, straight into their own ear rather than the village square. Choose your recipients from a searchable roll of the workspace; `{{name}}` and `{{first_name}}` become each devotee's own name as I go.
- Scrolls may now repeat. Choose Weekly or Monthly and name the first hour, and Slack itself shall hold the missives until their moment — they fly whether or not this app is awake. Up to 120 days ahead, as the Slack realm permits. "Withdraw all" recalls any that still wait.
- Missives may bear your own name rather than mine. Grant a Slack User Token (`xoxp-`) in Sacred Configurations and your word arrives as though you typed it yourself; leave it blank and I shall speak on your behalf as before.

### 🔧 Improvements
- The Slack Bot Token now stands in the open rather than hiding inside Thread Reply mode, for direct missives need it whichever way your daily scrolls travel.
- When Slack withholds a blessing, I now name the one it wants — "missing_scope" alone helped no one.

## [1.14.0] - 2026-08-13

### ✨ Features
- "Oracle Patience" — the wait before I despair is now yours to set. Choose anywhere from 15 to 600 seconds in the Divine Oracle card; your choice is inscribed per devotee and travels with you.

### 🐛 Bug Fixes
- Fix "Request to /api/parse timed out after 45s" striking again and again when the oracle pondered too long. I now wait 2 minutes by default instead of 45 seconds.
- Every oracle now honors the same patience. Groq, OpenAI, and Azure OpenAI carried their own 60-second limits, and the local Claude/Cursor CLIs their own 2-minute ones, so a longer wait on your side was quietly cut short by theirs.

## [1.13.0] - 2026-06-19

### 🗑️ Removed
- Removed the MCP (Model Context Protocol) server entirely. This retires the `mcp/` server, the `electron/mcp-config.ts` auto-registration with Claude Code, the `--mcp` headless mode, the "Messenger Protocol" settings card, the `/api/settings/mcp-status` route, the `mcp:compile` / `mcp:dev` scripts, `dist-mcp` bundling, and the direct `@modelcontextprotocol/sdk` dependency. The MCP integration was no longer used.

### 🐛 Bug Fixes
- Fix the recurring "app won't launch" / duplicate-process issue on macOS. Spawned `--mcp` instances were booting a full Chromium profile against the same `userData` directory as the GUI and taking the profile lock, so the main window never appeared. Removing MCP eliminates the contention and the sage opens reliably once more.
- Add an `ensureWindow()` fallback so the `second-instance` and `activate` handlers recreate the window when it has been destroyed, instead of silently doing nothing.

### 🖥️ Electron
- Removed the ⌘⇧O global rescue shortcut and its menu accelerators, introduced in v1.12.1.

## [1.12.1] - 2026-06-17

### 🐛 Bug Fixes
- Fix Electron window launching off-screen and staying invisible (only the menu bar appeared). The off-screen bounds check previously ran only at window creation; since the app stays alive on macOS after the window is closed, re-showing it via `activate`, `second-instance`, or the timeout fallback skipped validation and could reappear on a now-disconnected external monitor. Every show path now validates and recenters the window onto a visible display via new `isPointOnScreen` / `ensureWindowOnScreen` / `showMainWindow` helpers (center-based check).

### 🖥️ Electron
- Add a global rescue shortcut ⌘⇧O (CommandOrControl+Shift+O) that forces the window onto a visible display and focuses it — works even when the app is unfocused or the window is stuck off-screen.
- Add "Bring Window to Front" menu items (⌘⇧O) in both the app menu and a new custom Window menu.

## [1.12.0] - 2026-05-31

### ✨ Features
- "Fetch from Last Update" — pre-fill the day's input with your most recent prior update's transcript, so you can reuse and tweak yesterday's words instead of starting from scratch. Skips empty days (weekends, leave, blanks) to land on the last day with reusable content.

### 🔌 Integrations
- Add OpenAI and Azure OpenAI as AI provider options, with an admin-only "Sacred Sanctum" page for bestowing global API keys. Each devotee can opt in per-provider via the "Use the global oracle" toggle in Divine Oracle; personal keys still take precedence, falling back to the global config when set.
- Centralize the global-vs-personal key decision in a shared resolver reused across parsing, AI testing, and Jira issue enrichment for consistent behavior.
- Extend Jira issue enrichment to support Groq, OpenAI, and Azure OpenAI providers (previously errored for Groq).

## [1.11.0] - 2026-04-17

### ✨ Features
- Per-transaction performance analytics and admin observability

### 🐛 Bug Fixes
- Bump authedFetch timeout to 45s and guard firebase-admin hot-reload
- Increase authedFetch default timeout from 15s to 30s

## [1.10.2] - 2026-04-08

### ✨ Features
- Add edit_draft and get_status MCP tools with improved setup UX
- Add get_draft tool to MCP server

### 🐛 Bug Fixes
- Treat 401 as error instead of silently waiting for AuthGuard
- Add 15s timeout to authedFetch to prevent infinite spinners
- Add error states and user feedback across all pages
- Address SED-3 review findings
- Skip error state on 401 responses in settings
- Improve Get API Key links and add Deepgram link
- Add error states with retry to settings page and AI provider card
- Use json_object mode for Groq instead of strict json_schema

### ♻️ Refactoring
- Simplify update dialog to only offer download page link
- Extract PageError component and fix draft toast spam

### 🧹 Chores
- Update Groq Bruno request with full system prompt and sample transcript

## [1.10.1] - 2026-04-07

### 🐛 Bug Fixes
- Use correct Groq model ID (Llama 4 Scout)

### 🧹 Chores
- Add Bruno request for Groq Chat Completions API

## [1.10.0] - 2026-04-07

### ✨ Features
- Add Groq as AI provider option in Divine Oracle

## [1.9.3] - 2026-04-07

### 🐛 Bug Fixes
- Clear stale indicators on month change and simplify skip guard
- Remove unused updateCount prop after review
- Fetch updates when navigating to previous/next months in calendar

### 🧹 Chores
- Add .claude/worktrees to .gitignore

## [1.9.2] - 2026-04-04

### 🐛 Bug Fixes
- Prevent invisible window when saved bounds are off-screen on macOS

## [1.9.1] - 2026-04-04

### 🐛 Bug Fixes
- Add production logging audit across 24 files

## [1.9.0] - 2026-04-04

### 📝 Documentation
- Add MCP, Slack threads, and Cloud Sync feature cards to landing page
- Update Teams setup to use Workflows instead of deprecated Connectors
