# Phase 1 — Discovery Refinement Validation

## Issue

#63 — Refine discovery to identify recoverable file assets

## Purpose

Separate recoverable file assets from citations, search result URLs, sandbox references, conversation content and terminal output.

## Implemented Classification

| Asset Class | Meaning | Recoverable |
|---|---|---|
| recoverable_embedded_asset | data URI payloads such as embedded images | yes |
| recoverable_backend_asset | file-* or /files/download references | yes |
| metadata_only_sandbox_reference | sandbox:/mnt/data or /mnt/data path references | no |
| citation_url | citation metadata or content reference URL | no |
| search_result_url | search result or aggregate web metadata | no |
| conversation_content | normal assistant/user message content | no |
| terminal_or_execution_text | terminal output, tracebacks or execution logs | no |
| unknown_metadata | retained metadata that does not fit a known class | no |

## Expected Impact

Generated rows sourced from citations, search results and sandbox mentions should no longer be counted as pending downloadable generated assets.

Only recoverable embedded assets and backend asset references should remain pending.
