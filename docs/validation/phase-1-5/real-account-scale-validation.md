# Phase 1.5 — Real Account Scale Validation

## Purpose

Validate file discovery against real ChatGPT accounts at increasing scale before Phase 2 asset recovery begins.

## Scope

Validation runs:

| Run | Conversation Target | Purpose |
|---:|---:|---|
| 1 | 100 | Smoke-scale validation |
| 2 | 500 | Medium account validation |
| 3 | 1,000 | Large account validation |

## Acceptance Criteria

- Browser does not crash.
- Discovery inventory is generated.
- Runtime is recorded.
- Memory behaviour is recorded where available.
- Any failure mode is captured as a follow-up GitHub issue.
- Results are documented before Phase 2 begins.

## Out of Scope

- Full asset download recovery.
- Semantic search.
- Personal archive platform work.
- SQLite catalogue.
- Knowledge graph.

## Method

For each scale target:

1. Open ChatGPT in the browser with the userscript installed.
2. Export discovery-only inventory for the target conversation count.
3. Save the generated discovery JSON.
4. Record browser, operating system and runtime observations.
5. Record inventory statistics.
6. Capture failures and create follow-up issues.

## Required Evidence

Each run must record:

- Target conversation count.
- Actual conversations scanned.
- Messages scanned.
- References found.
- Metadata-only count.
- Failed count.
- Skipped duplicate count.
- Runtime.
- Browser used.
- Browser version.
- Operating system.
- Whether the browser became unstable.
- Whether the inventory file was generated.
- Follow-up issues created.

## Stop Conditions

Stop the run immediately if:

- The browser becomes unresponsive.
- The tab crashes.
- The machine becomes unstable.
- The export appears to loop indefinitely.
- Browser memory growth is clearly uncontrolled.

## Follow-Up Issue Rules

Create a follow-up issue for each distinct failure mode.

Use labels:

- phase:1
- type:validation
- risk:high

If the issue is a defect rather than validation work, also add:

- type:technical-debt
