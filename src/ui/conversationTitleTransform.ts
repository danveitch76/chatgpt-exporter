export type RenameOperation =
    | 'prefix'
    | 'suffix'
    | 'replace'
    | 'lowercase'
    | 'uppercase'
    | 'propercase'
    | 'status'

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

const canonicalStatuses = new Map<string, string>([
    ['ACTIVE', 'ACTIVE'],
    ['TO DO', 'TO DO'],
    ['TODO', 'TO DO'],
    ['WAITING', 'WAITING'],
    ['ON HOLD', 'ON HOLD'],
    ['COMPLETE', 'COMPLETE'],
    ['RETIRED', 'RETIRED'],
    ['NO', 'NO'],
    ['REJECTED', 'REJECTED'],
])

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toProperCase(value: string): string {
    return value
        .toLowerCase()
        .replace(
            /(^|[\s\-–—/([{])([a-z])/g,
            (_match, prefix: string, letter: string) => prefix + letter.toUpperCase(),
        )
}

function normaliseStatusCapitalisation(value: string): string {
    const branchPrefix = value.startsWith('Branch · ') ? 'Branch · ' : ''
    const remainder = value.slice(branchPrefix.length)
    const match = remainder.match(/^(.+?)(\s*-\s*)/)

    if (!match) return value

    const statusCandidate = match[1].trim().replace(/\s+/g, ' ').toUpperCase()
    const canonicalStatus = canonicalStatuses.get(statusCandidate)
    if (!canonicalStatus) return value

    return branchPrefix + canonicalStatus + match[2] + remainder.slice(match[0].length)
}

export function transformConversationTitle(
    title: string,
    transform: ConversationTitleTransform,
): ConversationTitleTransformResult {
    let proposedTitle = title

    if (transform.operation === 'prefix') {
        proposedTitle = transform.text + title
    }
    else if (transform.operation === 'suffix') {
        proposedTitle = title + transform.text
    }
    else if (transform.operation === 'lowercase') {
        proposedTitle = title.toLowerCase()
    }
    else if (transform.operation === 'uppercase') {
        proposedTitle = title.toUpperCase()
    }
    else if (transform.operation === 'propercase') {
        proposedTitle = toProperCase(title)
    }
    else if (transform.operation === 'status') {
        proposedTitle = normaliseStatusCapitalisation(title)
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
        proposedTitle = title.replace(
            new RegExp(escapeRegExp(transform.text), flags),
            () => transform.replacement,
        )
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
