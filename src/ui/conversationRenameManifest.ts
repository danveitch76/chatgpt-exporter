export interface RenameManifestEntry {
    id: string
    expectedTitle: string
    newTitle: string
}

export interface RenameManifestConversation {
    id: string
    title?: string
}

export interface RenameManifestPreviewRow {
    id: string
    originalTitle: string
    proposedTitle: string
    changed: boolean
    valid: boolean
    error?: string
}

export interface RenameManifestPreview {
    rows: RenameManifestPreviewRow[]
    error?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseRenameManifest(value: string): RenameManifestEntry[] {
    if (!value.trim()) return []

    let parsed: unknown
    try {
        parsed = JSON.parse(value)
    }
    catch {
        throw new Error('Manifest must be valid JSON.')
    }

    if (!Array.isArray(parsed)) {
        throw new Error('Manifest root must be a JSON array.')
    }

    const seen = new Set<string>()
    return parsed.map((item, index) => {
        if (!isRecord(item)) {
            throw new Error('Manifest entry ' + (index + 1) + ' must be an object.')
        }

        const id = typeof item.id === 'string' ? item.id.trim() : ''
        const expectedTitle = typeof item.expectedTitle === 'string' ? item.expectedTitle : null
        const newTitle = typeof item.newTitle === 'string' ? item.newTitle : null

        if (!id) {
            throw new Error('Manifest entry ' + (index + 1) + ' requires a conversation id.')
        }
        if (seen.has(id)) {
            throw new Error('Manifest contains duplicate conversation id: ' + id)
        }
        if (expectedTitle === null) {
            throw new Error('Manifest entry ' + (index + 1) + ' requires expectedTitle.')
        }
        if (newTitle === null || !newTitle.trim()) {
            throw new Error('Manifest entry ' + (index + 1) + ' requires a non-empty newTitle.')
        }

        seen.add(id)
        return { id, expectedTitle, newTitle }
    })
}

export function buildRenameManifestPreview(
    value: string,
    conversations: RenameManifestConversation[],
): RenameManifestPreview {
    let entries: RenameManifestEntry[]
    try {
        entries = parseRenameManifest(value)
    }
    catch (error) {
        return {
            rows: [],
            error: error instanceof Error ? error.message : 'Manifest is invalid.',
        }
    }

    const byId = new Map(conversations.map(conversation => [conversation.id, conversation]))
    const rows = entries.map<RenameManifestPreviewRow>((entry) => {
        const conversation = byId.get(entry.id)
        if (!conversation) {
            return {
                id: entry.id,
                originalTitle: entry.expectedTitle,
                proposedTitle: entry.newTitle,
                changed: true,
                valid: false,
                error: 'Conversation is not loaded in the current scope.',
            }
        }

        const currentTitle = conversation.title ?? ''
        if (currentTitle === entry.newTitle) {
            return {
                id: entry.id,
                originalTitle: currentTitle,
                proposedTitle: entry.newTitle,
                changed: false,
                valid: true,
            }
        }

        if (currentTitle !== entry.expectedTitle) {
            return {
                id: entry.id,
                originalTitle: currentTitle,
                proposedTitle: entry.newTitle,
                changed: true,
                valid: false,
                error: 'Current title does not match expectedTitle.',
            }
        }

        return {
            id: entry.id,
            originalTitle: currentTitle,
            proposedTitle: entry.newTitle,
            changed: currentTitle !== entry.newTitle,
            valid: true,
        }
    })

    return { rows }
}
