<div align="center">

<img src="resources/icon.png" alt="Narad Muni" width="120" />

# Narad Muni

**Narayan Narayan! Speak once, and I shall carry your word across all three worlds.**

[![Download](https://img.shields.io/badge/Download-Landing_Page-blue?style=for-the-badge&logo=github)](https://nonstopio.github.io/Narad-Muni/)
[![Release](https://img.shields.io/github/v/release/nonstopio/Narad-Muni?style=for-the-badge&logo=electron&label=Latest)](https://github.com/nonstopio/Narad-Muni/releases/latest)
[![License](https://img.shields.io/github/license/nonstopio/Narad-Muni?style=for-the-badge)](LICENSE)

<br />

*Like the divine messenger [Narad Muni](https://en.wikipedia.org/wiki/Narada) who travels across Devalok, Prithvilok, and Patallok carrying sacred word — this tool takes a single voice recording and delivers formatted daily updates to **Slack**, **Microsoft Teams**, and **Jira** work logs.*

**Record once, publish everywhere.**

[Download the App](https://nonstopio.github.io/Narad-Muni/) · [View Releases](https://github.com/nonstopio/Narad-Muni/releases) · [Report Issue](https://github.com/nonstopio/Narad-Muni/issues)

> Founded by [Ajay Kumar](https://github.com/ProjectAJ14)

</div>

---

## How It Works

```
   Speak            AI Oracle           Preview            Publish
  ─────────── ──▶ ─────────────── ──▶ ─────────────── ──▶ ───────────────
  Record your       Deepgram + AI        Edit per-platform      Slack, Teams,
  daily standup     extract tasks,       formatted output       Jira — all at
  naturally         times, blockers      with toggles           once
```

1. **Invoke** — Record audio or type your daily update
2. **Oracle** — AI extracts tasks, blockers, time entries and formats output for each platform
3. **Preview** — Tabbed view (Slack / Teams / Jira) with editable content and per-platform toggles
4. **Deliver** — One click sends your updates to all enabled platforms simultaneously

---

## Setup Guide

Download and install Narad Muni from the [landing page](https://nonstopio.github.io/Narad-Muni/), then follow the steps below to configure each service.

All configuration happens inside the app on the **Settings** page. No `.env` files or config files to edit manually.

### Step 1 — Sign In

1. Open Narad Muni
2. Click **Sign in with Google**
3. Default configurations are created automatically on first login

---

### Step 2 — Configure Deepgram (Voice Transcription)

Deepgram converts your voice recordings to text. **Required if you want to use voice input.**

1. Go to [console.deepgram.com](https://console.deepgram.com/) and create an account
2. Navigate to **API Keys** and create a new key
3. Copy the API key
4. In Narad Muni, go to **Settings → Divine Oracle**
5. Paste the key into the **Deepgram API Key** field
6. Click **Inscribe** to save

> Without this key, voice recording won't work. You can still type updates manually.

---

### Step 3 — Configure AI Provider

The AI provider parses your transcript into structured tasks, time entries, and formatted outputs. Choose one of the four options:

#### Option A: Local Claude (Default — No API Key Needed)

- Uses the [Claude Code CLI](https://claude.ai/code) installed on your machine
- **No API key required** — just make sure Claude CLI is installed
- This is the default, no changes needed

#### Option B: Local Cursor (No API Key Needed)

- Uses [Cursor](https://cursor.sh/) editor's built-in Claude integration
- **No API key required** — just make sure Cursor is installed
- Select **Local Cursor** in Settings → Divine Oracle

#### Option C: Claude API

1. Go to [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. Create a new API key (starts with `sk-ant-...`)
3. In Narad Muni, go to **Settings → Divine Oracle**
4. Select **Claude API** as the provider
5. Paste the key into the **Anthropic API Key** field
6. Click **Test Connection with Oracle** to verify
7. Click **Inscribe** to save

#### Option D: Google Gemini

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Create a new API key (starts with `AIza...`)
3. In Narad Muni, go to **Settings → Divine Oracle**
4. Select **Gemini** as the provider
5. Paste the key into the **Gemini API Key** field
6. Click **Test Connection with Oracle** to verify
7. Click **Inscribe** to save

---

### Step 4 — Configure Slack

Go to **Settings → Slack Portal** in the app. Slack supports two delivery modes:

#### Mode A: Incoming Webhook (Simple)

Posts your update as a standalone message in a channel.

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app (or select existing)
2. Click **Incoming Webhooks** in the sidebar and toggle it on
3. Click **Add New Webhook to Workspace** and select a channel
4. Copy the webhook URL (format: `https://hooks.slack.com/services/...`)
5. In the app, make sure **Thread Reply Mode** is turned off
6. Paste the webhook URL into the **Webhook URL** field
7. (Optional) Enter your **Display Name** and **Slack User ID** (for @mentions)
8. (Optional) Enter **Team Lead Name** and **Team Lead ID** for blocker notifications
9. Click **Inscribe** to save

> **How to find your Slack User ID:** Click your profile picture in Slack → **Profile** → click the three dots (⋯) → **Copy member ID**

#### Mode B: Thread Reply (Advanced)

Replies to a daily workflow/bot message as a thread — keeps the channel clean.

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Go to **OAuth & Permissions** and add these scopes:
   - `channels:history` — to find the workflow message
   - `chat:write` — to post replies
3. Click **Install to Workspace** and authorize
4. Copy the **Bot User OAuth Token** (starts with `xoxb-...`)
5. Invite the bot to your channel: type `/invite @YourBotName` in the channel
6. Get the **Channel ID**: right-click the channel name → **View channel details** → copy the ID at the bottom (starts with `C`)
7. In the app, turn on **Thread Reply Mode**
8. Paste the **Bot Token**, **Channel ID**, and select the **Workflow Time** (when your workflow message posts)
9. (Optional) Set **Thread Match Text** if your workflow message text differs from "Daily Status Update"
10. Click **Inscribe** to save

> The app searches a 10-minute window around the workflow time to find the right thread.

---

### Step 5 — Configure Microsoft Teams

Go to **Settings → Teams Portal** in the app.

1. In Microsoft Teams, navigate to the channel where you want updates posted
2. Click the **three dots (⋯)** next to the channel name → **Connectors** (or **Manage channel** → **Connectors**)
3. Search for **Incoming Webhook** and click **Configure**
4. Give the webhook a name (e.g., "Narad Muni") and optionally upload an image
5. Click **Create** and copy the webhook URL (format: `https://outlook.webhook.office.com/...`)
6. In the app, paste the webhook URL into the **Webhook URL** field
7. Enter your **Display Name** and **User ID** (for @mentions in the Adaptive Card)
8. (Optional) Enter **Team Lead Name** and **Team Lead ID** for blocker notifications
9. Click **Inscribe** to save

---

### Step 6 — Configure Jira

Go to **Settings → Jira Chronicle Portal** in the app.

#### 6a. Basic Jira Setup

1. Go to [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click **Create API token**, give it a label (e.g., "Narad Muni"), and copy the token
3. In the app, fill in:
   - **Base URL** — Your Jira instance URL (e.g., `https://mycompany.atlassian.net`)
   - **Email** — The email associated with your Jira account
   - **API Token** — The token you just created
   - **Project Key** — Your project key (e.g., `PROJ`). Find it in Jira under **Project Settings → Details**
   - **Timezone** — Select your timezone (used for work log timestamps)
4. Click **Test Jira Connection** to verify your credentials
5. Click **Inscribe** to save

#### 6b. Recurring Rituals (Optional)

Set up daily recurring work log entries that are auto-injected into every day's time log. Great for daily standups, EOD syncs, or other regular meetings.

1. In the Jira Chronicle Portal, scroll to **Recurring Rituals**
2. Click **Add Entry** and fill in:
   - **Ticket ID** — Jira issue key (e.g., `PROJ-846`)
   - **Hours** — Duration in 30-minute increments (minimum 30 minutes)
   - **Start Time** — When this entry starts (e.g., `10:00`)
   - **Comment** — Description (e.g., "Team standup and sprint planning")
3. Add as many recurring entries as needed
4. Click **Inscribe** to save

> The AI automatically merges recurring entries with your transcript-derived entries and scales times to meet the 8-hour minimum work day.

---

### Step 7 — Configure Notifications (Optional)

Set up daily reminders so you never miss logging your standup.

1. Go to **Settings** → scroll to notification settings
2. Enable notifications
3. Set your preferred reminder time (e.g., 10:00 AM)
4. Select which days to receive reminders (defaults to weekdays)

---

## Daily Usage

1. Open Narad Muni and click a date on the calendar
2. **Record** your standup (or type it manually)
3. Wait for the AI to process your transcript
4. **Preview** the formatted outputs for each platform (Slack, Teams, Jira)
5. Edit any output if needed, toggle platforms on/off
6. Click **Share All** to publish everywhere at once
7. Check the results — green checkmarks confirm delivery

---

## MCP Server — Log Work from Your AI Assistant

Narad Muni ships an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets AI coding assistants log completed work directly into your daily draft — without leaving the editor.

**How it works:** Your AI assistant calls `log_work` → entry is saved to the day's draft → you open Narad Muni later to preview and publish as usual.

### Auto-Registration (Recommended)

The desktop app **auto-registers** with Claude Code on every launch. No manual setup needed — just install the app, open it once, and the MCP server is ready.

You can verify the registration in **Settings → Divine Messenger Protocol**.

Then you can say things like:
- *"Log that I finished the auth refactor on PROJ-123"*
- *"Log work: Fixed flaky tests in CI pipeline"*

### Manual Setup (Cursor, Windsurf, etc.)

Add the server to your MCP client config (e.g., `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "narada": {
      "type": "stdio",
      "command": "/Applications/Narad Muni.app/Contents/MacOS/Narad Muni",
      "args": ["--mcp"]
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

---

## Developer Setup

For contributors working from the source repo.

### Prerequisites

- Node.js 18+
- npm

### Quick Start

```bash
npm install
npm run electron:dev     # Start Electron + Next.js in dev mode
```

### Scripts

```bash
npm run dev              # Next.js dev server only
npm run build            # Production build
npm run lint             # ESLint
npm run electron:dev     # Dev mode (Next.js + Electron)
npm run electron:build   # Production build + package
npm run mcp:compile      # Build the MCP server
```

### CI/CD Secret

The release workflow requires a **`FIREBASE_SA_JSON`** repository secret — the base64-encoded Firebase service account JSON.

```bash
# Generate the value:
base64 < firebase-service-account.json | pbcopy   # macOS
```

Add it as a GitHub Actions secret under **Settings → Secrets and variables → Actions**.

---

<div align="center">

Built with devotion at [nonstop.io](https://nonstopio.com)

*Narayan Narayan!*

</div>
