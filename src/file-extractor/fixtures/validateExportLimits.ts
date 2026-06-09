import { planFileExtractionArchives } from '../exportLimits'
import type { FileInventoryRow } from '../types'

function row(filename: string, sizeBytes: number): FileInventoryRow {
    return {
        conversationId: 'fixture-conversation',
        conversationTitle: 'Fixture Conversation',
        sourceType: 'generated',
        filename,
        sizeBytes,
        downloadStatus: 'metadata_only',
    }
}

function assert(name: string, condition: boolean): void {
    if (!condition) throw new Error(`Export limit validation failed: ${name}`)
}

const rows = [
    row('one.bin', 50),
    row('two.bin', 50),
    row('three.bin', 50),
    row('oversized.bin', 500),
]

const result = planFileExtractionArchives(rows, {
    maxFilesPerArchive: 2,
    maxEstimatedArchiveBytes: 100,
    maxSingleFileBytes: 200,
})

assert('splits archive into parts', result.parts.length === 2)
assert('first part has two rows', result.parts[0].rows.length === 2)
assert('second part has one row', result.parts[1].rows.length === 1)
assert('detects oversized row', result.oversizedRows.length === 1)
assert('records warnings', result.warnings.length >= 2)

export const validatedExportLimitResult = result
