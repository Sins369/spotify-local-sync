# Bulk Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add bulk download to the Sync page — select multiple/all missing tracks and auto-search + download from Soulseek with a pipeline architecture.

**Architecture:** New `bulk-downloader.ts` module runs a search→pick→queue pipeline in the background, emitting events via eventBus. Three new API routes (start, progress SSE, cancel). Sync page gets a bulk action bar with checkboxes, batch size, and progress indicator.

**Tech Stack:** Next.js 16 API routes, EventEmitter (eventBus), SSE, better-sqlite3, existing slsk-client + download worker.

---

## Task 1: Bulk Downloader Module (`src/lib/bulk-downloader.ts`)
## Task 2: API Routes (bulk-download, bulk-progress, bulk-cancel)
## Task 3: Sync Page UI — Bulk Action Bar + Checkboxes
## Task 4: Integration Test + Push

See full task details in the plan body — each task has exact file paths, code, and commands.
