
# Phase 2 — Advanced ChatGPT Asset Recovery and Intelligence Layer

## Objective

Extend the File Extraction capability into a complete ChatGPT Digital Archive platform.

---

## Phase 2A — Automatic Conversation Classification

Automatically classify conversations into categories:

- Technology
- Job Search
- Personal Finance
- Home Lab
- LEGO
- AI Research
- Health
- Administration
- Other

Outputs:

- conversation-catalogue.csv
- conversation-catalogue.json

Metadata:

- conversation id
- title
- category
- project
- first message
- last message
- message count
- attachment count
- generated file count

---

## Phase 2B — Full Asset Recovery Engine

Expand scanning to recover:

- Uploaded files
- Generated files
- Images
- Audio
- Video
- Data analysis outputs
- Code interpreter artefacts
- Canvas exports
- Presentation files
- Spreadsheet files
- ZIP archives

Support all known ChatGPT asset reference types.

---

## Phase 2C — Incremental Export Engine

Avoid rescanning entire accounts.

Maintain:

incremental-state.json

Track:

- last scan date
- last conversation id
- exported assets
- modified conversations

Modes:

- Full Export
- Incremental Export
- Delta Export

---

## Phase 2D — Local SQLite Catalogue

Generate:

chatgpt-catalogue.db

Tables:

- conversations
- messages
- files
- downloads
- exports
- failures
- classifications

Benefits:

- Fast searching
- Historical tracking
- Offline access

---

## Phase 2E — Searchable File Index

Generate:

- searchable-index.json
- searchable-index.csv

Index:

- filename
- conversation
- category
- file type
- size
- date
- download status

Add local search capability.

---

## Phase 2F — Cross-Conversation Deduplication

Detect:

- Same file reused across conversations
- Same generated output referenced multiple times
- Duplicate image assets

Maintain:

duplicates.json

Store canonical source.

---

## Phase 2G — Advanced Export Formats

Support export of inventory and catalogue to:

- CSV
- JSON
- XLSX
- Parquet

Purpose:

- Power BI
- Fabric
- Python analytics
- Data warehousing

---

## Phase 2H — GitHub Actions Automation

Add CI/CD pipeline.

Workflow:

- Build userscript
- Run validation
- Create release package
- Generate release notes
- Publish GitHub Release

Artifacts:

- chatgpt.user.js
- release.zip
- changelog.md

---

## Phase 2I — Asset Health Analysis

Generate:

asset-health-report.json

Metrics:

- downloadable assets
- expired assets
- missing assets
- duplicate assets
- orphaned references

---

## Phase 2J — Recovery Dashboard

Create dashboard view showing:

- conversations scanned
- files recovered
- download success rate
- storage consumed
- duplicate savings
- category breakdown

---

## Phase 2 Success Criteria

Phase 2 is complete when:

- Assets can be recovered incrementally.
- SQLite catalogue is generated.
- Search index exists.
- Duplicate detection works.
- XLSX and Parquet exports work.
- GitHub Actions pipeline builds successfully.
- Dashboard displays archive metrics.
- Asset health reporting is available.
