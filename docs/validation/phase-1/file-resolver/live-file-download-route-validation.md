# Phase 1 — Live File Download Route Validation

## Issue

#5 — Add file download resolver

## Purpose

Validate whether real ChatGPT file identifiers can be resolved through the known backend file download route.

Route shape:

- /backend-api/files/download/:id?post_id=&inline=false

## Current State

Completed:

- embedded base64 data URI recovery
- metadata-only handling for sandbox paths
- backend route shape mapping for fileId

Remaining:

- live validation against a real file-* identifier
- confirmation that backend response returns status=success
- confirmation that response includes a signed download_url
- confirmation that the signed URL can be fetched as a Blob

## Manual Validation Method

Use:

- scripts/validation/Probe-ChatGPTFileDownloadRoute.browser.js

Paste the script into the browser console while authenticated in ChatGPT.

Set this line before running:

const FILE_ID = "file-REPLACE_ME"

## Expected Outcomes

| Outcome | Interpretation |
|---|---|
| HTTP 200 plus status=success plus download_url | backend file-id recovery is feasible |
| HTTP 403 | authentication/account context problem |
| HTTP 404 | wrong identifier or unsupported file class |
| HTTP 429 | rate limited; retry later |
| other error | record exact response |

## Decision Gate

Do not close #5 until a real file-* identifier has been tested or the limitation is documented with evidence.
