# Phase 1 — File Download Resolver Proof

## Issue

#5 — Add file download resolver

## Purpose

Create the first resolver proof for inventory rows.

## Scope

This is not the full recovery engine.

This proof validates:

- embedded `data:*;base64,...` rows can be decoded into bytes
- sandbox path rows remain metadata-only
- backend `file-*` identifiers are explicitly unsupported for now
- malformed data URIs fail safely

## Current Resolver Capability

| Input Type | Status |
|---|---|
| uploaded embedded base64 data URI | resolved |
| sandbox path reference | metadata_only |
| backend file id | unsupported |
| malformed data URI | failed |

## Decision

The first proven recovery class is embedded base64 uploaded image data.

Backend file-id recovery remains future work.
