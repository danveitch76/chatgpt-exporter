import { scanConversationForFiles } from './scanConversation'
import type { FileExtractionStats, FileInventoryRow, FileReference } from './types'
import type { ApiConversationWithId } from '../api'

export interface BuildInventoryResult {
    inventory: FileInventoryRow[]
    stats: FileExtractionStats
}

export function buildInventory(conversations: ApiConversationWithId[]): BuildInventoryResult {
    const inventory: FileInventoryRow[] = []
    const seen = new Map<string, FileInventoryRow>()

    let messagesScanned = 0

    for (const conversation of conversations) {
        messagesScanned += Object.values(conversation.mapping ?? {}).filter(node => node.message).length

        const references = scanConversationForFiles(conversation)

        for (const reference of references) {
            const row = toInventoryRow(reference)
            const key = buildReferenceKey(reference)

            if (key && seen.has(key)) {
                const original = seen.get(key)
                inventory.push({
                    ...row,
                    downloadStatus: 'skipped_duplicate',
                    duplicateOf: original ? buildReferenceKey(original) : key,
                })
                continue
            }

            if (key) seen.set(key, row)

            inventory.push(row)
        }
    }

    const stats = buildStats(conversations.length, messagesScanned, inventory)

    return {
        inventory,
        stats,
    }
}

function toInventoryRow(reference: FileReference): FileInventoryRow {
    return {
        ...reference,
        downloadStatus: reference.fileId || reference.assetPointer ? 'pending' : 'metadata_only',
        zipPath: buildZipPath(reference),
    }
}

function buildReferenceKey(reference: FileReference): string {
    return [
        reference.fileId,
        reference.assetPointer,
        reference.rawPath,
        reference.rawUrl,
        reference.filename,
        reference.conversationId,
        reference.messageId,
        reference.sourceField,
    ]
        .filter(Boolean)
        .join('|')
}

function buildZipPath(reference: FileReference): string {
    const folder = reference.sourceType || 'unknown'
    const filename = safeFilename(
        reference.filename
        || reference.fileId
        || reference.assetPointer
        || reference.rawPath
        || 'unknown-file',
    )

    return `${folder}/${filename}`
}

function safeFilename(value: string): string {
    return value
        .replace(/^sediment:\/\//, '')
        .replace(/^sandbox:\/mnt\/data\//, '')
        .replace(/^\/mnt\/data\//, '')
        .replace(/[<>:"/\\\\|?*]/g, '_')
        .slice(0, 180)
}

function buildStats(
    conversationsScanned: number,
    messagesScanned: number,
    inventory: FileInventoryRow[],
): FileExtractionStats {
    return {
        conversationsScanned,
        messagesScanned,
        referencesFound: inventory.length,
        downloaded: inventory.filter(row => row.downloadStatus === 'downloaded').length,
        metadataOnly: inventory.filter(row => row.downloadStatus === 'metadata_only').length,
        failed: inventory.filter(row => row.downloadStatus === 'failed').length,
        skippedDuplicates: inventory.filter(row => row.downloadStatus === 'skipped_duplicate').length,
    }
}
