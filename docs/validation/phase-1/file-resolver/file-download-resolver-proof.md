# Phase 1 — File Download Resolver Proof

## Issue

#5 — Add file download resolver

## Purpose

Create the first resolver proof for inventory rows.

## Scope

This is not the full recovery engine.

This proof validates:

- embedded `data:*;base64,...` rows can be decoded into bytes
- sandbox path rows remain metadata-only
- backend `file-*` identifiers can be mapped to the ChatGPT `/backend-api/files/download/:id` route shape
- malformed data URIs fail safely

## Current Resolver Capability

| Input Type | Status |
|---|---|
| uploaded embedded base64 data URI | resolved |
| sandbox path reference | metadata_only |
| backend file id | metadata_only with backend download path |
| malformed data URI | failed |

## Important Finding

The repository already contains the file download route shape in `api.ts`.

The resolver now maps `fileId` inventory rows to the same backend path shape without coupling the pure resolver to `api.ts`.

Route shape:

- `/backend-api/files/download/:id?post_id=&inline=false`

## Remaining Gap

Live backend file download validation has not yet been performed.

The next step is to call the generated path against a real `file-*` identifier and confirm whether the response returns a signed `download_url`.

## Decision

The first proven recovery class remains embedded base64 uploaded image data.

Backend file-id recovery is now route-mapped but not live-validated.
