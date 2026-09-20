# Bulk Rename Conversations

## Purpose

The **Bulk Rename Conversations** feature changes the titles of live ChatGPT conversations without altering their conversation identifiers, messages or Project membership.

It is intended for controlled clean-up and standardisation of conversation names using the same Project, date and text-search concepts already used elsewhere in ChatGPT Exporter.

## Prerequisites

- Run ChatGPT Exporter while signed in to ChatGPT.
- Use live ChatGPT conversation data. Official export files are read-only and are not supported for rename operations.
- The relevant conversations must be visible to the current ChatGPT account/workspace.

## Usage

Open the ChatGPT Exporter menu and choose **Bulk Rename Conversations**.

1. Narrow the conversation list using **Project**, **Date** and **Search** filters.
2. For normal transformations, select one or more conversations. **Select all visible** applies only to the currently filtered list.
3. Choose a rename transformation:
   - **Prefix** — add text before the existing title.
   - **Suffix** — add text after the existing title.
   - **Find / Replace** — replace all matching text in the existing title. Matching can be case-sensitive or case-insensitive.
   - **lowercase** — convert the full title to lowercase.
   - **UPPERCASE** — convert the full title to uppercase.
   - **Proper Case** — lowercase the title and capitalise word starts.
   - **Status capitalisation** — normalise a recognised leading workflow status to the canonical uppercase vocabulary without changing the subject.
   - **Exact mapping manifest** — apply explicit per-conversation mappings by conversation identifier.
4. Review the mandatory preview showing the current title, proposed title and status.
5. Choose **Apply** and confirm the batch.

Leaving **Replace with** blank removes the matching text. Find / Replace treats both the find text and replacement text literally; it does not interpret regular expressions or replacement tokens.

### Status capitalisation

Status capitalisation recognises these values case-insensitively at the start of a title, or immediately after an existing `Branch · ` prefix:

- `ACTIVE`
- `TO DO`
- `WAITING`
- `ON HOLD`
- `COMPLETE`
- `RETIRED`
- `NO`
- `REJECTED`

The legacy spelling `TODO` is normalised to `TO DO`. Titles without a recognised leading status are left unchanged. Subject capitalisation is not changed.

### Proper Case warning

Proper Case is intentionally literal. It can change product names and acronyms, for example `ChatGPT` to `Chatgpt` or `PowerShell` to `Powershell`. Use the preview to confirm the result before applying it.

## Exact mapping manifest

Exact mapping mode accepts a JSON array. Project selection controls which conversations are loaded for resolution; Date and Search filters only change the displayed list:

```json
[
  {
    "id": "conversation-id",
    "expectedTitle": "Current title",
    "newTitle": "Proposed title"
  }
]
```

The conversation identifier is the stable control key. `expectedTitle` is an optimistic concurrency check: the rename is invalid if the loaded title has changed since the manifest was prepared.

If the current title already equals `newTitle`, the entry is treated as valid and unchanged. This makes a partially completed manifest safe to retry without rewriting successful entries.

A manifest is blocked if it contains invalid JSON, duplicate identifiers, blank identifiers or empty proposed titles. A resolved entry is also invalid if its conversation is not loaded in the current scope or the current title differs from both `expectedTitle` and `newTitle`.

## Safety and failure handling

- Normal transformations operate only on selected conversations.
- Exact mapping mode operates only on manifest entries resolved by conversation identifier.
- Unchanged titles are skipped and are not written back to ChatGPT.
- A batch containing an invalid result is blocked.
- Rename requests use the existing rate-limit-aware request queue.
- Successful responses update the in-memory conversation list immediately.
- One failed request does not abort unrelated rename requests.\n- In normal transformation modes, failed conversations remain selected for review or retry.
- The completion summary reports renamed, unchanged, invalid and failed counts.
- The dialog cannot be closed while a rename batch is in progress.

## Examples

| Operation | Input | Existing title | Proposed title |
|---|---|---|---|
| Prefix | `COMPLETE - ` | `Project Audit` | `COMPLETE - Project Audit` |
| Suffix | ` - ARCHIVE` | `Project Audit` | `Project Audit - ARCHIVE` |
| Find / Replace | `TODO` → `ACTIVE` | `TODO - Project Audit` | `ACTIVE - Project Audit` |
| lowercase | — | `Project Audit` | `project audit` |
| UPPERCASE | — | `Project Audit` | `PROJECT AUDIT` |
| Proper Case | — | `PROJECT audit` | `Project Audit` |
| Status capitalisation | — | `todo - Project Audit` | `TO DO - Project Audit` |

## Limitations

Conversation rename is performed through ChatGPT's internal web conversation endpoint. That endpoint is not a documented public interface and can change independently of this project. A non-successful or unconfirmed response is therefore treated as a failed rename rather than assumed to have succeeded.

The feature does not currently provide:

- regular-expression replacement;
- semantic or automatic title generation;
- Project renaming;
- transaction-style rollback of an already successful rename batch;
- rename operations against an offline `conversations.json` export.

## Validation

The repository includes deterministic fixture coverage for Prefix, Suffix, Find / Replace, lowercase, uppercase, Proper Case, canonical status normalisation and exact manifest parsing/resolution.

Repository-level validation remains the standard development sequence:

```powershell
corepack prepare pnpm@8.14.1 --activate
pnpm --version
pnpm install --frozen-lockfile
pnpm run lint
pnpm run test
pnpm run build
```
