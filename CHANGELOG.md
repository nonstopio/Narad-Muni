# Changelog

All notable changes to Narada will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.1] - 2026-02-27

### 🐛 Bug Fixes

- Fix Error serialization in logger — errors were being serialized as `{}` instead of showing name, message, and stack trace. The `serialize()` function now properly extracts Error properties using `Object.getOwnPropertyNames()`
- Fix duplicate log lines in Electron — add a re-entrancy guard (`_logging` flag) to prevent monkey-patched console methods from logging the same line twice

## [1.6.0] - 2026-02-27

### ✨ Features

- Add keyboard shortcuts modal for inline viewing instead of navigating to settings
- Add Slack thread reply mode with default-on toggle and segmented control UI for switching between webhook and thread modes
- Add Test Thread Connection button for validating Slack thread reply configuration
- Add new database migrations and API endpoint (`/api/settings/test-slack-thread`) for thread mode support

### 💄 UI/UX

- Mark Slack Portal name fields as optional in placeholder text for clearer guidance

## [1.5.5] - 2026-02-26

### ✨ Features

- Add notification reminders, system tray integration, and hide-to-tray behavior on quit
- Add per-platform status awareness in publishing toasts and calendar indicators
- Redesign oracle toasts with MuniOrb animation and type-specific styling
- Introduce unified Button design system with semantic variants and consistent animations

### 🐛 Bug Fixes

- Resolve all ESLint errors across the codebase
- Fix keyboard shortcuts scroll behavior using poll instead of fixed timeout

## [1.5.4] - 2026-02-26

### ✨ Features

- Add comprehensive presentation guide for the Narad Muni tool
- Add team lead fields to platform config and enhance database initialization logging

### 🐛 Bug Fixes

- Resolve Jira ticket ID linkification in Slack/Teams messages

## [1.5.3] - 2026-02-25

### 🐛 Bug Fixes

- Fix report page icon mismatch by changing from LifeBuoy to Bug to match the sidebar navigation

### 🔧 Configuration

- Add branding metadata, DMG background image, and Open Graph meta tags for improved distribution and social sharing

## [1.5.2] - 2026-02-25

### ✨ Features

- Replace electron-updater with direct GitHub release download for more reliable update delivery on unsigned builds
- Persist draft text per date in SQLite so unsent updates survive page navigation and app restarts

### 💄 UI/UX

- Change report tab icon from LifeBuoy to Bug for clearer visual meaning

## [1.5.1] - 2026-02-24

### ✨ Features

- Update voice recording shortcut to Ctrl+R for Windows and Cmd+R for Mac for a more intuitive keybinding
- Add clear button in the issue reporter client for resetting form state

### 🐛 Bug Fixes

- Prevent default browser action when pressing keyboard shortcuts while in retry mode

## [1.5.0] - 2026-02-24

### 🐛 Bug Fixes

- Fix `quitAndInstall()` failing silently on unsigned macOS builds by showing a manual update dialog with "Open Download Page" and "Show in Finder" fallback options (fixes [#4](https://github.com/AjayKumar4/Narada/issues/4))
- Apply `setImmediate` workaround and proper try-catch for `quitAndInstall()` inside the update callback

### 🖥️ Electron

- Add full-screen blocking overlay during download and install phases to prevent user interaction with the app
- Track `isInstalling` state so error events during the install phase are properly caught and surfaced
- Extend the preload bridge with `onUpdateStatus` IPC listener for renderer-side update status communication

## [1.4.0] - 2026-02-24

### ✨ Features

- Add `R` keyboard shortcut for toggling voice recording on the update page
- Auto-start recording when navigating to the update page from other pages
- Handle edge cases for recording shortcut: missing Deepgram key, active transcription/processing, and retry mode
- Display recording shortcut in Sacred Gestures settings

## [1.3.2] - 2026-02-24

### 🐛 Bug Fixes

- Add explicit `artifactName` to mac, nsis, and linux sections in `electron-builder.yml` to eliminate spaces from artifact filenames, fixing 404 errors when the auto-updater attempts to download a new release (fixes [#3](https://github.com/ajaykumar/Narada/issues/3))

### 🖥️ Electron

- Surface download progress in the title bar with percentage and macOS dock progress bar instead of downloading silently in the background
- Show error dialogs when update downloads fail instead of swallowing errors silently
- Provide immediate visual feedback when the user clicks "Download" before the download stream begins
- Clean up title bar and progress bar state on download error or completion
- Track manual vs automatic update checks to show appropriate UI for each path

## [1.3.1] - 2026-02-24

### 🐛 Bug Fixes

- Handle migration errors gracefully when duplicate columns already exist in the database
- Adjust time reclaimed calculation for more accurate stats reporting

## [1.3.0] - 2026-02-23

### 🖥️ Electron

- Add auto-update functionality with support for automatic background updates and manual check option via the app menu
- Integrate `electron-updater` and configure `electron-builder.yml` publish settings for GitHub Releases
- Update GitHub Actions release workflow to publish platform artifacts for the updater

## [1.2.0] - 2026-02-23

### ✨ Features

- Add retry functionality for failed updates across all platforms (Slack, Teams, Jira)
- Add connection testing for Jira from the platform configuration card in Settings
- Implement automatic ticket linkification for Jira references in Slack and Teams messages
- Add connection testing for AI providers (Local Claude, Claude API, Gemini) from Settings

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
