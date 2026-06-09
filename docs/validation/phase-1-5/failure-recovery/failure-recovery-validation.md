# Phase 1.5 — Failure Recovery Validation

## Issue

#45 — Failure recovery validation

## Purpose

Validate how the file discovery and asset recovery path should behave when discovery or recovery encounters partial failures.

## Scope

This validation covers expected behaviour for:

- missing asset metadata
- malformed inventory rows
- unsupported asset references
- rate-limited requests
- oversized assets
- interrupted export runs
- non-file references misclassified as assets
- browser-safe continuation after partial failure

## Current Baseline

The project currently has:

- defensive file discovery scanning
- runtime fixture validation
- export limit planning
- uploaded asset validation evidence
- generated asset classification
- generated asset validation evidence

## Failure Scenarios

| Scenario | Expected Behaviour | Current Status | Evidence |
|---|---|---|---|
| Missing optional field | Do not crash; classify as unknown or metadata-only | Pending | Pending |
| Missing asset pointer | Do not crash; classify using source field/raw value | Pending | Pending |
| Malformed generated row | Do not crash; preserve row as unknown metadata | Pending | Pending |
| Uploaded false positive | Do not recover as file; flag classification issue | Observed | Uploaded validation |
| Generated false positive | Do not recover as file; classify as conversation/citation/search output | Observed | Generated validation |
| Oversized asset | Mark oversized or split according to limits | Pending | Export limits |
| Rate limit | Pause/resume according to queue behaviour | Pending | #50 |
| Interrupted run | Preserve completed work where possible | Pending | #35 |

## Initial Decision

Failure recovery should be treated as a validation and behaviour-definition step before full resolver implementation.

## Acceptance

This validation passes when:

- at least one malformed generated row is safely classified
- at least one missing-property row is safely handled
- false-positive uploaded/generated rows are not treated as recoverable files
- the expected behaviour for rate limits and interrupted runs is explicitly deferred to #50 and #35
- no new product code is added without corresponding runtime validation
