# Phase 1 — Discovery Schema Evidence

## Issue

#5 — Add file download resolver

## Finding

The current real-account discovery inventory does not contain `fileId` rows.

## Evidence

Inventory row count:

- 2,975 rows

Observed properties:

| Property | Rows |
|---|---:|
| assetPointer | 2,305 |
| rawUrl | 1,987 |
| rawPath | 848 |
| sizeBytes | 62 |
| fileId | 0 |

Generated asset candidate breakdown:

| Candidate Type | Count |
|---|---:|
| url | 1,987 |
| sandbox-path-mention | 675 |
| sandbox-path | 122 |
| unknown-or-conversation-content | 66 |
| execution-or-terminal-text | 5 |
| url-mention | 1 |

## Interpretation

The resolver is not currently blocked by route mapping.

The blocking issue is upstream discovery quality.

The scanner is producing many generated rows from citation URLs, search result URLs, sandbox path mentions and normal conversation content.

## Decision

Do not continue assuming `fileId` exists in the inventory.

Next work should refine discovery so it separates:

- recoverable embedded assets
- recoverable backend assets
- metadata-only sandbox references
- citations
- search result URLs
- conversation content
- terminal or execution text

## Impact on #5

Issue #5 remains open.

The next useful implementation is not broader download logic.

The next useful implementation is scanner refinement and recoverable asset classification.
