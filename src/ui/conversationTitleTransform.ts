export type RenameOperation = 'prefix' | 'suffix' | 'replace'

export interface ConversationTitleTransform {
    operation: RenameOperation
    text: string
    replacement: string
    caseSensitive: boolean
}

export interface ConversationTitleTransformResult {
    originalTitle: string
    proposedTitle: string
    changed: boolean
    valid: boolean
    error?: string
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function transformConversationTitle(
    title: string,
    transform: ConversationTitleTransform,
): ConversationTitleTransformResult {
    let proposedTitle = title

    if (transform.operation === 'prefix') {
        proposedTitle = `${transform.text}${title}`
    }
    else if (transform.operation === 'suffix') {
        proposedTitle = `${title}${transform.text}`
    }
    else {
        if (!transform.text) {
            return {
                originalTitle: title,
                proposedTitle: title,
                changed: false,
                valid: false,
                error: 'Find text is required.',
            }
        }

        const flags = transform.caseSensitive ? 'g' : 'gi'
        proposedTitle = title.replace(new RegExp(escapeRegExp(transform.text), flags), transform.replacement)
    }

    if (!proposedTitle.trim()) {
        return {
            originalTitle: title,
            proposedTitle,
            changed: proposedTitle !== title,
            valid: false,
            error: 'Resulting title cannot be empty.',
        }
    }

    return {
        originalTitle: title,
        proposedTitle,
        changed: proposedTitle !== title,
        valid: true,
    }
}
