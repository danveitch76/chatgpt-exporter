# `chatgpt-multimodal-exporter` assessment

Assessment date: 14 September 2026

External project: [`ha0xin/chatgpt-multimodal-exporter`](https://github.com/ha0xin/chatgpt-multimodal-exporter)

## Decision

**INTEGRATE selected discovery techniques only. Do not adopt the external userscript or add it as a dependency.**

The external project remains useful as a reference because it recognises current ChatGPT multimodal file-reference patterns that were not fully covered by this repository's File Discovery scanner. The relevant bounded patterns are:

- uploaded-file identifiers beginning with `file_` as well as backend identifiers beginning with `file-`;
- file identifiers embedded in `sediment://` asset pointers;
- inline `{{file:...}}` placeholders;
- explicit voice-audio, sandbox and attachment-reference discovery patterns.

This repository already has the preferred acquisition, filtering, discovery, classification, validation and resolver structure, so replacing it with the external architecture would add duplication and regression risk.

## Current external state inspected

At assessment time:

- default branch: `main`;
- latest inspected commit: `941436e1f8e57ee4b2a2b670090b64ac33af396d` dated 3 March 2026;
- package manifest version: `0.7.2`;
- latest published release: prerelease `v0.8.0-alpha.0`, published 4 January 2026;
- licence: MIT;
- runtime: Tampermonkey/Violentmonkey browser userscript;
- notable dependencies include Preact, fflate, marked and sonner;
- an open upstream issue reports incomplete export of very long conversations.

The mismatch between the package manifest and latest published prerelease, the reliance on undocumented ChatGPT backend routes, and the open long-conversation limitation make the project unsuitable as a direct dependency.

## Current ChatGPT product context

Current OpenAI documentation reduces the value of adopting the external project as a general-purpose file-downloader:

- ChatGPT Library now saves uploaded and created files and supports downloading one or more selected files;
- official conversation export still supplies `conversations.json` or numbered conversation JSON files for larger exports;
- OpenAI documents that eligible ChatGPT Edu exports can also include files and other assets used in conversations.

These mechanisms do not remove the need for File Discovery. Library is a separate file store and does not provide the deterministic conversation/message-to-attachment relationship required by this project's archive pipeline. OpenAI also does not document the browser-internal file identifiers and download routes as a stable public interface.

References:

- <https://help.openai.com/en/articles/20001052-file-storage-and-library>
- <https://help.openai.com/en/articles/9106926>
- <https://help.openai.com/en/articles/20001279-exporting-data-from-a-chatgpt-edu-workspace>

## Capability comparison and classification

| External capability | Classification | Rationale |
|---|---|---|
| `file_` uploaded-file identifier detection | **INTEGRATE** | Verified gap in current discovery; real-account validation previously found zero `fileId` rows. |
| Extract file identifier from `sediment://` pointers | **INTEGRATE** | Improves recoverable backend-asset classification without changing acquisition architecture. |
| `{{file:...}}` inline placeholder detection | **INTEGRATE** | Current generic scalar scanner did not recognise an identifier embedded inside text. |
| Voice-audio pointer discovery | **REFERENCE** | Current scanner already sees audio asset-pointer fields, but its source taxonomy does not yet distinguish audio from images. Address through existing discovery-hardening work rather than importing the external model. |
| Sandbox interpreter download route | **REFERENCE** | Potentially useful for live recovery, but it is an undocumented authenticated route and needs real-account validation under the existing resolver issue before integration. |
| Backend file download handling | **REFERENCE** | Confirms the route family already mapped by this repository and highlights different handling for `file-` and `file_`; live authenticated download validation remains tracked under issue #5. |
| Batch attachment ZIP model | **REFERENCE** | Useful implementation evidence, but this repository already has its own batching, memory-protection and resolver roadmap. |
| Auto-save through the File System Access API | **REJECT** | Separate product behaviour with additional state and browser-permission complexity; not required to close the verified discovery gap. |
| Credential interception by wrapping `fetch`/XMLHttpRequest and inspecting page state | **REJECT** | Expands security and maintenance risk and is unnecessary for the bounded discovery change. |
| External project as a runtime or source dependency | **REJECT** | Duplicates existing architecture and transfers maintenance risk without sufficient benefit. |

## Implemented bounded changes

The associated branch changes only File Discovery and its deterministic fixture coverage:

- recognise both `file-...` and `file_...` identifiers;
- derive a file identifier from direct `sediment://file-...` or `sediment://file_...` pointers when possible;
- recognise valid `{{file:...}}` placeholders embedded in message text;
- classify both identifier forms as recoverable backend assets;
- add synthetic fixture coverage for an uploaded `file_...` attachment and an inline file placeholder.

No external package or runtime service is added.

## Security and privacy

The integrated change is local parsing only. It does not:

- transmit conversation data to the external project;
- add telemetry;
- add a new external service;
- capture or persist access tokens;
- modify ChatGPT credentials or session handling;
- add a dependency.

The external live-download and credential-interception techniques remain reference material only until separately justified and validated.

## Follow-up status

Real-account File Discovery validation completed after the bounded integration and confirmed the discovery gap was closed:

- 11 inventory rows were produced;
- one genuine underscore-style `file_...` identifier was discovered;
- that identifier was classified as `recoverable_backend_asset`;
- attachment filename, MIME type and size metadata were populated;
- citation/search rows were not misclassified as recoverable assets.

Issue #63 was closed as completed on 20 September 2026 after that validation. Issue #5 remains open for live authenticated download/resolver work.

Voice-audio taxonomy remains a possible separate hardening item because the scanner can observe audio asset pointers while the current source taxonomy does not yet distinguish them from images.
