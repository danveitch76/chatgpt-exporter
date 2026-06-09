# Phase 1.5 — Uploaded Asset Validation

## Issue

#43 — Uploaded asset validation

## Purpose

Validate whether real uploaded assets are discoverable with enough metadata to support later recovery through #5 File Download Resolver.

## Scope

Uploaded asset types to validate:

| Asset Type | Required | Status |
|---|---:|---|
| Uploaded image | Yes | Pending |
| Uploaded PDF | Yes | Pending |
| Uploaded ZIP | If available | Pending |
| Uploaded Word document | If available | Pending |
| Uploaded spreadsheet | If available | Pending |

## Method

For each uploaded asset type:

1. Identify a real ChatGPT conversation containing the uploaded asset.
2. Run File Discovery against the conversation or a small selected set.
3. Inspect the generated `.file-discovery.json`.
4. Record whether the asset is detected.
5. Record the source field and metadata captured.
6. Decide whether the metadata appears recoverable.

## Evidence Table

| Asset Type | Conversation Title | Conversation ID | Message ID | Discovered | Source Type | Source Field | Metadata Found | Recoverable Candidate | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Uploaded image | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Uploaded PDF | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Uploaded ZIP | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Uploaded Word document | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |
| Uploaded spreadsheet | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO | TODO |

## Metadata Signals

Classify each discovered reference.

| Signal | Meaning |
|---|---|
| `file_id` | Strong recovery candidate |
| `asset_pointer` | Possible recovery candidate |
| `sediment://...` | Possible internal asset pointer |
| `sandbox:/mnt/data/...` | Metadata-only unless downloadable route exists |
| `download_url` | Strong recovery candidate |
| `conversation_id + message_id` | Possible resolver input |
| Filename only | Weak recovery candidate |

## Pass Criteria

This validation passes if:

- At least one uploaded asset is detected.
- The source field is recorded.
- The available metadata is documented.
- Any missing patterns are captured as follow-up issues.

## Fail Criteria

This validation fails if:

- Uploaded assets are not detected at all.
- Discovery output lacks enough metadata to distinguish uploaded assets from generated assets.
- Recovery cannot be assessed due to missing identifiers.

## Decision

| Question | Answer |
|---|---|
| Do uploaded assets appear in discovery output? | TODO |
| Is at least one uploaded asset a recovery candidate? | TODO |
| Is #5 ready to proceed for uploaded assets? | TODO |
| Are follow-up scanner changes required? | TODO |

## Follow-up Issues

| Finding | Issue |
|---|---|
| TODO | TODO |
