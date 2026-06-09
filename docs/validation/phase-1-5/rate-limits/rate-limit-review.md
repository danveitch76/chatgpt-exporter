# Phase 1.5 — Rate-Limit-Aware Discovery Review

## Issue

#50 — Add rate-limit-aware discovery execution

## Purpose

Review whether rate-limit handling is absent, incomplete, or already implemented.

## Finding

Existing implementation evidence has been collected from:

- src/api.ts
- src/utils/queue.ts
- src/ui/ExportDialog.tsx

## Evidence File

See:

- ate-limit-existing-implementation-evidence.json

## Decision Required

After reviewing the evidence, decide whether #50 requires:

1. new product code,
2. validation-only documentation,
3. queue behaviour tests,
4. user-facing progress messaging,
5. no change because behaviour already exists.

## Current Hypothesis

Prior inspection suggested the code may already detect 429 responses, honour Retry-After, pause the queue, requeue work, and preserve completed batch results.

This branch captures evidence before changing behaviour.
