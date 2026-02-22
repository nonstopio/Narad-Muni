# Changelog

All notable changes to Narada will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-22

### ✨ Features

- Add in-app issue reporter ("Seek Aid") with AI-powered enrichment for submitting bug reports and feature requests
- Add install instructions modal with platform-specific guidance for macOS and Windows
- Add company logo link to the title bar for quick navigation

### 🐛 Bug Fixes

- Format issue title via AI and strip preamble from the enriched body to produce cleaner reports
- Add keyboard shortcuts for the Seek Aid (/report) page

## [1.0.4] - 2026-02-21

### 🐛 Bug Fixes

- Resolve Prisma client module errors in Electron packaged app (Turbopack hashed `@prisma/client` symlink broke inside asar archive)
- Include generated `.prisma/client` in electron-builder package via FileSet

### 💄 UI/UX

- Revamp landing page with animations, stats section, how-it-works steps, company branding, and scroll reveal effects

## [1.0.3] - 2026-02-21

### Fixed

- Convert icon.ico from PNG to proper ICO format with multiple sizes for Windows builds
- Update macOS x64 CI runner from deprecated macos-13 to macos-15

## [1.0.2] - 2026-02-21

### Fixed

- Set DATABASE_URL environment variable in CI workflow for Prisma CLI commands

## [1.0.1] - 2026-02-21

### Fixed

- Fix production build failure by marking database-dependent pages as dynamic (force-dynamic)
- Add database schema initialization step to CI workflow for clean builds

## [1.0.0] - 2026-02-21

The first release of Narada -- the divine messenger who carries word across the three worlds.

### ✨ Features

- Voice recording with real-time audio visualizer and Deepgram Nova-3 transcription
- AI-powered transcript parsing into structured daily updates (tasks, time entries, blockers, tomorrow plans)
- Multi-provider AI support: Local Claude CLI, Claude API (Anthropic SDK), Gemini (Google AI SDK), and Local Cursor
- Calendar dashboard with monthly view, update indicators, and streak tracking
- Update creation flow: record/type, transcribe, AI parse, tabbed preview, edit, and publish
- Platform publishing to Slack (webhooks), Microsoft Teams (Adaptive Cards), and Jira (REST API v3 worklogs)
- History page with search, detail modal, and delete functionality
- Settings page for platform configuration (Slack, Teams, Jira credentials and webhooks)
- AI provider selection and API key management with secure DB-backed storage
- Work log entry management with duration parsing, task weightage inference, and time scaling to meet 8-hour minimum
- Repeat/fixed Jira entries auto-injected into every day's work log
- Jira worklog publishing with retry logic and 1-second rate limit delay
- Transcript appending (new recordings append to existing transcript instead of replacing)
- Keyboard shortcuts with dedicated settings UI and global event handling
- User name and ID fields per platform configuration
- Toast notifications for error handling and success feedback across all forms
- Deepgram API key moved from environment variable to DB-backed AppSettings (single source of truth)

### 💄 UI/UX

- Dark glassmorphism design system inspired by Linear, Raycast, and Arc
- Lottie animation for AI processing state with Muni orb visual
- Real-time audio waveform visualizer during voice recording
- Enhanced calendar component with day-level update indicators and navigation
- Sidebar with application logo, navigation icons, and stats (updates count, streak, time saved)
- Narad Muni personality infused across all user-facing copy and messaging
- Improved settings layout with adjusted container structure and spacing
- Streamlined modal flow by removing redundant success step

### 🖥️ Electron

- macOS desktop app with hidden titlebar and native window controls
- BrowserWindow shell with single instance lock and macOS lifecycle management (hide-on-close, activate)
- Auto-migration runner that applies pending SQL migration files on startup via better-sqlite3
- Custom application menu for macOS
- electron-builder configuration with app icons and entitlements
- Dev mode orchestrator: compiles TypeScript, syncs DB schema, starts Next.js and Electron concurrently

### 🔌 Integrations

- Slack: incoming webhook POST with plain text formatting and user mentions
- Microsoft Teams: incoming webhook POST with Adaptive Card format and at-mentions
- Jira: REST API v3 worklog creation with Basic auth, wall-clock to UTC time conversion, and retry logic
- Deepgram: pre-recorded audio transcription (WebM upload) with smart formatting and punctuation

### 🗃️ Database

- SQLite database with Prisma ORM (5 models: Update, WorkLogEntry, PlatformConfig, RepeatEntry, AppSettings)
- All API keys stored in AppSettings table with no environment variable fallbacks
- Cascade delete from Update to WorkLogEntry
- Hardcoded DATABASE_URL fallback in Prisma client, eliminating .env dependency
- Seed script for default platform configs and app settings

### 🔧 Configuration

- Next.js 16 with App Router and React 19
- TypeScript strict mode with Tailwind CSS 4 and shadcn/ui components
- ESLint configuration covering source and Electron build directories
- VS Code and IntelliJ launch configurations for Next.js dev server and Prisma commands
- Data source configuration files for local development

### 📝 Documentation

- Comprehensive README with project overview, architecture, and setup instructions
- CLAUDE.md with full codebase guidance, API routes, data models, and design system reference
- Release manager documentation and process
