# Narad Muni — Presentation Guide

> **Record once. Publish everywhere.**
> Your daily standup takes 15-20 minutes across Slack, Teams, and Jira. Narad Muni brings that down to under 2 minutes.

Named after the [divine messenger Narad](https://en.wikipedia.org/wiki/Narada) who carries word across the three worlds — this tool does the same for your daily updates.

---

## 1. The Problem

Every day, engineers repeat the same ritual:

| Step | Action | Time |
|------|--------|------|
| 1 | Open Slack, recall what you did | 2 min |
| 2 | Format update with bullets, ticket links | 3 min |
| 3 | Open Teams, rewrite in different format | 3 min |
| 4 | Open Jira, find each ticket | 2 min |
| 5 | Log time on ticket #1 | 1 min |
| 6 | Log time on ticket #2 | 1 min |
| 7 | Log time on ticket #3 | 1 min |
| 8 | Log time on recurring meetings | 2 min |
| 9 | Double-check everything adds up to 8h | 1 min |
| | **Total** | **~16 min** |

That's **9 context switches** across 3 platforms, every single day.

**Scale it up:**
- 1 person: 16 min/day = **5.3 hours/month**
- 10-person team: **53 hours/month** = 6.6 working days lost
- 50-person org: **265 hours/month** = 33 working days lost

And it's not just time — it's the cognitive load of formatting differently for each platform, remembering ticket IDs, calculating hours, and making sure nothing is missed.

---

## 2. The Solution — How It Works

### End-to-End Flow in 5 Steps

**Step 1: Open the calendar, click today's date**

The home screen shows a monthly calendar. Days with existing updates are highlighted in blue. Click any empty day to create a new update.

**Step 2: Speak or type your update**

Hit the microphone button (or `Cmd+R`) and talk naturally:

> *"Today I worked on the login page redesign, that was PROJ-123, spent about 3 hours on it. Then I did code review for the payments module, PROJ-456, took about an hour. Had the daily standup and sprint planning. Tomorrow I'll continue with the login page and start the password reset flow. I'm blocked on the API team — still waiting for the auth endpoint."*

That's it. One take. No formatting, no structure needed.

**Step 3: AI processes your recording**

Click "Invoke the Sage" (or `Cmd+Enter`). The AI:
- Extracts individual tasks with Jira ticket IDs
- Calculates time distribution to fill an 8-hour workday
- Detects blockers and tomorrow's plan
- Formats output for Slack (mrkdwn), Teams (Adaptive Card), and Jira (work log entries)
- Merges in your recurring entries (daily standup, sprint ceremonies, etc.)

**Step 4: Preview and edit per platform**

Three tabs show the formatted output for each platform. Everything is editable before sending:

**Slack Preview:**
```
*TODAY*
• `PROJ-123` Login page redesign — 3h
• `PROJ-456` Code review: payments module — 1h
• Daily standup — 30m
• Sprint planning — 1h
• Team sync — 30m
• Email & Slack — 1h
• Knowledge sharing — 1h

*TOMORROW*
• Continue login page redesign
• Start password reset flow (PROJ-789)

*BLOCKER*
• Waiting on API team for auth endpoint
```

**Teams Preview:**
```
**TODAY**
- PROJ-123 Login page redesign — 3h
- PROJ-456 Code review: payments module — 1h
- Daily standup — 30m
- Sprint planning — 1h
- Team sync — 30m
- Email & Slack — 1h
- Knowledge sharing — 1h

**TOMORROW**
- Continue login page redesign
- Start password reset flow (PROJ-789)

**BLOCKER**
- Waiting on API team for auth endpoint
```

**Jira Work Log Preview:**

| Ticket | Time | Start | Comment |
|--------|------|-------|---------|
| PROJ-123 | 3h | 10:00 | Login page redesign |
| PROJ-456 | 1h | 13:00 | Code review: payments module |
| PROJ-100 | 30m | 14:00 | Daily standup *(recurring)* |
| PROJ-100 | 1h | 14:30 | Sprint planning *(recurring)* |
| PROJ-100 | 30m | 15:30 | Team sync |
| PROJ-200 | 1h | 16:00 | Email & Slack |
| PROJ-200 | 1h | 17:00 | Knowledge sharing |

**Step 5: One click — "Dispatch to All Worlds"**

Press the button (or `Cmd+Shift+Enter`). Narad Muni simultaneously:
- POSTs to your Slack webhook with mrkdwn formatting
- POSTs an Adaptive Card to your Teams webhook
- Creates individual work log entries on each Jira ticket via REST API

Status badges show the result: SENT, FAILED, or SKIPPED (if you toggled a platform off).

**Total time: under 2 minutes.** Down from 16.

---

## 3. Feature Deep-Dives

### 3.1 Voice Recording

- **One-tap recording** — click the mic button or press `Cmd+R` from anywhere in the app
- **Live waveform visualizer** — 16-26 animated bars showing real-time audio levels, rendered at 60fps
- **Deepgram Nova-3** transcription — industry-leading speech-to-text accuracy
- **Append mode** — transcript appends to the text area, so you can record multiple takes or mix voice + typing
- **Smart format** — Deepgram auto-punctuates and formats the transcript

### 3.2 AI Parsing — 4 Provider Options

The AI engine that converts raw transcripts into structured updates supports 4 providers:

| Provider | How It Works | API Key Needed? |
|----------|-------------|-----------------|
| **Local Claude CLI** | Spawns local `claude` CLI process | No |
| **Claude API** | Anthropic SDK with tool calling | Yes |
| **Gemini 2.0 Flash** | Google AI SDK with JSON schema | Yes |
| **Local Cursor** | Spawns local `cursor` CLI process | No |

**What the AI extracts:**
- `tasks[]` — each task with description, ticket ID, time estimate
- `blockers[]` — anything blocking progress
- `timeEntries[]` — Jira-ready entries with ticket, duration, start time, comment
- `tomorrowTasks[]` — planned work for the next day
- `slackFormat` — pre-formatted Slack mrkdwn
- `teamsFormat` — pre-formatted Teams markdown

**Smart time scaling:**
- Enforces 8-hour minimum workday
- 30-minute granularity, 30-minute minimum per entry
- Weights tasks by effort type:
  - **High**: implementation, debugging, migration, architecture
  - **Medium**: code review, testing, documentation
  - **Low**: standup, sync, quick fix
- Schedules entries sequentially, starting after recurring entries end

### 3.3 Slack Integration

- **Incoming Webhook** — POST with `{ text }` payload in Slack mrkdwn format
- **User mention** — configurable `<@userId>` prepended to the message header
- **Team lead auto-tag** — when blockers are detected, automatically appends `cc <@teamLeadId>`
- **Ticket linkification** — `PROJ-123` auto-converted to `<https://jira.example.com/browse/PROJ-123|PROJ-123>` (clickable link)

### 3.4 Teams Integration

- **Incoming Webhook** — POST with Adaptive Card v1.4 payload
- **Structured sections** — TODAY, TOMORROW, BLOCKER as separate `TextBlock` elements with proper spacing
- **User mention** — `<at>userName</at>` with `msteams.entities` mention array
- **Team lead auto-tag** — appends mention TextBlock when blockers present
- **Ticket linkification** — `PROJ-123` auto-converted to `[PROJ-123](https://jira.example.com/browse/PROJ-123)` (markdown link)

### 3.5 Jira Work Logs

- **REST API v3** — individual `POST /rest/api/3/issue/{issueKey}/worklog` per entry
- **Basic auth** — email + API token
- **Timezone-aware** — wall-clock times stored locally, converted to true UTC for the API using `Intl.DateTimeFormat` offset calculation
- **Rate limiting protection** — 2-second delay between requests
- **Auto-retry** — 3 attempts on transient errors (429, 5xx) with 5-second backoff
- **Idempotent** — tracks `jiraWorklogId` per entry, never double-posts on retry
- **Comments in ADF** — work log comments formatted as Atlassian Document Format

### 3.6 Repeat/Fixed Entries

For tasks that happen every single day (standup, team sync, email), configure them once and forget:

- **Settings > Jira** — add recurring entries with ticket ID, hours, start time, and comment
- **Auto-injected** — every day's work log automatically includes these entries
- **AI-aware** — the AI prompt includes repeat entries so it doesn't duplicate them from your transcript
- **Smart scheduling** — AI starts new entries only after recurring entries end (e.g., 2h of recurring entries from 10:00 = new entries start at 12:00)
- **Time scaling** — remaining hours (8h minus recurring total) are distributed among transcript-derived tasks

### 3.7 Calendar Dashboard

The home screen shows three stats and a monthly calendar:

| Stat | What It Shows | Example |
|------|--------------|---------|
| Messages This Month | Count of updates sent | 18 |
| Devotion Streak | Consecutive days with updates | 12 days |
| Time Reclaimed | Estimated minutes saved (12 min per update) | 3h 36m |

- **Calendar view** — monthly grid, navigate with arrows
- **Blue-highlighted days** — dates with existing updates
- **Click existing** — opens detail modal (read-only view + delete + retry)
- **Click empty** — navigates to update creation for that date

### 3.8 History & Search

- **Full list** — all past updates ordered by date (newest first)
- **Search** — filter by transcript content or formatted output ("Search the chronicles...")
- **Status badges** — color-coded per platform (green = SENT, red = FAILED)
- **Detail modal** — full transcript, formatted outputs for each platform, work log table
- **Delete** — remove update with confirmation (cascades to work log entries)
- **Retry** — re-open failed updates for editing and re-dispatch

### 3.9 Smart Blocker Detection

When you mention blockers in your update, the system automatically tags your team lead:

1. AI extracts blockers into a dedicated `BLOCKER` section
2. `hasRealBlockers()` checks if the section contains meaningful content
3. Filters out "NA", "None", "N/A", empty content
4. If real blockers exist AND team lead is configured:
   - **Slack**: appends `cc <@teamLeadId>` to the message
   - **Teams**: adds a mention TextBlock with `<at>teamLeadName</at>` to the Adaptive Card

No configuration beyond setting the team lead ID — detection is fully automatic.

### 3.10 Ticket Linkification

Any Jira ticket ID (e.g., `PROJ-123`, `ABC_DEF-456`) mentioned in your update is automatically converted to a clickable link:

- **Pattern**: `/\b([A-Z][A-Z0-9_]+-\d+)\b/g`
- **Slack**: `<https://jira.example.com/browse/PROJ-123|PROJ-123>`
- **Teams**: `[PROJ-123](https://jira.example.com/browse/PROJ-123)`
- Uses the Jira base URL from your settings — no extra configuration needed
- Gracefully skips if Jira isn't configured

### 3.11 Draft Auto-Save

Never lose an unsaved update:

- **Debounced save** — draft saved 1.5 seconds after your last keystroke
- **Per-day drafts** — one draft per calendar date, stored in SQLite
- **Auto-restore** — navigate away and come back, your text is still there
- **Cleanup** — draft automatically deleted when you publish the update
- **Flush on exit** — pending save fires even when closing the page (`keepalive: true` fetch)

### 3.12 Retry Mode

When a platform fails (webhook down, API error), you can retry just the failed ones:

1. Open the update in History → see FAILED badge on a platform
2. Click "Retry Failed Platforms"
3. Update page opens with existing outputs pre-filled
4. Edit if needed, then dispatch
5. Only FAILED platforms are retried — SENT ones are skipped
6. Jira: orphaned entries (no `jiraWorklogId`) are cleaned up before re-posting

### 3.13 Keyboard Shortcuts

Power-user navigation built in:

| Shortcut | Action |
|----------|--------|
| `Cmd+1` | Go to Calendar (Scrolls) |
| `Cmd+2` | Go to History (Chronicles) |
| `Cmd+3` | Go to Settings (Configurations) |
| `Cmd+4` | Go to Bug Report (Seek Aid) |
| `Cmd+R` | Toggle voice recording / quick-create today |
| `Cmd+Enter` | Invoke the Sage (AI process) |
| `Cmd+Shift+Enter` | Dispatch to All Worlds (share) |
| `Escape` | Close modal / go back |
| `?` | Open keyboard shortcuts reference |

**Vim-style navigation** (when not in a text field):

| Shortcut | Action |
|----------|--------|
| `g h` | Go home |
| `g c` | Go to Chronicles |
| `g s` | Go to Settings |
| `g r` | Go to Bug Report |
| `n` | New update for today |

### 3.14 Native Desktop App (Electron)

Ships as a native macOS application:

- **Auto-migration** — database schema updates apply automatically on every launch (no manual migration steps)
- **Local SQLite** — data stored in `~/Library/Application Support/Narad Muni/`
- **Auto-updates** — checks GitHub Releases on launch, downloads DMG with progress bar
- **Window memory** — saves and restores window position/size
- **Single instance** — second launch focuses the existing window
- **External links** — open in your default browser, not in-app
- **No runtime dependencies** — Prisma client and Next.js server bundled in the app

### 3.15 Bug Reporting — "Seek Aid"

In-app bug reporting with AI-powered enhancement:

1. Fill in a title and optional description
2. Optionally attach application logs (last 500 lines)
3. Click "Send Petition"
4. AI reformats your input into a structured GitHub issue:
   - Description, Steps to Reproduce, Expected Behavior, Actual Behavior
   - Auto-labels as `bug` or `enhancement` based on prefix
5. Opens GitHub issue creation page with everything pre-filled
6. You review and submit

---

## 4. Time Savings Analysis

### Per-Person Daily Savings

| Activity | Before | After | Saved |
|----------|--------|-------|-------|
| Recall & compose update | 5 min | 1 min (speak) | 4 min |
| Format for Slack | 3 min | 0 (auto) | 3 min |
| Format for Teams | 3 min | 0 (auto) | 3 min |
| Log time in Jira (per ticket) | 5 min | 0 (auto) | 5 min |
| Context switching overhead | 3 min | 0 (one app) | 3 min |
| **Total** | **~19 min** | **~1.5 min** | **~17 min** |

### Team-Level Projection

| Team Size | Daily Savings | Monthly Savings | Yearly Savings |
|-----------|--------------|-----------------|----------------|
| 1 person | 17 min | 5.7 hours | 68 hours |
| 5 people | 85 min | 28 hours | 340 hours |
| 10 people | 170 min | 57 hours | 680 hours |
| 25 people | 425 min | 142 hours | 1,700 hours |
| 50 people | 850 min | 283 hours | 3,400 hours |

*(Assumes 20 working days/month, 12 months/year)*

### Context Switches Eliminated

**Before:** 9 switches (Slack compose → Slack format → Teams compose → Teams format → Jira open → Jira ticket 1 → Jira ticket 2 → Jira ticket 3 → Verify totals)

**After:** 2 actions (Speak → Dispatch)

---

## 5. Architecture Overview

### Data Flow

```
                        +-----------+
Voice/Text Input -----> | Deepgram  | ----> Raw Transcript
                        | Nova-3    |
                        +-----------+
                              |
                              v
                     +----------------+
Raw Transcript ----> | AI Provider    | ----> Structured JSON
                     | (Claude/Gemini)|       (tasks, times, blockers,
                     +----------------+        formatted outputs)
                              |
                              v
                     +----------------+
Structured JSON ---> | Preview & Edit | ----> User reviews/edits
                     | (3 tabs)       |
                     +----------------+
                              |
                   "Dispatch to All Worlds"
                     /        |        \
                    v         v         v
              +---------+ +-------+ +------+
              | Slack   | | Teams | | Jira |
              | Webhook | | Card  | | REST |
              +---------+ +-------+ +------+
                    \         |        /
                     v        v       v
                   +-------------------+
                   | SQLite (Prisma)   |
                   | Status tracking   |
                   +-------------------+
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, TypeScript, App Router, React 19 |
| UI | Tailwind CSS 4 + shadcn/ui + Framer Motion |
| State | Zustand 5 |
| Database | SQLite + Prisma 6 |
| Speech-to-Text | Deepgram Nova-3 |
| AI Processing | Claude CLI / Claude API / Gemini 2.0 Flash |
| Desktop | Electron + better-sqlite3 |
| Icons | Lucide React |

### Data Models

```
Update (one per day)
├── date, rawTranscript
├── slackOutput, teamsOutput
├── slackStatus, teamsStatus, jiraStatus
│   (PENDING | SENT | FAILED | SKIPPED)
└── workLogEntries[] ──> WorkLogEntry
                         ├── issueKey, timeSpentSecs
                         ├── started, comment
                         ├── isRepeat (flag for recurring)
                         └── jiraWorklogId (from API response)

PlatformConfig (per platform: Slack, Teams, Jira)
├── webhookUrl, userId, userName
├── teamLeadName, teamLeadId
├── baseUrl, email, apiToken, projectKey, timezone
├── isActive
└── repeatEntries[] ──> RepeatEntry
                        ├── ticketId, hours
                        ├── startTime, comment
                        └── (cascade delete with config)

AppSettings (singleton)
├── aiProvider (local-claude | claude-api | gemini | local-cursor)
├── claudeApiKey, geminiApiKey, deepgramApiKey
└── (all keys DB-stored, no .env files)

Draft (one per day, auto-saved)
├── date (unique), rawTranscript, updatedAt
└── (deleted on publish)
```

---

## 6. Brand & Personality

Narad Muni is the divine sage who travels the three worlds (Devalok, Prithvilok, Patallok) carrying messages. The app adopts his voice throughout:

| Concept | Corporate Term | Narad's Term |
|---------|---------------|--------------|
| Messages | Messages | Scrolls |
| History | History | Chronicles |
| Platforms | Platforms | Three Worlds |
| Process | Process | Invoke the Sage |
| Important | Important | Sacred |
| Streak | Streak | Devotion |
| Share | Share | Dispatch to All Worlds |
| Settings | Settings | Sacred Configurations |
| Bug Report | Bug Report | Seek Aid |

**Example copy from the app:**
- *"Narayan Narayan! Your word has reached all three worlds!"* — success message
- *"The scrolls will materialize once the sage has spoken..."* — loading state
- *"Alas! The oracle could not be reached"* — error message
- *"Grant me the Deepgram mantra in Sacred Configurations to hear your voice"* — missing API key

**Design:** Dark glassmorphic theme inspired by Linear, Raycast, and Arc. Glass-effect cards with blur, semi-transparent backgrounds, and accent colors (blue primary, violet secondary, emerald success, amber warning, rose error).

---

## 7. Setup & Configuration

### What You Need

| Service | What to Configure | Where to Get It |
|---------|------------------|-----------------|
| Deepgram | API key | [deepgram.com](https://deepgram.com) (free tier available) |
| Slack | Incoming Webhook URL, User ID | Slack App settings |
| Teams | Incoming Webhook URL, User Name, User ID | Teams channel connector |
| Jira | Base URL, Email, API Token, Project Key | [id.atlassian.com/manage-profile/security](https://id.atlassian.com/manage-profile/security) |
| AI Provider | Choose one of 4 options | Local Claude CLI needs no key |

### Quick Setup (5 minutes)

1. **Install** — download the macOS app or run `npm run dev` for web
2. **Settings > Divine Oracle** — add your Deepgram API key and choose an AI provider
3. **Settings > Slack** — paste your webhook URL, enter your Slack User ID
4. **Settings > Teams** — paste your webhook URL, enter your name and ID
5. **Settings > Jira** — enter base URL, email, API token, project key, timezone
6. **Settings > Jira > Repeat Entries** — add your daily recurring tasks (standup, sync, etc.)
7. **Go to the calendar** — click today and start recording

**No `.env` files needed.** Everything is configured through the Settings UI and stored in the local SQLite database.

---

## 8. Key Talking Points for the Presentation

### The Hook
> "How much time does your team spend every day just *reporting* what they did? Not doing the work — just telling people about it."

### The Demo Flow
1. Show the calendar — clean, visual, one click to start
2. Record a 30-second voice update — natural, unstructured
3. Click "Invoke the Sage" — watch AI format everything
4. Show the 3 tabs — Slack, Teams, Jira, all formatted differently
5. Click "Dispatch to All Worlds" — all 3 platforms updated in seconds
6. Show Slack channel — message arrived, ticket IDs are clickable links
7. Show Jira — work logs posted, times correct, comments filled
8. Back to calendar — day is now highlighted, streak counter updated

### The Closer
> "One recording. Three platforms. Under 2 minutes. Every day."

### Objection Handling

| Objection | Response |
|-----------|----------|
| "What if the AI gets it wrong?" | Everything is editable before sending. You always review first. |
| "What about security?" | All data is local (SQLite). API keys stored in your local database. No cloud storage. |
| "What if a platform fails?" | Retry mode lets you re-send only failed platforms without duplicating successful ones. |
| "What about recurring meetings?" | Configure once in Repeat Entries — auto-injected every day, AI won't duplicate them. |
| "Does it work without all 3 platforms?" | Toggle any platform on/off. Use just Slack, just Jira, or any combination. |
