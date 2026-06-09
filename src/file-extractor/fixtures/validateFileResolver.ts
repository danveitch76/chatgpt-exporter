import { resolveInventoryRow } from '../resolveInventoryRow'
import type { FileInventoryRow } from '../types'

function assert(name: string, condition: boolean): void {
    if (!condition) throw new Error(`File resolver validation failed: ${name}`)
}

const uploadedBase64ImageRow: FileInventoryRow = {
    conversationId: 'conversation-1',
    conversationTitle: 'Uploaded Image',
    messageId: 'message-1',
    authorRole: 'user',
    sourceType: 'uploaded',
    assetPointer: 'data:image/png;base64,aGVsbG8=',
    sourceField: 'message.content.parts[0].asset_pointer',
    downloadStatus: 'pending',
    zipPath: 'uploaded/example.png',
}

const metadataOnlySandboxRow: FileInventoryRow = {
    conversationId: 'conversation-2',
    conversationTitle: 'Generated File Path',
    messageId: 'message-2',
    authorRole: 'assistant',
    sourceType: 'generated',
    rawPath: 'sandbox:/mnt/data/report.md',
    filename: 'report.md',
    extension: 'md',
    sourceField: 'message.content.parts[0]',
    downloadStatus: 'metadata_only',
    zipPath: 'generated/report.md',
}

const unsupportedFileIdRow: FileInventoryRow = {
    conversationId: 'conversation-3',
    conversationTitle: 'Backend File',
    messageId: 'message-3',
    authorRole: 'user',
    sourceType: 'uploaded',
    fileId: 'file-abc123',
    sourceField: 'message.metadata.file_id',
    downloadStatus: 'pending',
    zipPath: 'uploaded/file-abc123',
}

const malformedDataUriRow: FileInventoryRow = {
    conversationId: 'conversation-4',
    conversationTitle: 'Broken Data URI',
    messageId: 'message-4',
    authorRole: 'user',
    sourceType: 'uploaded',
    assetPointer: 'data:image/png;base64,%%%not-base64%%%',
    sourceField: 'message.content.parts[0].asset_pointer',
    downloadStatus: 'pending',
    zipPath: 'uploaded/broken.png',
}

const uploadedResult = resolveInventoryRow(uploadedBase64ImageRow)
const metadataResult = resolveInventoryRow(metadataOnlySandboxRow)
const unsupportedResult = resolveInventoryRow(unsupportedFileIdRow)
const malformedResult = resolveInventoryRow(malformedDataUriRow)

assert('uploaded base64 image resolves', uploadedResult.status === 'resolved')
assert('uploaded base64 image has bytes', uploadedResult.bytes?.byteLength === 5)
assert('uploaded base64 image infers mime type', uploadedResult.mimeType === 'image/png')
assert('uploaded base64 image infers extension', uploadedResult.extension === 'png')

assert('sandbox path remains metadata-only', metadataResult.status === 'metadata_only')
assert('file id is unsupported for now', unsupportedResult.status === 'unsupported')
assert('malformed data URI fails safely', malformedResult.status === 'failed')

export const fileResolverValidation = {
    uploadedResult,
    metadataResult,
    unsupportedResult,
    malformedResult,
}
