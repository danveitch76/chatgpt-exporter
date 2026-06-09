import type { FileReference, FileSourceType } from './types'
import type { ApiConversationWithId, ConversationNodeMessage } from '../api'

type WalkVisitor = (value: unknown, path: string) => void

const FILE_ID_KEYS = new Set([
    'file_id',
    'fileId',
    'fileID',
    'file_identifier',
    'fileIdentifier',
])

const ASSET_POINTER_KEYS = new Set([
    'asset_pointer',
    'audio_asset_pointer',
    'image_asset_pointer',
    'video_container_asset_pointer',
    'url',
    'image_url',
    'download_url',
])

const FILE_NAME_KEYS = new Set([
    'file_name',
    'filename',
    'name',
    'title',
])

const MIME_KEYS = new Set([
    'mime_type',
    'mimetype',
    'mimedata',
    'content_type',
])

const SIZE_KEYS = new Set([
    'size_bytes',
    'file_size_bytes',
    'bytes',
])

export function scanConversationForFiles(conversation: ApiConversationWithId): FileReference[] {
    const references: FileReference[] = []

    for (const node of Object.values(conversation.mapping ?? {})) {
        if (!node?.message) continue

        const message = node.message
        const context = buildMessageContext(conversation, node.id, message)

        walkObject(message, 'message', (value, path) => {
            if (typeof value !== 'string' && typeof value !== 'number') return

            const stringValue = String(value)
            const key = lastPathSegment(path)

            if (FILE_ID_KEYS.has(key) || looksLikeFileId(stringValue)) {
                references.push({
                    ...context,
                    sourceType: inferSourceType(message, path, stringValue),
                    fileId: normaliseFileId(stringValue),
                    filename: inferNearbyFilename(message, path),
                    extension: inferExtension(inferNearbyFilename(message, path)),
                    mimeType: inferNearbyMimeType(message, path),
                    sizeBytes: inferNearbySizeBytes(message, path),
                    sourceField: path,
                    rawValue: value,
                })
                return
            }

            if (ASSET_POINTER_KEYS.has(key) || looksLikeAssetPointer(stringValue) || looksLikeSandboxPath(stringValue)) {
                references.push({
                    ...context,
                    sourceType: inferSourceType(message, path, stringValue),
                    assetPointer: normaliseAssetPointer(stringValue),
                    rawPath: looksLikeSandboxPath(stringValue) ? stringValue : undefined,
                    rawUrl: looksLikeUrl(stringValue) ? stringValue : undefined,
                    filename: inferFilename(stringValue) ?? inferNearbyFilename(message, path),
                    extension: inferExtension(inferFilename(stringValue) ?? inferNearbyFilename(message, path)),
                    mimeType: inferNearbyMimeType(message, path),
                    sizeBytes: inferNearbySizeBytes(message, path),
                    sourceField: path,
                    rawValue: value,
                })
                return
            }

            if (looksLikeGeneratedFileText(stringValue)) {
                references.push({
                    ...context,
                    sourceType: 'generated',
                    rawPath: stringValue,
                    filename: inferFilename(stringValue),
                    extension: inferExtension(inferFilename(stringValue)),
                    sourceField: path,
                    rawValue: value,
                })
            }
        })
    }

    return references
}

function buildMessageContext(
    conversation: ApiConversationWithId,
    nodeId: string,
    message: ConversationNodeMessage,
): Omit<FileReference, 'sourceType'> {
    return {
        conversationId: conversation.id,
        conversationTitle: conversation.title || 'ChatGPT Conversation',
        conversationCreateTime: conversation.create_time,
        conversationUpdateTime: conversation.update_time,
        messageId: message.id || nodeId,
        messageCreateTime: message.create_time,
        authorRole: message.author?.role,
    }
}

function walkObject(value: unknown, path: string, visitor: WalkVisitor, seen = new WeakSet<object>()): void {
    visitor(value, path)

    if (value === null || typeof value !== 'object') return

    if (seen.has(value)) return
    seen.add(value)

    if (Array.isArray(value)) {
        value.forEach((item, index) => walkObject(item, `${path}[${index}]`, visitor, seen))
        return
    }

    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
        walkObject(child, `${path}.${key}`, visitor, seen)
    })
}

function lastPathSegment(path: string): string {
    return path.split('.').at(-1)?.replace(/\[\d+\]$/, '') ?? path
}

