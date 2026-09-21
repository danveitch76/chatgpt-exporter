# Bulk Project Management

## Purpose

**Bulk Project Management** applies one already-approved, self-describing JSON manifest to live ChatGPT data. It deliberately does not decide where conversations belong and does not generate Project names.

A single manifest can contain any number and any mixture of:

- `moveConversation` — assign or move a conversation to an existing ChatGPT Project;
- `renameProject` — rename an existing ChatGPT Project.

All actions use stable identifiers, expected-current-state checks, mandatory preview and read-back verification.

## Prerequisites

- Run ChatGPT Exporter while signed in to ChatGPT.
- Use live ChatGPT data. Official `conversations.json` files are read-only and cannot be used for writes.
- Destination Projects must already exist and be visible to the current account/workspace.
- Increase the existing Export All conversation limit if a manifest references conversations outside the loaded general discovery scope. Project discovery can add conversations beyond that general-source limit.

## Manifest format

Choose **Bulk Project Management** and provide one JSON array. Each entry declares its own `action`.

Mixed bulk example:

```json
[
  {
    "action": "moveConversation",
    "id": "<conversation-id>",
    "expectedProjectId": null,
    "newProjectId": "g-p-destination"
  },
  {
    "action": "moveConversation",
    "id": "<conversation-id>",
    "expectedProjectId": "g-p-current",
    "newProjectId": "g-p-destination"
  },
  {
    "action": "renameProject",
    "id": "g-p-project",
    "expectedName": "Current Project Name",
    "newName": "New Project Name"
  }
]
```

The operation type is part of each manifest entry; there is no separate operation selector.

### `moveConversation`

`expectedProjectId` is `null` only when the conversation is not currently in a Project. `newProjectId` must identify an existing loaded Project.

The current increment supports assignment to a Project and direct moves between Projects. **Removing a conversation from a Project is not supported** because the current removal payload has not been independently verified.

Conversations attached to a non-Project gizmo, including custom-GPT conversations, are rejected rather than silently detached from that context.

### `renameProject`

The stable Project identifier is used for resolution. `expectedName` acts as an optimistic concurrency check so a stale manifest cannot overwrite an unexpected later rename.

## Preview and execution

Before any write:

1. Projects and the available conversation scope are loaded from ChatGPT.
2. Every manifest entry is parsed according to its `action`.
3. Identifiers, destination Projects and expected current state are validated.
4. The dialog shows Action, Item, Current, Proposed and Status columns.
5. The batch is blocked if any entry is invalid.
6. The Apply button reports the number of previewed changes.
7. The user must explicitly confirm the previewed write batch.

The status line distinguishes the total conversations loaded across general and Project sources from the configured general-source scan limit.

During execution the existing rate-limit-aware request queue is reused. A failed item does not abort unrelated entries. Mixed move and rename actions share the same controlled queue.

After each individual write, ChatGPT is read again. Local state is updated only when the new Project membership or Project name is confirmed by read-back.

## Idempotency and stale-state handling

Safe reruns are intentional:

- if a conversation is already in `newProjectId`, the entry is unchanged rather than rewritten;
- if a Project already has `newName`, the entry is unchanged;
- if the current conversation Project does not equal `expectedProjectId`, the entry is invalid;
- if the current Project name does not equal `expectedName`, the entry is invalid;
- duplicate identifiers, unknown actions, unknown Projects, missing conversations and blank target names are rejected.

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

Deterministic fixture coverage includes mixed manifests, multiple actions, assignment, Project-to-Project movement, stale state, unknown Projects, duplicate identifiers, unknown actions, idempotent target state, custom-GPT protection and Project rename validation.

Repository-level validation:

```powershell
corepack prepare pnpm@8.14.1 --activate
pnpm --version
pnpm install --frozen-lockfile
pnpm run lint
pnpm run test
pnpm run build
git diff --exit-code -- dist/chatgpt.user.js
```

Because the endpoints are undocumented, a live-account smoke test with disposable/non-critical conversations and Projects is required before merge or release.
