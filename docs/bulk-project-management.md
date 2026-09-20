# Bulk Project Management

## Purpose

**Bulk Project Management** applies an already-approved JSON manifest to live ChatGPT data. It deliberately does not decide where conversations belong and does not generate Project names.

The feature supports two controlled operations:

1. move or assign conversations to an existing ChatGPT Project;
2. rename existing ChatGPT Projects.

Both operations use stable identifiers, expected-current-state checks, mandatory preview and read-back verification.

## Prerequisites

- Run ChatGPT Exporter while signed in to ChatGPT.
- Use live ChatGPT data. Official `conversations.json` files are read-only and cannot be used for writes.
- Destination Projects must already exist and be visible to the current account/workspace.
- Increase the existing Export All conversation limit if a manifest references conversations outside the loaded discovery scope. The default limit is 1,000.

## Conversation Project mapping

Choose **Bulk Project Management**, select **Move conversations to Projects**, then provide a JSON array:

```json
[
  {
    "id": "<conversation-id>",
    "expectedProjectId": null,
    "newProjectId": "g-p-..."
  },
  {
    "id": "<conversation-id>",
    "expectedProjectId": "g-p-current",
    "newProjectId": "g-p-destination"
  }
]
```

`expectedProjectId` is `null` only when the conversation is not currently in a Project. `newProjectId` must identify an existing loaded Project.

The current increment supports assignment to a Project and moves between Projects. **Removing a conversation from a Project is not supported** because the current removal payload has not been independently verified.

Conversations attached to a non-Project gizmo, including custom-GPT conversations, are rejected rather than silently detached from that context.

## Project rename mapping

Choose **Rename Projects**, then provide:

```json
[
  {
    "id": "g-p-...",
    "expectedName": "Current Project Name",
    "newName": "New Project Name"
  }
]
```

The stable Project identifier is used for resolution. `expectedName` acts as an optimistic concurrency check so a stale manifest cannot overwrite an unexpected later rename.

## Preview and execution

Before any write:

1. Projects are loaded from ChatGPT.
2. Conversation Project mapping also loads the available conversation scope.
3. Every manifest entry is resolved by identifier.
4. Destination Projects and expected current state are validated.
5. The dialog shows current value, proposed value and validation status.
6. The batch is blocked if any entry is invalid.
7. The user must explicitly confirm the previewed write batch.

During execution the existing rate-limit-aware request queue is reused. A failed item does not abort unrelated entries.

After each individual write, ChatGPT is read again. Local state is updated only when the new Project membership or Project name is confirmed by read-back.

## Idempotency and stale-state handling

Safe reruns are intentional:

- if a conversation is already in `newProjectId`, the entry is unchanged rather than rewritten;
- if a Project already has `newName`, the entry is unchanged;
- if the current conversation Project does not equal `expectedProjectId`, the entry is invalid;
- if the current Project name does not equal `expectedName`, the entry is invalid;
- duplicate identifiers, unknown Projects, missing conversations and blank target names are rejected.

The write functions repeat the expected-state check immediately before mutation, so a change occurring after preview fails closed unless the target state has already been reached.

## Endpoint boundary

ChatGPT does not provide a documented public API for these operations. This feature therefore uses the current ChatGPT web endpoints observed by the project:

- conversation Project move: `PATCH /backend-api/conversation/{id}` with `gizmo_id`;
- Project update: `PATCH /backend-api/projects/{id}` while preserving the required `emoji`, `theme` and `instructions` fields from current Project state.

These interfaces can change independently of ChatGPT Exporter. Unexpected responses are treated as failures, and successful HTTP status alone is not accepted as proof of success.

## Post-write verification

After a material batch, use **Export Project / Chat Lists** to produce a fresh inventory and compare it with the approved manifest. Conversation identifiers and Project identifiers should remain stable; only the approved Project membership or display name should change.

## Limitations

The feature does not currently provide:

- automatic conversation classification;
- automatic Project-name generation;
- Project creation or deletion;
- removal of conversations from Projects;
- mutation of offline export files;
- transaction-style rollback of already successful writes;
- guarantees that undocumented ChatGPT web endpoints will remain stable.

## Validation

Deterministic fixture coverage is included for manifest parsing and preview validation, including assignment, Project-to-Project movement, stale state, unknown Projects, duplicate identifiers, idempotent target state, custom-GPT protection and Project rename validation.

Repository-level validation remains:

```powershell
corepack prepare pnpm@8.14.1 --activate
pnpm --version
pnpm install --frozen-lockfile
pnpm run lint
pnpm run test
pnpm run build
git diff --exit-code -- dist/chatgpt.user.js
```

Because the endpoints are undocumented, a live-account smoke test with disposable/non-critical conversations and Projects is also required before merge or release.
