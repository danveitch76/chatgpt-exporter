# Changelog

## 2.33.5 (2026-08-25)

### Bug Fixes

* fix **All conversations** discovery so the normal ChatGPT conversation feed is combined with every discovered Project feed
* deduplicate conversations by conversation identifier when the same conversation appears in more than one source
* wait for Project discovery before starting the All-conversations load, avoiding the previous clear-and-reload behaviour
* preserve the existing **Not in a project** and specific-Project scopes

### Validation

* add regression coverage for aggregate conversation discovery and deduplication
* make the conversation-discovery regression fixture safe to run under Node.js as part of the repository test suite

### Release status

* repository package metadata and the generated userscript were advanced to `2.33.5`
* no matching downstream GitHub Release or `userscript-v2.33.5` tag currently exists in this repository; this entry records the verified repository version without manufacturing historical release metadata

## [2.33.4](https://github.com/danveitch76/chatgpt-exporter/compare/userscript-v2.33.3...userscript-v2.33.4) (2026-08-10)

### Features

* add **Not in a project** to the project selector to load conversations that are not assigned to any ChatGPT Project
* retain custom GPT conversations unless their gizmo identifier matches a known Project
* support incremental loading for the non-project conversation scope


## [2.33.3](https://github.com/danveitch76/chatgpt-exporter/compare/userscript-v2.33.2...userscript-v2.33.3) (2026-07-12)

### Features

* add `scripts/maintainer/Maintain-ChatGPT-Exporter.ps1` for governed downstream synchronisation
* add upstream commit assessment, classification, recommendation and equivalent-commit detection
* add interactive and recommendation-based upstream commit selection
* change the default **Export All** format to **JSON (ZIP)**

### Maintenance

* add automated dependency installation, lint, test and production-build validation
* add generated userscript version and namespace verification
* add automated maintenance branch, push and pull-request workflow
* add full maintainer, contribution, release and roadmap documentation

## [2.33.2](https://github.com/danveitch76/chatgpt-exporter/compare/userscript-v2.33.0...userscript-v2.33.2) (2026-07-12)

### Bug Fixes

* fix export progress so the denominator reflects the actual number of selected conversations rather than the internal batch size
* export answer source lists (upstream) ([5b56f35](https://github.com/pionxzh/chatgpt-exporter/commit/5b56f354c7fa49d814928cbd0b4f1d48b9ec21e2)), closes [#361](https://github.com/pionxzh/chatgpt-exporter/issues/361)
* improve the exporter user interface when the ChatGPT sidebar is collapsed (upstream) ([6b36cbb](https://github.com/pionxzh/chatgpt-exporter/commit/6b36cbb90ae8117647e74cea49356054ec835a6e))
* retire access to `__NEXT_DATA__` and `__remixContext` to maintain compatibility with recent ChatGPT changes (upstream) ([f5ef7fe](https://github.com/pionxzh/chatgpt-exporter/commit/f5ef7fe30152dc92ffd4c119a954f8e900dd9e97)), closes [#362](https://github.com/pionxzh/chatgpt-exporter/issues/362)

### Maintenance

* update the downstream package and userscript version to 2.33.2
* rebuild the generated userscript from the merged source

> Version 2.33.1 existed as an intermediate locally patched userscript but was not published as a repository release. Its progress-counter correction is recorded in 2.33.2.

## [2.33.0](https://github.com/danveitch76/chatgpt-exporter/compare/userscript-v2.32.2...userscript-v2.33.0) (2026-06-08)

### Features

* add File Discovery export mode for metadata-only file and asset inventory generation
* add defensive scanning for uploaded files, generated files, image assets, sandbox paths and asset pointers
* add inventory construction with deduplication, classification and extraction statistics
* wire File Discovery into the **Export All** dialog

### Notes

* File Discovery exports a structured inventory and does not yet perform end-to-end bulk file download.
* Resolver, classification and archive-planning capabilities are present in source and validation fixtures, but full live download and ZIP extraction remain Phase 1 follow-on work.

## [2.32.2](https://github.com/pionxzh/chatgpt-exporter/compare/userscript-v2.32.1...userscript-v2.32.2) (2026-05-28)


### Bug Fixes

* drop oaifree.com support and update description ([c3e2d11](https://github.com/pionxzh/chatgpt-exporter/commit/c3e2d11c963b5222cfd71d5adf29f5d4534cb5e2))
* improve batch export dialog mobile responsiveness ([25339e6](https://github.com/pionxzh/chatgpt-exporter/commit/25339e67b4b2ffea1246378e50d43f153c8ab97d))
* improve menu popup and select styling ([73f91a2](https://github.com/pionxzh/chatgpt-exporter/commit/73f91a2a728ed36023fdc11f7374176429ea45d9)), closes [#357](https://github.com/pionxzh/chatgpt-exporter/issues/357)

## [2.32.1](https://github.com/pionxzh/chatgpt-exporter/compare/userscript-v2.32.0...userscript-v2.32.1) (2026-05-12)


### Bug Fixes

* add scrolling to settings dialog ([a106e8b](https://github.com/pionxzh/chatgpt-exporter/commit/a106e8bac27d654f2c49bbc1ddfbbabcb64))

## [2.32.0](https://github.com/pionxzh/chatgpt-exporter/compare/userscript-v2.31.0...userscript-v2.32.0) (2026-05-10)

### Features

* add optional export of thinking/reasoning process ([4df6676](https://github.com/pionxzh/chatgpt-exporter/commit/4df6676826591e7770d6d121c77f1214f19178eb))
* restore project filter in export dialog and improve layout ([e03f32b](https://github.com/pionxzh/chatgpt-exporter/commit/e03f32b2a26c9c75df5b07014d1d818be3102f79))

### Bug Fixes

* improve the UI and missing bg ([8460531](https://github.com/pionxzh/chatgpt-exporter/commit/84605316a95da5f5d9d6b3a8027e591aa65c05a4))
* preserve citations and content references when merging continuation nodes ([5cd8986](https://github.com/pionxzh/chatgpt-exporter/commit/5cd8986e42cb69c7b346d9c4dcf5864d1ac432f4))

> Historical changelog entries before 2.32.0 remain available in repository history. This documentation correction intentionally preserves the current maintained downstream history from 2.32.0 onward while backfilling the missing 2.33.5 record.