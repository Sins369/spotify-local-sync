# Download Queue Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace synchronous blocking downloads with an async queue that streams to disk with real byte-level progress tracking.

**Architecture:** Fire-and-forget queue API creates DB records. A singleton background worker processes downloads using slsk-client's `downloadStream()` method, streaming chunks to disk while tracking bytes received. An in-memory Map holds active progress. The queue API merges this with DB records for the frontend.

**Tech Stack:** slsk-client (downloadStream), better-sqlite3, Next.js API routes, React polling

**Spec:** `docs/superpowers/specs/2026-05-31-download-queue-redesign.md`

---

## 10 Tasks — see full plan in conversation context

Tasks 1-10 cover: DB migration, streaming download, background worker, fire-and-forget API, progress merge, cancel API, sync page metadata, downloads page UI, settings, and final build+test.
