# Phase 1.5 — Generated Asset Validation

## Issue

#44 — Generated asset validation

## Purpose

Validate whether generated asset inventory entries represent real recoverable generated files, generated images, sandbox artefacts, or non-file generated content.

## Finding Summary

Initial validation found that the `generated` source type is currently too broad.

The discovery inventory reported a large number of generated entries, but source-field analysis shows that many are not generated files. They include:

- Conversation text
- Citation URLs
- Search result URLs
- Code blocks
- Jupyter output text
- Assistant response content
- Sandbox path mentions
- Command output text

This means the current generated asset count is misleading if interpreted as a count of recoverable generated files.

## Validation Counts

To be populated from generated asset summary evidence.

## Current Interpretation

Generated inventory entries should be split into more precise classes before implementing full recovery logic.

Recommended classes:

| Class | Meaning |
|---|---|
| Generated file | A likely downloadable generated file |
| Generated image | A generated image asset or image result |
| Sandbox path mention | Text mentioning `/mnt/data/...` |
| Code output | Python, shell or notebook output |
| Citation URL | Web citation or cited source |
| Search result URL | Search result reference |
| Conversation content | Normal assistant/user text |
| Unknown metadata | Anything not yet classified |

## Decision

Do not proceed directly to generated asset recovery until classification is refined.

## Outcome

| Question | Answer |
|---|---|
| Are all `generated` entries actual generated files? | No |
| Is generated recovery ready to implement? | No |
| Is scanner classification refinement required? | Yes |
| Should this block #5 entirely? | No — uploaded image recovery can still proceed |
| Should this block generated recovery? | Yes |

## Follow-up

Create a scanner refinement issue so generated inventory entries distinguish recoverable assets from non-file references.
