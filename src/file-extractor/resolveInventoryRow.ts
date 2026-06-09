import type { FileInventoryRow } from './types'

export type FileResolverStatus =
    | 'resolved'
    | 'metadata_only'
    | 'unsupported'
    | 'failed'

export interface ResolvedFileAsset {
    status: FileResolverStatus
    filename?: string
    mimeType?: string
    extension?: string
    sizeBytes?: number
    bytes?: Uint8Array
    failureReason?: string
    source: FileInventoryRow
}

export function resolveInventoryRow(row: FileInventoryRow): ResolvedFileAsset {
    if (row.downloadStatus === 'skipped_duplicate') {
        return metadataOnly(row, 'Duplicate rows are not resolved directly.')
    }

    if (row.assetPointer?.startsWith('data:')) {
        return resolveDataUri(row)
    }

    if (row.rawValue && typeof row.rawValue === 'string' && row.rawValue.startsWith('data:')) {
        return resolveDataUri({
            ...row,
            assetPointer: row.rawValue,
        })
    }

    if (row.rawPath || row.rawUrl) {
        return metadataOnly(row, 'Reference is metadata-only at resolver stage.')
    }

    if (row.fileId) {
        return unsupported(row, 'Backend file-id recovery is not implemented yet.')
    }

    if (row.assetPointer) {
        return unsupported(row, 'Asset pointer recovery is not implemented for this pointer type.')
    }

    return metadataOnly(row, 'No recoverable asset pointer was present.')
}

function resolveDataUri(row: FileInventoryRow): ResolvedFileAsset {
    const value = row.assetPointer
    if (!value) return failed(row, 'Data URI row did not include an asset pointer.')

    const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
    if (!match) return failed(row, 'Malformed data URI.')

    const mimeType = match[1] || row.mimeType || 'application/octet-stream'
    const isBase64 = Boolean(match[2])
    const payload = match[3] ?? ''

    try {
        const bytes = isBase64
            ? decodeBase64(payload)
            : encodeUtf8(decodeURIComponent(payload))

        const extension = row.extension || inferExtensionFromMimeType(mimeType)
        const filename = row.filename || buildDefaultFilename(row, extension)

        return {
            status: 'resolved',
            filename,
            mimeType,
            extension,
            sizeBytes: bytes.byteLength,
            bytes,
            source: row,
        }
    }
    catch (error) {
        return failed(row, error instanceof Error ? error.message : 'Failed to decode data URI.')
    }
}

function decodeBase64(value: string): Uint8Array {
    const binary = atob(value)
    return Uint8Array.from(binary, char => char.charCodeAt(0))
}

function encodeUtf8(value: string): Uint8Array {
    return new TextEncoder().encode(value)
}

function inferExtensionFromMimeType(mimeType: string): string | undefined {
    const map: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'text/plain': 'txt',
        'application/json': 'json',
    }

    return map[mimeType]
}

function buildDefaultFilename(row: FileInventoryRow, extension?: string): string {
    const base = row.fileId || row.messageId || 'resolved-file'
    return extension ? `${base}.${extension}` : base
}

function metadataOnly(row: FileInventoryRow, reason: string): ResolvedFileAsset {
    return {
        status: 'metadata_only',
        failureReason: reason,
        source: row,
    }
}

function unsupported(row: FileInventoryRow, reason: string): ResolvedFileAsset {
    return {
        status: 'unsupported',
        failureReason: reason,
        source: row,
    }
}

function failed(row: FileInventoryRow, reason: string): ResolvedFileAsset {
    return {
        status: 'failed',
        failureReason: reason,
        source: row,
    }
}
