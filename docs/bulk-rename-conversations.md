# Bulk Rename Conversations

## Purpose

The **Bulk Rename Conversations** feature changes the titles of selected live ChatGPT conversations without altering their conversation identifiers, messages or Project membership.

It is intended for controlled clean-up and standardisation of conversation names using the same Project, date and text-search concepts already used elsewhere in ChatGPT Exporter.

## Prerequisites

- Run ChatGPT Exporter while signed in to ChatGPT.
- Use live ChatGPT conversation data. Official export files are read-only and are not supported for rename operations.
- The relevant conversations must be visible to the current ChatGPT account/workspace.

## Usage

Open the ChatGPT Exporter menu and choose **Bulk Rename Conversations**.

1. Narrow the conversation list using **Project**, **Date** and **Search** filters.
2. Select one or more conversations. **Select all visible** applies only to the currently filtered list.
3. Choose a rename transformation:
   - **Prefix** — add text before the existing title.
   - **Suffix** — add text after the existing title.
   - **Find / Replace** — replace all matching text in the existing title. Matching can be case-sensitive or case-insensitive.
4. Review the mandatory preview showing the current title, proposed title and status for every selected conversation.
5. Choose **Apply** and confirm the batch.

Leaving **Replace with** blank removes the matching text. Find / Replace treats both the find text and replacement text literally; it does not interpret regular expressions or replacement tokens.

## Safety and failure handling

- Only selected conversations are considered.
- Unchanged titles are skipped and are not written back to ChatGPT.
- A batch containing a title that would become empty or whitespace-only is blocked.
- Rename requests use the existing rate-limit-aware request queue.
- Successful responses update the in-memory conversation list immediately.
- Failed conversations remain selected so they can be reviewed or retried.
- The completion summary reports renamed, unchanged, invalid and failed counts.
- The dialog cannot be closed while a rename batch is in progress.

## Examples

| Operation | Input | Existing title | Proposed title |
|---|---|---|---|
| Prefix | `COMPLETE - ` | `Project Audit` | `COMPLETE - Project Audit` |
| Suffix | ` - ARCHIVE` | `Project Audit` | `Project Audit - ARCHIVE` |
| Find / Replace | `TODO` → `ACTIVE` | `TODO - Project Audit` | `ACTIVE - Project Audit` |
| Find / Replace | `COMPLETE - ` → blank | `COMPLETE - Project Audit` | `Project Audit` |

## Limitations

Conversation rename is performed through ChatGPT's internal web conversation endpoint. That endpoint is not a documented public interface and can change independently of this project. A non-successful or unconfirmed response is therefore treated as a failed rename rather than assumed to have succeeded.

The feature does not currently provide:

- regular-expression replacement;
- automatic title generation;
- Project renaming;
- transaction-style rollback of an already successful rename batch;
- rename operations against an offline `conversations.json` export.

## Validation

The repository includes deterministic fixture coverage for Prefix, Suffix and Find / Replace transformations, including case sensitivity, literal replacement text, removal, multiple matches and invalid empty results.

Repository-level validation remains the standard development sequence:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run lint
corepack pnpm run test
corepack pnpm run build
```
