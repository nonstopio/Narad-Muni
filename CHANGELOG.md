# Changelog

All notable changes to Narada will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