function looksLikeFileId(value: string): boolean {
    return /^file-[A-Za-z0-9_-]+$/.test(value)
}

function normaliseFileId(value: string): string {
    return value.replace(/^sediment:\/\//, '')
}

function looksLikeAssetPointer(value: string): boolean {
    return value.startsWith('sediment://')
        || value.startsWith('file-')
        || value.includes('/files/download/')
}

function normaliseAssetPointer(value: string): string {
    return value.trim()
}

function looksLikeSandboxPath(value: string): boolean {
    return value.startsWith('sandbox:/mnt/data/')
        || value.startsWith('/mnt/data/')
}

function looksLikeUrl(value: string): boolean {
    return /^https?:\/\//.test(value)
}

function looksLikeGeneratedFileText(value: string): boolean {
    return value.includes('sandbox:/mnt/data/')
        || value.includes('/mnt/data/')
}

function inferSourceType(message: ConversationNodeMessage, path: string, value: string): FileSourceType {
    const isStructuredUploadedAsset
        = path.includes('asset_pointer')
        || path.includes('image_asset_pointer')
        || path.includes('audio_asset_pointer')
        || path.includes('video_container_asset_pointer')
        || value.startsWith('data:image/')
        || value.startsWith('sediment://')
        || looksLikeFileId(value)
    if (
        value.startsWith('sediment://')
        || path.includes('image_asset_pointer')
        || path.includes('audio_asset_pointer')
        || path.includes('image_url')
        || path.includes('aggregate_result.messages')
    ) {
        return 'image'
    }

    if (
        value.includes('sandbox:/mnt/data/')
        || value.includes('/mnt/data/')
        || message.content.content_type === 'execution_output'
        || message.author?.role === 'assistant'
        || message.author?.role === 'tool'
    ) {
        return 'generated'
    }

    if (message.author?.role === 'user' && isStructuredUploadedAsset) {
        return 'uploaded'
    }

    return 'unknown'
}

function inferFilename(value?: string): string | undefined {
    if (!value) return undefined

    const sandboxMatch = value.match(/(?:sandbox:)?\/mnt\/data\/([^)\]\s"'<>]+)/)
    if (sandboxMatch?.[1]) return safeDecode(sandboxMatch[1])

    const urlFile = value.split('/').at(-1)?.split('?')[0]
    if (urlFile && /\.[A-Za-z0-9]{1,8}$/.test(urlFile)) return safeDecode(urlFile)

    return undefined
}

function inferExtension(filename?: string): string | undefined {
    if (!filename) return undefined
    const match = filename.match(/\.([A-Za-z0-9]{1,8})$/)
    return match?.[1]?.toLowerCase()
}

function inferNearbyFilename(root: unknown, sourcePath: string): string | undefined {
    const parent = getParentObject(root, sourcePath)
    if (!parent || typeof parent !== 'object') return undefined

    for (const key of FILE_NAME_KEYS) {
        const value = (parent as Record<string, unknown>)[key]
        if (typeof value === 'string' && value.trim()) return value
    }

    return undefined
}

function inferNearbyMimeType(root: unknown, sourcePath: string): string | undefined {
    const parent = getParentObject(root, sourcePath)
    if (!parent || typeof parent !== 'object') return undefined

    for (const key of MIME_KEYS) {
        const value = (parent as Record<string, unknown>)[key]
        if (typeof value === 'string' && value.includes('/')) return value
    }

    return undefined
}

function inferNearbySizeBytes(root: unknown, sourcePath: string): number | undefined {
    const parent = getParentObject(root, sourcePath)
    if (!parent || typeof parent !== 'object') return undefined

    for (const key of SIZE_KEYS) {
        const value = (parent as Record<string, unknown>)[key]
        if (typeof value === 'number' && Number.isFinite(value)) return value
    }

    return undefined
}

function getParentObject(root: unknown, sourcePath: string): unknown {
    const cleanPath = sourcePath.replace(/^message\./, '')
    const segments = cleanPath
        .replace(/\[(\d+)\]/g, '.$1')
        .split('.')
        .slice(0, -1)

    let current: unknown = root
    for (const segment of segments) {
        if (current === null || typeof current !== 'object') return undefined
        current = (current as Record<string, unknown>)[segment]
    }

    return current
}

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value)
    }
    catch {
        return value
    }
}
