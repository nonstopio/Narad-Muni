# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Narada is a voice-first productivity platform that converts a single voice recording into formatted daily updates for Slack, Microsoft Teams, and Jira work logs. Record once, publish everywhere. The project is currently in the **pre-implementation phase** — the PRD (`Narada-PRD.md`) and UI prototype (`narada-ui-prototype.html`) are complete; no application code exists yet.

## Planned Tech Stack

- **Framework:** Next.js 15+ with TypeScript (App Router)
- **UI:** Tailwind CSS + shadcn/ui
- **State:** Zustand
- **Database:** SQLite + Prisma ORM
- **Offline:** Dexie.js (IndexedDB)
- **Speech-to-Text:** Deepgram Nova-3
- **AI Processing:** Claude API (Sonnet 4.5) with tool use for structured JSON output
- **Deployment:** Vercel / Railway

## Architecture

```
Client (Next.js React) → API Routes → External Services
                                      ├─ Deepgram (transcription)
                                      ├─ Claude API (parsing/formatting)
                                      ├─ Slack (webhook)
                                      ├─ Teams (webhook)
                                      └─ Jira REST v3 (work logs)
                       → SQLite (Prisma) for persistence
```

**Data flow:** Calendar click → voice/text input → `/api/transcribe` (Deepgram) → `/api/parse` (Claude extracts tasks, times, blockers into structured JSON) → tabbed preview (editable) → "Share All" triggers parallel calls to `/api/slack`, `/api/teams`, `/api/jira` → results stored in SQLite.

## Key Data Models (Prisma)

- **Update** — one per calendar day; stores raw transcript, formatted outputs per platform, and publish status (PENDING/SENT/FAILED/SKIPPED) per platform
- **WorkLogEntry** — Jira time entries linked to an Update; includes `isRepeat` flag for auto-injected recurring entries
- **PlatformConfig** — per-platform settings (webhook URLs, API tokens, Jira credentials)
- **RepeatEntry** — recurring Jira work log entries auto-injected daily (e.g., fixed meeting blocks at 10:00 and 18:00)

## Design System

Dark glassmorphism theme (inspired by Linear/Raycast/Arc). Reference the prototype file for exact implementation.

- **Backgrounds:** `#0A0A0F` (base), `#12121A` (surface), `#1A1A2E` (elevated)
- **Accent colors:** Blue `#3B82F6` (primary), Violet `#8B5CF6` (secondary), Emerald `#10B981` (success/share), Amber `#F59E0B` (warning), Rose `#EF4444` (error/recording)
- **Fonts:** Inter (UI), JetBrains Mono (code/URLs/tokens)
- **Glass effect:** `background: rgba(255,255,255,0.03)`, `border: 1px solid rgba(255,255,255,0.06)`, `backdrop-filter: blur(20px)`
- **Layout:** 280px sidebar + fluid main content

## Key Domain Concepts

- **Repeat/Fixed Entries:** Jira work log entries that are automatically injected into every day's work log (configured in Settings). This is a core differentiator — the existing manual workflow at `JIRA-WORK/` requires recreating these entries daily.
- **Platform toggles:** Users can enable/disable individual platforms per update before publishing.
- **The 4-step modal flow:** Input → Processing → Preview (tabbed: Slack/Teams/Jira, all editable) → Success.

## API Integration Notes

- **Slack/Teams MVP:** Incoming Webhooks (simple POST). v2 migrates to Bot Token / Graph API.
- **Jira:** REST API v3, Basic auth (email + API token), worklog endpoint. Times stored in IST, converted to UTC (subtract 19800s) before API call.
- **Deepgram:** Pre-recorded mode (upload WebM blob) for MVP. Config: `smart_format=true`, `punctuate=true`, `diarize=false`.
- **Claude API:** Tool use with strict JSON schema. Input is raw transcript + context (project names, known Jira keys, repeat entries). Output is structured JSON with `tasks[]`, `blockers[]`, `timeEntries[]`, `slackFormat`, `teamsFormat`.

## Reference Files

- `Narada-PRD.md` — Complete product requirements (750 lines), the authoritative spec for all features, data models, API contracts, and UI behavior
- `narada-ui-prototype.html` — Interactive HTML/CSS/JS prototype with all screens (calendar, history, settings, update modal)
