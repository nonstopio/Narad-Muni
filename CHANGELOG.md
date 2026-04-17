# Changelog

All notable changes to Narada will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
