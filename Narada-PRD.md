# NARADA — Product Requirements Document

**Version:** 2.0
**Date:** February 8, 2026
**Author:** NonStop io
**Status:** Draft
**Classification:** Internal

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [User Stories & Personas](#4-user-stories--personas)
5. [Design System](#5-design-system)
6. [UI Specification](#6-ui-specification)
7. [Functional Requirements](#7-functional-requirements)
8. [System Architecture](#8-system-architecture)
9. [Tech Stack](#9-tech-stack)
10. [API Integration Specifications](#10-api-integration-specifications)
11. [Data Model](#11-data-model)
12. [Implementation Roadmap](#12-implementation-roadmap)
13. [Risk Assessment & Mitigations](#13-risk-assessment--mitigations)
14. [Success Metrics](#14-success-metrics)
15. [Appendix](#15-appendix)

---

## 1. Executive Summary

Narada is a voice-first productivity platform that eliminates the repetitive task of manually posting daily work updates across multiple platforms. By recording a single voice note, developers and team members can automatically generate and distribute formatted updates to Slack, Microsoft Teams, and Jira work logs simultaneously.

**Core Value Proposition:** Record once, publish everywhere. Narada transforms a single voice recording into platform-specific formatted updates for Slack, Teams, and Jira — cutting daily reporting time from 15+ minutes to under 2 minutes.

---

## 2. Problem Statement

### 2.1 Current Workflow Pain Points

Developers currently spend 15–20 minutes each day manually posting updates across three separate platforms. Each platform requires a different format, different login, and different workflow.

| Platform | Current Process | Pain Point |
|----------|----------------|------------|
| **Slack** | Manually type formatted daily update with Today/Monday/Blockers sections | Must remember exact formatting; copy-paste errors; context switching |
| **MS Teams** | Re-type essentially the same update in Teams message format | Duplicate effort; slight format differences between platforms |
| **Jira Work Logs** | Manually create YAML files and run a custom shell script to log hours | Tedious YAML creation; requires terminal access; error-prone time tracking |

### 2.2 Existing Jira Work Log System

A custom script-based system already exists at `/Users/ajaykumar/Workspace/Baylor/JIRA-WORK` that uses manually-created YAML files to log work hours to Jira via `log-work.sh`. The YAML schema follows this structure:

```yaml
jira:
  base_url: "https://baylorgenetics.atlassian.net"
  email: "akumar@baylorgenetics.com"
  api_token: "<token>"

work_logs:
  - date: "2026-02-06"
    entries:
      # Fixed/repeat entry — 10AM
      - ticket_id: "OPP-846"
        hours: 2
        start_time: "10:00"
        comment: "Team meetings, review and monitoring"

      - ticket_id: "OPP-1425"
        hours: 6
        start_time: "13:00"
        comment: "Gene Panel section backend changes implementation"

      # Fixed/repeat entry — 6PM
      - ticket_id: "OPP-846"
        hours: 2
        start_time: "18:00"
        comment: "Team meetings, review and monitoring"
```

A key pattern observed: entries like `OPP-846` for "Team meetings, review and monitoring" repeat identically across every day at fixed times (10:00 and 18:00). Narada will automate these as **Repeat/Fixed Entries** that are auto-injected into every work log.

### 2.3 Impact Analysis

- **Time wasted:** ~15–20 minutes/day × 250 work days = 62–83 hours/year per developer
- **Context switches:** 3 platforms × (login + format + post) = 9 discrete interruptions daily
- **Error rate:** Inconsistent updates, forgotten platforms, incorrect time logs

---

## 3. Solution Overview

### 3.1 Product Vision

Narada is a web application that provides a voice-first interface for daily standup updates. Users press a button, speak their update naturally, and Narada's AI agent processes the voice recording into structured, platform-specific formats for Slack, Teams, and Jira work logs. After a quick verification step, all platforms are updated with a single click.

### 3.2 Core Workflow

| Step | Action | Detail |
|------|--------|--------|
| **1. Record** | User taps a calendar date | Opens the update modal with a text box and mic button |
| **2. Input** | Speak or type update | Audio is transcribed via Deepgram Nova-3; or user types directly |
| **3. AI Parse** | "Process with AI" | Claude API extracts tasks, time estimates, Jira issue IDs, and blockers into structured data |
| **4. Format** | Platform-specific output | System generates Slack (mrkdwn), Teams (Adaptive Cards), and Jira work log entries (including auto-injected repeat entries) |
| **5. Verify** | Preview & edit | User reviews all three outputs in tabbed preview with inline editing |
| **6. Publish** | "Share All" | Single click sends to all enabled platforms simultaneously via their APIs |
| **7. Store** | Local persistence | All updates stored in SQLite with full history, search, and platform status tracking |

---

## 4. User Stories & Personas

### 4.1 Primary Persona

**Ajay — Senior Full-Stack Developer** at Baylor Genetics. Works across multiple teams and projects. Uses Slack for team communication, Teams for organization-wide updates, and Jira for sprint tracking. Frustrated by spending the first 20 minutes of each day on repetitive status updates instead of coding. Currently maintains a shell script + YAML based workaround for Jira work logs.

### 4.2 User Stories

| ID | Story | Priority |
|----|-------|----------|
| US-001 | As a developer, I want to record my daily update as a voice note so that I can give updates quickly without typing. | Must Have |
| US-002 | As a developer, I want the system to automatically extract Jira issue IDs from my speech so that work logs are linked correctly. | Must Have |
| US-003 | As a developer, I want to preview all formatted outputs before publishing so that I can verify accuracy. | Must Have |
| US-004 | As a developer, I want to publish to Slack, Teams, and Jira with a single click so that I save time. | Must Have |
| US-005 | As a developer, I want to configure repeat/fixed entries (e.g., daily standup meetings) so they auto-populate in every Jira work log. | Must Have |
| US-006 | As a developer, I want to edit the AI-generated output before publishing so that I can correct any errors. | Must Have |
| US-007 | As a developer, I want my update history stored locally so that I can review past updates. | Should Have |
| US-008 | As a developer, I want to add and configure multiple platform destinations so that I can manage updates for different teams/projects. | Should Have |
| US-009 | As a developer, I want the system to learn my common tasks and issue IDs so that accuracy improves over time. | Could Have |

---

## 5. Design System

Narada uses a futuristic, glassmorphism-based dark-mode design system. The aesthetic is inspired by Linear, Raycast, and Arc Browser — premium developer tools that balance futurism with professionalism.

### 5.1 Color Tokens

#### Backgrounds

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#0A0A0F` | Page background, deepest layer |
| `--bg-surface` | `#12121A` | Sidebar, modal backgrounds |
| `--bg-elevated` | `#1A1A2E` | Hover states, elevated content |

#### Glassmorphism

| Token | Value | Usage |
|-------|-------|-------|
| `--glass` | `rgba(255, 255, 255, 0.03)` | Card backgrounds |
| `--glass-border` | `rgba(255, 255, 255, 0.06)` | Card/input borders |
| Backdrop | `backdrop-filter: blur(20px)` | Applied to all glass surfaces |

#### Accent Colors

| Token | Value | Glow | Usage |
|-------|-------|------|-------|
| `--primary` | `#3B82F6` (Electric Blue) | `rgba(59, 130, 246, 0.3)` | Primary actions, active states, focus rings |
| `--secondary` | `#8B5CF6` (Violet) | — | Gradients, logo, avatar |
| `--emerald` | `#10B981` (Emerald) | `rgba(16, 185, 129, 0.3)` | Success, "Share All" button, update dots |
| `--amber` | `#F59E0B` (Amber) | — | Warnings, stats |
| `--rose` | `#EF4444` (Rose) | `rgba(239, 68, 68, 0.5)` | Errors, recording state, remove buttons |

#### Text

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#F1F5F9` | Headings, primary content |
| `--text-secondary` | `#94A3B8` | Body text, descriptions |
| `--text-muted` | `#64748B` | Labels, placeholders, hints |

### 5.2 Typography

| Property | Font | Usage |
|----------|------|-------|
| Sans-serif | `Inter` (400, 500, 600, 700) | All UI text |
| Monospace | `JetBrains Mono` (400, 600) | Code, webhook URLs, preview content, Jira entries |

Font import: `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap`

#### Type Scale

| Element | Size | Weight | Font |
|---------|------|--------|------|
| Page Title | 28px | 700 | Inter |
| Section Title | 18px | 600 | Inter |
| Card Title | 16px | 600 | Inter |
| Body | 14px | 400 | Inter |
| Label | 12px | 600 | Inter (uppercase, 0.5px spacing) |
| Code/Preview | 13px | 400 | JetBrains Mono |
| Badge | 12px | 500 | Inter |

### 5.3 Spacing & Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-card` | `16px` | Cards, modals |
| `--radius-input` | `12px` | Inputs, buttons, day cells |
| `--radius-chip` | `8px` | Badges, repeat entries |
| `--radius-pill` | `24px` | Toggle chips, stat icons, avatar |

### 5.4 Motion & Transitions

| Token | Value | Usage |
|-------|-------|-------|
| `--transition` | `all 0.3s cubic-bezier(0.4, 0, 0.2, 1)` | All interactive elements |
| `pulse` | `1.5s ease-in-out infinite` | Recording mic button glow |
| `blink` | `1s ease-in-out infinite` | Recording dot indicator |
| `spin` | `1s linear infinite` | Processing spinner |
| `scaleIn` | `0.5s cubic-bezier(0.4, 0, 0.2, 1)` | Success checkmark entrance |
| `float` | `20s ease-in-out infinite` | Background gradient blobs |
| `fadeIn` | `0.3s ease` | Recording info appearance |

### 5.5 Elevation & Glow Effects

All interactive elements use glow effects matching their accent color:

- **Primary focus/active:** `box-shadow: 0 0 20px var(--primary-glow)`
- **Emerald (share/success):** `box-shadow: 0 0 20px var(--emerald-glow)`
- **Rose (recording):** `box-shadow: 0 0 20px rgba(239, 68, 68, 0.5)`
- **Hover states:** `background: rgba(255, 255, 255, 0.05)` with border brightening

### 5.6 Background Treatment

Three animated gradient blobs float slowly behind the main content, creating a living, breathing feel:

| Blob | Color | Size | Position | Animation Delay |
|------|-------|------|----------|-----------------|
| Blob 1 | `#3B82F6` (Blue) | 400px | Top-left | 0s |
| Blob 2 | `#8B5CF6` (Violet) | 350px | Center-right | 7s (reversed) |
| Blob 3 | `#10B981` (Emerald) | 300px | Bottom-center | 14s |

All blobs use `filter: blur(80px)` and `opacity: 0.15`.

### 5.7 Component Library

#### Buttons

| Variant | Background | Text | Glow | Usage |
|---------|-----------|------|------|-------|
| `btn-primary` | `--primary` | White | Primary glow | Process, Save, primary actions |
| `btn-emerald` | `--emerald` | White | Emerald glow | Share All |
| `btn-secondary` | `rgba(255,255,255,0.05)` | `--text-secondary` | None | Cancel, Test Connection |
| `btn-danger` | `rgba(239,68,68,0.1)` | `--rose` | None | Remove, Delete |

#### Form Inputs

All inputs use: glass background, glass-border, `--radius-input`, and on focus: primary border + primary glow shadow. Monospace font for URL/token fields.

#### Cards

All cards use glassmorphism: `background: var(--glass)`, `border: 1px solid var(--glass-border)`, `border-radius: var(--radius-card)`, `backdrop-filter: blur(20px)`.

#### Badges

- **Success:** Emerald background tint, emerald border, emerald text
- **Failed:** Rose background tint, rose border, rose text

---

## 6. UI Specification

### 6.1 Layout Structure

The application uses a sidebar + main content layout:

```
┌──────────────┬────────────────────────────────────────┐
│              │                                        │
│   SIDEBAR    │          MAIN CONTENT                  │
│   (280px)    │          (flex: 1)                     │
│              │                                        │
│  ┌────────┐  │  ┌──────────────────────────────────┐  │
│  │ Logo   │  │  │  Page Title                      │  │
│  ├────────┤  │  ├──────────────────────────────────┤  │
│  │ Nav    │  │  │                                  │  │
│  │ Items  │  │  │  Page Content                    │  │
│  │        │  │  │  (scrollable)                    │  │
│  │        │  │  │                                  │  │
│  ├────────┤  │  │                                  │  │
│  │ User   │  │  │                                  │  │
│  │ Profile│  │  │                                  │  │
│  └────────┘  │  └──────────────────────────────────┘  │
└──────────────┴────────────────────────────────────────┘
```

### 6.2 Sidebar

- **Logo:** "Narada" in gradient text (`linear-gradient(135deg, #3B82F6, #8B5CF6)`)
- **Navigation items:** Updates, History, Settings — each with emoji icon and label
- **Active state:** Left 3px accent bar (primary), glass background with inset primary glow
- **User profile:** Gradient avatar circle (blue→violet) with initials "AK", name + role below, separated by a top border

### 6.3 Page: Updates (Calendar)

This is the main page users see on launch.

**Stats Bar (top):** 4 glass stat cards in a responsive grid showing:

| Stat | Icon (bg color) | Value | Label |
|------|-----------------|-------|-------|
| Updates this month | Blue | 24 | UPDATES THIS MONTH |
| Day streak | Violet | 12 | DAY STREAK |
| Avg time saved | Emerald | 8m | AVG TIME SAVED |
| Publish success | Amber | 98% | PUBLISH SUCCESS % |

**Calendar:** Glass container with month navigation arrows and month title. 7-column grid for days. Day cells have: hover brighten effect, today cell gets primary border + glow, days with updates show an emerald dot with glow at the bottom. Clicking any day opens the **Update Modal**.

### 6.4 Page: Settings

A vertically stacked list of glass configuration cards, max-width 600px.

#### Slack Configuration Card

| Field | Type | Placeholder |
|-------|------|-------------|
| Channel Name | Text input | `#updates` |
| Webhook URL | Text input (mono) | `https://hooks.slack.com/services/...` |
| Message Format | Textarea (mono) | Slack mrkdwn template |

Actions: Test Connection (secondary), Save (primary), Remove (danger)

#### Teams Configuration Card

Same structure as Slack, with Teams-specific placeholders.

#### Jira Work Logs Configuration Card

| Field | Type | Placeholder |
|-------|------|-------------|
| Base URL | Text input | `https://mycompany.atlassian.net` |
| Project Key | Text input | `PROJ` |
| Email | Email input | `your@email.com` |
| API Token | Password input | `••••••••••••••••` |
| Timezone | Select dropdown | UTC, America/New_York, Asia/Kolkata, etc. |

**Repeat/Fixed Entries Section:** A highlighted subsection with emerald-tinted background and border. Contains:

- Title: "Repeat/Fixed Entries" with gear icon
- Description: "Auto-added to every work log. For recurring meetings, standups, etc."
- Grid of existing repeat entries (monospace font):
  - Columns: Ticket ID (80px) | Hours (60px) | Start Time (80px) | Comment (1fr) | Remove button (32px)
  - Pre-filled: `OPP-846 | 2h | 10:00 | Team meetings, review and monitoring` and `OPP-846 | 2h | 18:00 | Team meetings, review and monitoring`
- "+ Add Repeat Entry" button (emerald tint)

Actions: Test Connection (secondary), Save (primary), Remove (danger)

#### Add Platform Card

Dashed border card at the bottom: "+ Add Platform". On click, opens a modal with a 3-column grid of platform options: Slack, Teams, Custom Webhook — each as a clickable glass card with icon and name. Hovering any option shows primary glow.

### 6.5 Page: History

- **Search input** at the top (max-width 400px), glass background, primary glow on focus
- **History list:** Vertical stack of glass cards, each showing:
  - Date + time (muted text, 12px)
  - Preview text (secondary text, 14px)
  - Status badges row: success (emerald) or failed (rose) badges per platform

### 6.6 Update Modal (4-Step Flow)

Triggered by clicking any calendar day. Centered modal with overlay (background blur).

#### Step 1: Input

- **Textarea:** Full-width, glass background, 150px min-height. Placeholder: "What did you accomplish today?"
- **Mic button:** Circular, positioned bottom-right of textarea. Default: muted border + mic emoji. Recording state: rose background + glow + pulse animation.
- **Recording indicator:** Appears when recording — red blinking dot + "Recording: 0:00" timer
- **"Process with AI" button:** Full-width primary button with lightning bolt icon

#### Step 2: Processing

- Centered spinner (50px, primary top-border animation)
- Text: "Processing with Claude AI..."

#### Step 3: Preview

- **Tab bar:** Slack | Teams | Jira Work Logs — each with platform emoji icon. Active tab has primary color + underline + glow.
- **Slack tab:** Editable contenteditable div with monospace font showing formatted Slack message
- **Teams tab:** Same, with Teams formatting
- **Jira tab:** HTML table with columns: Ticket | Time Spent | Start Time | Comment. Includes repeat entries from settings.
- **Platform toggles:** Row of pill-shaped toggle chips (Slack, Teams, Jira). Active = primary filled with glow. Click to toggle on/off.

#### Step 4: Success

- Animated checkmark in emerald circle (scaleIn animation)
- "All Updates Published!" title
- Result badges: emerald pills for each platform showing success status
- "Done" button in footer

**Modal Footer:** Cancel button (secondary) on left. Context-dependent right button: "Share All" (emerald, appears at Step 3), "Done" (primary, appears at Step 4).

---

## 7. Functional Requirements

### 7.1 Voice Recording Module

- Browser-based audio capture using MediaRecorder API (WebM/Opus codec)
- Visual recording indicator with blinking dot and timer
- Support for recordings up to 10 minutes
- Mic button with animated recording state (pulse + glow)
- Fallback: users can type directly into the textarea

### 7.2 Speech-to-Text Engine

- Integration with Deepgram Nova-3 API for high-accuracy transcription
- Support for technical jargon, Jira issue IDs (e.g., OPP-1692), and project names
- Features: `smart_format=true`, `punctuate=true`, `diarize=false` (single speaker)
- Cost: ~$0.0085/minute (~$0.50/month for typical daily use)
- Fallback: Web Speech API for offline/cost-saving mode (Chrome only)

### 7.3 AI Processing Agent (Claude API)

The Claude API agent receives the raw transcript and extracts structured data using tool use with strict JSON schema output:

- **Task extraction:** Identifies discrete work items, descriptions, and associated Jira issue keys
- **Time estimation:** Parses spoken time references ("spent about 3 hours") into precise durations
- **Blocker detection:** Identifies and categorizes blockers from natural speech
- **Multi-day awareness:** Distinguishes "today" tasks from "next day" plans
- **Repeat entry injection:** Merges configured repeat entries into the Jira output
- **Format generation:** Produces platform-specific output for Slack, Teams, and Jira simultaneously

### 7.4 Platform Output Formats

**Slack:**
```
Today:
* OPP-1692 Integrate Userpilot in V2 Codebase
Monday:
* Continue working PreSeek & GeneAware test codes
Blockers:
* None
```

**Teams:** Same content structure, adapted for Teams message formatting.

**Jira Work Logs:** Structured entries with ticket_id, hours, start_time, and comment — including auto-injected repeat entries from settings.

### 7.5 Verification & Edit Screen

- Tabbed preview with Slack, Teams, and Jira tabs
- All content is editable (`contenteditable`) before publishing
- Jira tab shows structured table view with all entries
- Platform toggle chips to include/exclude any platform
- "Share All" button triggers parallel API calls

### 7.6 Platform Configuration

- Dynamic platform management: add/remove Slack, Teams, or custom webhook destinations
- Per-platform configuration: channel name, webhook URL, message template
- Jira-specific config: base URL, project key, email, API token, timezone
- Repeat/Fixed entries: auto-injected Jira work log entries for recurring tasks
- Test Connection button per platform with visual feedback

### 7.7 Local Storage & History

- All updates stored in local SQLite database via Prisma ORM
- Full-text search across all historical updates
- History list with date, preview text, and per-platform status badges
- Calendar view with dots on days that have updates
- Export functionality (CSV, JSON)

---

## 8. System Architecture

### 8.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT TIER                                                │
│  Next.js React Frontend | MediaRecorder API                 │
│  Zustand State | Dexie.js (offline cache)                   │
├─────────────────────────────────────────────────────────────┤
│  API TIER                                                   │
│  Next.js API Routes | Prisma ORM | Rate Limiting            │
│  Queue Manager | Authentication                             │
├─────────────────────────────────────────────────────────────┤
│  EXTERNAL SERVICES                                          │
│  Deepgram (STT) | Claude API (AI) | Slack API               │
│  Teams Graph API | Jira REST API                            │
├─────────────────────────────────────────────────────────────┤
│  DATA TIER                                                  │
│  SQLite (local DB) | Audio Blob Storage (filesystem)        │
│  Encrypted Credentials Store                                │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Data Flow

1. User taps calendar date → Modal opens with textarea + mic button
2. User speaks or types → Audio blob sent to `/api/transcribe` → Deepgram Nova-3
3. Transcript returned → Sent to `/api/parse` with Claude API
4. Claude extracts structured data (tasks, times, issues, blockers) → Returns JSON
5. Frontend renders tabbed preview → User edits and confirms
6. "Share All" → Parallel API calls to `/api/slack`, `/api/teams`, `/api/jira`
7. Results stored in SQLite with status per platform

---

## 9. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 15+ (React) | Built-in API routes, SSR/SSG, TypeScript, Vercel deployment |
| **Language** | TypeScript | Type safety across full stack, better IDE support |
| **UI Framework** | Tailwind CSS + shadcn/ui | Rapid prototyping, consistent design system, accessible components |
| **State Management** | Zustand | Lightweight, no boilerplate, works with React Server Components |
| **Audio Capture** | MediaRecorder API | Native browser API, no dependencies, WebM/Opus codec |
| **Speech-to-Text** | Deepgram Nova-3 | 90%+ accuracy, <300ms latency, streaming support, $0.0085/min |
| **AI Agent** | Claude API (Anthropic) | Structured outputs via tool use, strong reasoning, Sonnet 4.5 |
| **Database** | SQLite + Prisma ORM | Zero-config, file-based, excellent for single-user, migration path to PostgreSQL |
| **Offline Cache** | Dexie.js (IndexedDB) | Offline draft support, mature API |
| **Deployment** | Vercel / Railway | Free tier, native Next.js support, automatic HTTPS |
| **Auth/Secrets** | Environment variables | API keys stored in `.env.local`, encrypted at rest |

---

## 10. API Integration Specifications

### 10.1 Slack Integration

**Approach:** Incoming Webhooks (MVP) → Bot Token (v2)

- **Webhook URL:** Configured per-channel in Slack App settings
- **Message format:** Slack mrkdwn with Block Kit sections
- **Rate limit:** 1 message/second per channel
- **SDK (v2):** `@slack/web-api`

### 10.2 Microsoft Teams Integration

**Approach:** Incoming Webhooks (MVP) → Graph API (v2)

- **Webhook:** Per-channel incoming webhook connector
- **Message format:** Adaptive Cards JSON or plain text
- **Rate limit:** 7 calls/second per user, 50 req/second per tenant
- **Auth (v2):** Azure AD app registration with OAuth 2.0

### 10.3 Jira Integration

**Approach:** REST API v3 with API Token Authentication

- **Endpoint:** `POST /rest/api/3/issue/{issueIdOrKey}/worklog`
- **Auth:** Basic auth with email + API token (Jira Cloud)
- **Required fields:** `timeSpentSeconds` (number), `started` (ISO 8601 datetime)
- **Optional fields:** `comment` (Atlassian Document Format)
- **Time conversion:** IST → UTC (subtract 19800 seconds from epoch)
- **Prerequisite:** Time tracking enabled in Jira project settings

### 10.4 Deepgram Integration

- **Model:** Nova-3 (latest, highest accuracy)
- **Mode:** Pre-recorded (upload WebM blob) for MVP; streaming for v2
- **Features:** `smart_format=true`, `punctuate=true`, `diarize=false`
- **Cost:** ~$0.0085/minute (~$0.50/month typical use)

### 10.5 Claude API Integration

- **Model:** Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
- **Feature:** Tool use with strict JSON schema for guaranteed structured output
- **Input:** Raw transcript + user context (project names, common Jira keys, repeat entries config)
- **Output:** Structured JSON with `tasks[]`, `blockers[]`, `timeEntries[]`, `slackFormat`, `teamsFormat`

---

## 11. Data Model

### 11.1 Prisma Schema (SQLite)

#### Table: Update

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `createdAt` | DateTime | Timestamp of recording |
| `date` | DateTime | The calendar date this update is for |
| `rawTranscript` | String | Full transcript from Deepgram |
| `audioPath` | String? | Path to stored audio blob |
| `slackOutput` | String | Formatted Slack mrkdwn output |
| `teamsOutput` | String | Formatted Teams output |
| `slackStatus` | Enum | PENDING / SENT / FAILED / SKIPPED |
| `teamsStatus` | Enum | PENDING / SENT / FAILED / SKIPPED |
| `jiraStatus` | Enum | PENDING / SENT / FAILED / SKIPPED |

#### Table: WorkLogEntry

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `updateId` | String (FK) | References Update.id |
| `issueKey` | String | Jira issue key (e.g., OPP-1692) |
| `timeSpentSecs` | Int | Duration in seconds |
| `started` | DateTime | Work start time (ISO 8601) |
| `comment` | String? | Work log description |
| `isRepeat` | Boolean | Whether this is an auto-injected repeat entry |
| `jiraWorklogId` | String? | Returned ID after Jira API call |

#### Table: PlatformConfig

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `platform` | Enum | SLACK / TEAMS / JIRA |
| `name` | String | Friendly name (e.g., #standup-baylor) |
| `webhookUrl` | String? | Webhook URL for Slack/Teams |
| `messageTemplate` | String? | Custom message format template |
| `apiToken` | String? | Encrypted API token for Jira |
| `baseUrl` | String? | Jira instance URL |
| `email` | String? | Jira email |
| `projectKey` | String? | Jira project key (e.g., OPP) |
| `timezone` | String? | User timezone for time conversion |
| `isActive` | Boolean | Enable/disable this config |

#### Table: RepeatEntry

| Field | Type | Description |
|-------|------|-------------|
| `id` | String (UUID) | Primary key |
| `configId` | String (FK) | References PlatformConfig.id (Jira config) |
| `ticketId` | String | Jira issue key (e.g., OPP-846) |
| `hours` | Float | Duration in hours |
| `startTime` | String | Start time in HH:MM format |
| `comment` | String | Work log description |

---

## 12. Implementation Roadmap

### Phase 1: Foundation (Weeks 1–2)

Core infrastructure, audio recording, and basic transcription pipeline.

1. Initialize Next.js project with TypeScript, Tailwind CSS, and Prisma
2. Implement design system: CSS custom properties, glassmorphism components, animated background blobs
3. Build sidebar navigation and page routing
4. Build audio recording component with MediaRecorder API (record/stop/playback)
5. Create `/api/transcribe` endpoint with Deepgram Nova-3 integration
6. Set up SQLite database with Prisma schema

### Phase 2: AI Agent & Formatting (Weeks 3–4)

Claude API integration for intelligent parsing and multi-platform formatting.

1. Integrate Claude API with structured output schema for transcript parsing
2. Build AI prompt engineering for task extraction, time parsing, and blocker detection
3. Implement Slack mrkdwn formatter
4. Implement Teams message formatter
5. Implement Jira work log JSON formatter with repeat entry injection
6. Build the tabbed preview/edit modal with contenteditable fields

### Phase 3: Platform Integration & Settings (Weeks 5–6)

Connect to all three platforms and build the settings UI.

1. Build `/api/slack` endpoint (webhook POST)
2. Build `/api/teams` endpoint (webhook POST)
3. Build `/api/jira` endpoint (REST v3 worklog creation)
4. Implement parallel publish with per-platform status tracking
5. Build Settings page: Slack, Teams, Jira configuration cards
6. Build Repeat/Fixed Entries management UI
7. Build Add Platform modal with platform type selector
8. Add retry logic with exponential backoff

### Phase 4: Polish & Launch (Weeks 7–8)

History, search, deployment, and hardening.

1. Build History page with search and status badges
2. Add calendar update dots (green indicators)
3. Add Dexie.js for offline draft support
4. Implement export (CSV, JSON)
5. Add error boundaries, loading states, and WCAG 2.1 AA accessibility
6. Deploy to Vercel with environment variable configuration
7. End-to-end testing and documentation

---

## 13. Risk Assessment & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Speech-to-text accuracy with technical jargon (Jira IDs, project names) | High | Medium | Custom vocabulary hints in Deepgram; user correction in preview; learning from corrections over time |
| AI hallucination of Jira issue keys | Medium | High | Validate extracted issue keys against Jira API before publishing; maintain local cache of valid keys |
| Slack/Teams webhook deprecation | Low | Medium | Design adapter pattern for easy migration to Bot Token / Graph API in v2 |
| API rate limiting during bulk publish | Low | Low | Sequential publish with delays; exponential backoff on 429 responses |
| SQLite limitations for concurrent access | Low | Low | Single-user app; WAL mode enabled; migration path to PostgreSQL documented |
| Deepgram/Claude API cost overruns | Medium | Medium | Usage monitoring dashboard; daily budget caps; local caching of repeated requests |
| Browser microphone permission denied | Medium | Low | Clear permission prompts; fallback to text-only input; error messaging |

---

## 14. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time per daily update | < 2 minutes end-to-end | Currently 15–20 minutes |
| Transcription accuracy | > 90% correct on first pass | Edit distance before/after user corrections |
| AI parsing accuracy | > 85% tasks/times extracted correctly | Correction rate in preview screen |
| Publish success rate | > 99% successful API calls | Per-platform failure rate monitoring |
| User adoption | Daily active usage for 30 consecutive days | Recording frequency in local DB |
| Context switches eliminated | Reduced from 9 to 2 interactions | Single record + single publish |

---

## 15. Appendix

### 15.1 Glossary

| Term | Definition |
|------|-----------|
| **STT** | Speech-to-Text — converting audio speech to written text |
| **mrkdwn** | Slack's custom markdown-like formatting syntax |
| **Adaptive Cards** | Microsoft's cross-platform card-based UI framework for Teams |
| **Work Log** | A Jira time tracking entry recording hours spent on an issue |
| **Repeat Entry** | A fixed Jira work log entry auto-injected daily (e.g., recurring meetings) |
| **Glassmorphism** | UI style using translucent backgrounds, blur effects, and light borders |
| **Deepgram Nova-3** | Latest generation speech recognition model from Deepgram |
| **Prisma** | Type-safe ORM for Node.js and TypeScript with migration support |

### 15.2 Reference Links

- Slack API: https://api.slack.com
- Microsoft Graph API: https://learn.microsoft.com/en-us/graph
- Jira REST API v3: https://developer.atlassian.com/cloud/jira/platform/rest/v3
- Deepgram API: https://developers.deepgram.com
- Claude API (Anthropic): https://docs.anthropic.com/en/api
- Next.js: https://nextjs.org/docs
- Prisma ORM: https://www.prisma.io/docs
- Dexie.js: https://dexie.org
- Tailwind CSS: https://tailwindcss.com
- shadcn/ui: https://ui.shadcn.com
- Inter Font: https://rsms.me/inter
- JetBrains Mono: https://www.jetbrains.com/lp/mono

### 15.3 Existing System Reference

The Jira work log system at `JIRA-WORK/` uses a bash script (`scripts/log-work.sh`) that reads YAML config files, converts IST times to UTC, and calls the Jira REST API v3 worklog endpoint. Key dependencies: `yq`, `jq`, `curl`. Authentication uses Basic auth (Base64 of email:api_token). Narada will fully replace this workflow.

### 15.4 Related Files

- **UI Prototype:** `narada-ui-prototype.html` — Interactive HTML prototype demonstrating all screens and flows
- **Previous PRD (v1):** `Narada-PRD-v1.0.docx` — Initial Word document version

---

*End of Document*
