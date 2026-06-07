# ChatGPT Exporter — File Extraction Capability Prompt Pack (Enhanced)

## Additional Enhancements Added

### Chunk 2A — Discovery Mode

Add a separate export mode before any downloading occurs:

```text
Files: Discovery Only
```

Outputs:

- inventory.csv
- inventory.json
- summary.json

No file downloads performed.

Benefits:

- Fast validation
- Safe execution
- Identifies hidden file reference structures
- Useful for large accounts

---

### Chunk 5A — Browser Memory Protection

Add support for:

```typescript
maxZipSizeMB?: number
maxFilesPerRun?: number
splitArchives?: boolean
```

When limits are exceeded:

```text
chatgpt-files-export-part01.zip
chatgpt-files-export-part02.zip
chatgpt-files-export-part03.zip
```

---

### Chunk 5B — Resume Capability

Create:

```text
resume-export.json
```

Structure:

```json
{
  "lastConversationId": "",
  "lastMessageId": "",
  "processedFiles": []
}
```

Purpose:

- Recover from browser crashes
- Continue long-running exports
- Avoid rescanning completed work

---

### Chunk 6A — File Explorer Preview

Before export show:

```text
Files
├── Uploaded
├── Generated
├── Images
├── Unknown
└── Failed
```

Display:

- File counts
- Estimated size
- Downloadability assessment
- Duplicate counts

---

### Chunk 6B — Export Scope Controls

Allow:

```text
Current Conversation
Selected Conversations
Current Project
All Conversations
```

This reduces risk when testing.

---

### Chunk 8A — Performance Validation

Validate against:

| Dataset Size | Target |
|-------------|---------|
| 100 conversations | Pass |
| 1,000 conversations | Pass |
| 10,000 conversations | Graceful degradation |
| No files present | ZIP still generated |
| Expired downloads | Inventory retained |

---

## Revised Recommended Execution Order

1. Chunk 1 — Types
2. Chunk 2 — Scanner
3. Chunk 2A — Discovery Mode
4. Chunk 4 — Inventory Builder
5. Chunk 7 — Fixture Validation
6. Chunk 3 — Download Resolver
7. Chunk 5 — ZIP Exporter
8. Chunk 5A — Memory Protection
9. Chunk 5B — Resume Capability
10. Chunk 6 — UI Integration
11. Chunk 6A — Explorer Preview
12. Chunk 6B — Scope Controls
13. Chunk 8 — Build & Package
14. Chunk 8A — Performance Validation

## Recommended Milestone Structure

### Milestone 1 — Discovery Engine

Deliver:

- Chunk 1
- Chunk 2
- Chunk 2A
- Chunk 4
- Chunk 7

### Milestone 2 — Download Engine

Deliver:

- Chunk 3
- Chunk 5
- Chunk 5A
- Chunk 5B

### Milestone 3 — User Experience

Deliver:

- Chunk 6
- Chunk 6A
- Chunk 6B

### Milestone 4 — Production Readiness

Deliver:

- Chunk 8
- Chunk 8A

## Success Criteria

The implementation is not complete until:

- Existing exporter functionality remains intact.
- Discovery mode works without downloads.
- Download mode supports uploaded and generated files.
- Inventory is always produced.
- Resume works after interruption.
- Large exports split safely.
- Progress reporting works throughout.
- Build passes.
- Installation package is generated.
