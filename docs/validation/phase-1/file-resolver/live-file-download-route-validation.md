# Phase 1 — Live Backend File Resolution Validation

## Issue

#5 — Add file download resolver

## Purpose

Prove or disprove whether a genuine file reference discovered by the current ChatGPT Exporter can be resolved through the authenticated ChatGPT backend and fetched as the expected file bytes.

This is a validation boundary, not the full recovery engine.

## Current Verified State

Completed:

- embedded `data:` assets can be decoded into bytes;
- sandbox path references remain metadata-only;
- backend `fileId` values map to `/backend-api/files/download/:id?post_id=&inline=false`;
- current discovery recognises both `file_...` and `file-...` identifiers;
- real-account File Discovery has produced a genuine `file_...` uploaded-file identifier with filename, MIME type and size metadata;
- citation and search-result rows are excluded from recoverable backend assets.

Still unproven:

- the current authenticated backend route accepts that genuine `file_...` identifier;
- the response returns `status=success` and a signed download URL;
- the signed URL returns non-zero bytes;
- those bytes correspond to the expected discovered file;
- failure responses are safe and understandable.

## Scope of This Validation

Validate one known current uploaded-file reference first.

Do not broaden this step to:

- ZIP packaging;
- sandbox/interpreter file recovery;
- generated-file recovery;
- resume support;
- browser-memory changes;
- credential interception;
- Library cloning behaviour.

Those remain downstream or separate concerns.

## Validation Probe

Use:

`scripts/validation/Probe-ChatGPTFileDownloadRoute.browser.js`

The probe:

- accepts both `file_...` and `file-...` forms;
- calls the existing backend route with the current authenticated browser session;
- never prints the signed download URL;
- never prints the real file identifier;
- never prints the recovered filename;
- fetches the signed result into memory only;
- records HTTP and backend status;
- records MIME type and byte size;
- computes a SHA-256 digest of the recovered bytes;
- compares recovered metadata with expected values from File Discovery;
- produces an explicit acceptance-gate result.

## Required Input

Run File Discovery against a conversation containing a known uploaded file.

From the genuine `recoverable_backend_asset` row, populate:

```javascript
const INPUT = {
    fileId: 'file_REPLACE_ME',
    expectedFilename: null,
    expectedMimeType: null,
    expectedSizeBytes: null,
    expectedSha256: null,
}
```

For the acceptance gate, populate at least:

- `fileId`;
- `expectedFilename`;
- `expectedMimeType`;
- `expectedSizeBytes`.

`expectedSha256` is optional but provides stronger identity proof when an independently calculated source-file digest is available.

Do not commit the original file identifier, filename, signed URL or private file contents.

## Manual Validation Method

1. Install the userscript built from the validation branch.
2. Run File Discovery on the known conversation.
3. Confirm the selected row is classified as `recoverable_backend_asset`.
4. Populate the probe input from that row.
5. Open ChatGPT while authenticated.
6. Open the browser developer console.
7. Paste and run the probe.
8. Capture the redacted JSON result.
9. Record the result under this validation evidence without adding private identifiers or signed URLs.
10. If the acceptance gate passes, only then implement the smallest generic downloader integration under Issue #5.

## Acceptance Criteria

The live resolution boundary passes only when all of the following are demonstrated for a genuine current asset:

- backend route responds successfully;
- backend response reports `status=success`;
- a signed download URL is returned;
- the signed request succeeds;
- the returned file contains more than zero bytes;
- filename, MIME type and byte size match the File Discovery metadata, **or** an independently known SHA-256 digest matches;
- no credential, signed URL or private file contents are persisted in repository evidence.

The probe reports this as:

```text
acceptanceGatePassed: true
```

A successful HTTP response by itself is not sufficient.

## Evidence Levels

| Evidence level | Meaning |
|---|---|
| `failed` | Resolution or download did not complete. |
| `bytes_recovered_identity_unproven` | Bytes were returned but the expected asset identity was not proven. |
| `expected_asset_metadata_matched` | Bytes were returned and filename, MIME type and size matched File Discovery metadata. |
| `expected_asset_hash_matched` | Bytes were returned and an independently supplied SHA-256 digest matched. |

## Failure Interpretation

| Outcome | Interpretation |
|---|---|
| HTTP 401/403 | Authentication, entitlement or account-context problem. |
| HTTP 404 | Identifier, route or asset class is not available through this route. |
| HTTP 429 | Rate limited; retry after the indicated period. |
| Backend `status=error` | Record the error code/message without inventing a workaround. |
| No signed URL | Route response is insufficient for byte recovery. |
| Signed download failure | Resolver route worked but byte retrieval did not. |
| Zero bytes | Download is invalid. |
| Metadata mismatch | Bytes were returned but cannot be accepted as the expected asset. |

## Decision Gate

Issue #5 remains open until this live boundary is proven or the platform limitation is demonstrated with credible evidence.

Do not implement the generic backend downloader merely because:

- a file identifier exists;
- the route string can be constructed;
- an HTTP 200 is returned;
- a signed URL exists.

The required proof is successful recovery of the expected file bytes.

## Security and Privacy

This validation must not:

- persist authentication tokens;
- print or commit signed download URLs;
- commit real file identifiers or filenames;
- upload recovered content to an external service;
- introduce telemetry;
- add a third-party dependency.

The probe uses only the authenticated ChatGPT browser session and local browser processing.
