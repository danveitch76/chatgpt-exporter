import type { FileInventoryRow } from './types'

export interface FileExtractionLimitOptions {
    maxFilesPerArchive?: number
    maxEstimatedArchiveBytes?: number
    maxSingleFileBytes?: number
}

export interface FileExtractionArchivePart {
    partNumber: number
    estimatedBytes: number
    rows: FileInventoryRow[]
}

export interface FileExtractionLimitResult {
    parts: FileExtractionArchivePart[]
    oversizedRows: FileInventoryRow[]
    warnings: string[]
}

const DEFAULT_MAX_FILES_PER_ARCHIVE = 250
const DEFAULT_MAX_ESTIMATED_ARCHIVE_BYTES = 250 * 1024 * 1024
const DEFAULT_MAX_SINGLE_FILE_BYTES = 100 * 1024 * 1024
const DEFAULT_UNKNOWN_FILE_BYTES = 1024 * 1024

function estimateRowBytes(row: FileInventoryRow): number {
    return row.sizeBytes && row.sizeBytes > 0 ? row.sizeBytes : DEFAULT_UNKNOWN_FILE_BYTES
}

export function planFileExtractionArchives(
    rows: FileInventoryRow[],
    options: FileExtractionLimitOptions = {},
): FileExtractionLimitResult {
    const maxFilesPerArchive = options.maxFilesPerArchive ?? DEFAULT_MAX_FILES_PER_ARCHIVE
    const maxEstimatedArchiveBytes = options.maxEstimatedArchiveBytes ?? DEFAULT_MAX_ESTIMATED_ARCHIVE_BYTES
    const maxSingleFileBytes = options.maxSingleFileBytes ?? DEFAULT_MAX_SINGLE_FILE_BYTES

    const parts: FileExtractionArchivePart[] = []
    const oversizedRows: FileInventoryRow[] = []
    const warnings: string[] = []

    let currentRows: FileInventoryRow[] = []
    let currentBytes = 0

    const flushPart = () => {
        if (currentRows.length === 0) return

        parts.push({
            partNumber: parts.length + 1,
            estimatedBytes: currentBytes,
            rows: currentRows,
        })

        currentRows = []
        currentBytes = 0
    }

    for (const row of rows) {
        const estimatedBytes = estimateRowBytes(row)

        if (estimatedBytes > maxSingleFileBytes) {
            oversizedRows.push(row)
            warnings.push(`Skipped oversized file reference: ${row.filename ?? row.rawPath ?? row.assetPointer ?? 'unknown'}`)
            continue
        }

        const exceedsFileCount = currentRows.length >= maxFilesPerArchive
        const exceedsByteLimit = currentRows.length > 0 && currentBytes + estimatedBytes > maxEstimatedArchiveBytes

        if (exceedsFileCount || exceedsByteLimit) {
            flushPart()
        }

        currentRows.push(row)
        currentBytes += estimatedBytes
    }

    flushPart()

    if (parts.length > 1) {
        warnings.push(`Split export into ${parts.length} archive parts to protect browser memory.`)
    }

    if (oversizedRows.length > 0) {
        warnings.push(`${oversizedRows.length} oversized file reference(s) excluded from archive plan.`)
    }

    return {
        parts,
        oversizedRows,
        warnings,
    }
}
