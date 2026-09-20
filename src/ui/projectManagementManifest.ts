export interface ConversationProjectManifestEntry {
    id: string
    expectedProjectId: string | null
    newProjectId: string
}

export interface ProjectRenameManifestEntry {
    id: string
    expectedName: string
    newName: string
}

export interface ProjectManagementConversation {
    id: string
    title?: string
    gizmo_id?: string | null
}

export interface ProjectManagementProject {
    id: string
    display?: { name?: string }
}

export interface ConversationProjectPreviewRow {
    id: string
    title: string
    originalProjectId: string | null
    proposedProjectId: string
    changed: boolean
    valid: boolean
    error?: string
}

export interface ProjectRenamePreviewRow {
    id: string
    originalName: string
    proposedName: string
    changed: boolean
    valid: boolean
    error?: string
}

export interface ProjectManagementPreview<T> {
    rows: T[]
    error?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): string | null | undefined {
    if (value === null) return null
    if (typeof value === 'string') return value.trim() || undefined
    return undefined
}

export function parseConversationProjectManifest(value: string): ConversationProjectManifestEntry[] {
    if (!value.trim()) return []

    let parsed: unknown
    try {
        parsed = JSON.parse(value)
    }
    catch {
        throw new Error('Manifest must be valid JSON.')
    }

    if (!Array.isArray(parsed)) {
        throw new TypeError('Manifest root must be a JSON array.')
    }

    const seen = new Set<string>()
    return parsed.map((item, index) => {
        if (!isRecord(item)) {
            throw new TypeError(`Manifest entry ${index + 1} must be an object.`)
        }

        const id = typeof item.id === 'string' ? item.id.trim() : ''
        const expectedProjectId = optionalString(item.expectedProjectId)
        const newProjectId = typeof item.newProjectId === 'string' ? item.newProjectId.trim() : ''

        if (!id) throw new Error(`Manifest entry ${index + 1} requires a conversation id.`)
        if (seen.has(id)) throw new Error(`Manifest contains duplicate conversation id: ${id}`)
        if (expectedProjectId === undefined) {
            throw new Error(`Manifest entry ${index + 1} requires expectedProjectId as a Project id or null.`)
        }
        if (!newProjectId) {
            throw new Error(`Manifest entry ${index + 1} requires a destination newProjectId.`)
        }

        seen.add(id)
        return { id, expectedProjectId, newProjectId }
    })
}

export function parseProjectRenameManifest(value: string): ProjectRenameManifestEntry[] {
    if (!value.trim()) return []

    let parsed: unknown
    try {
        parsed = JSON.parse(value)
    }
    catch {
        throw new Error('Manifest must be valid JSON.')
    }

    if (!Array.isArray(parsed)) {
        throw new TypeError('Manifest root must be a JSON array.')
    }

    const seen = new Set<string>()
    return parsed.map((item, index) => {
        if (!isRecord(item)) {
            throw new TypeError(`Manifest entry ${index + 1} must be an object.`)
        }

        const id = typeof item.id === 'string' ? item.id.trim() : ''
        const expectedName = typeof item.expectedName === 'string' ? item.expectedName : null
        const newName = typeof item.newName === 'string' ? item.newName : null

        if (!id) throw new Error(`Manifest entry ${index + 1} requires a Project id.`)
        if (seen.has(id)) throw new Error(`Manifest contains duplicate Project id: ${id}`)
        if (expectedName === null) throw new Error(`Manifest entry ${index + 1} requires expectedName.`)
        if (newName === null || !newName.trim()) {
            throw new Error(`Manifest entry ${index + 1} requires a non-empty newName.`)
        }

        seen.add(id)
        return { id, expectedName, newName }
    })
}

export function buildConversationProjectPreview(
    value: string,
    conversations: ProjectManagementConversation[],
    projects: ProjectManagementProject[],
): ProjectManagementPreview<ConversationProjectPreviewRow> {
    let entries: ConversationProjectManifestEntry[]
    try {
        entries = parseConversationProjectManifest(value)
    }
    catch (error) {
        return { rows: [], error: error instanceof Error ? error.message : 'Manifest is invalid.' }
    }

    const projectIds = new Set(projects.map(project => project.id))
    const conversationsById = new Map(conversations.map(conversation => [conversation.id, conversation]))

    return {
        rows: entries.map((entry) => {
            const conversation = conversationsById.get(entry.id)
            if (!conversation) {
                return {
                    id: entry.id,
                    title: '',
                    originalProjectId: entry.expectedProjectId,
                    proposedProjectId: entry.newProjectId,
                    changed: true,
                    valid: false,
                    error: 'Conversation is not loaded in the current scope.',
                }
            }

            if (!projectIds.has(entry.newProjectId)) {
                return {
                    id: entry.id,
                    title: conversation.title ?? '',
                    originalProjectId: projectIds.has(conversation.gizmo_id ?? '') ? conversation.gizmo_id! : null,
                    proposedProjectId: entry.newProjectId,
                    changed: true,
                    valid: false,
                    error: 'Destination Project is not loaded.',
                }
            }

            const rawGizmoId = conversation.gizmo_id?.trim() || null
            if (rawGizmoId && !projectIds.has(rawGizmoId)) {
                return {
                    id: entry.id,
                    title: conversation.title ?? '',
                    originalProjectId: null,
                    proposedProjectId: entry.newProjectId,
                    changed: true,
                    valid: false,
                    error: 'Conversation belongs to a non-Project gizmo and cannot be moved safely.',
                }
            }

            const currentProjectId = rawGizmoId
            if (currentProjectId === entry.newProjectId) {
                return {
                    id: entry.id,
                    title: conversation.title ?? '',
                    originalProjectId: currentProjectId,
                    proposedProjectId: entry.newProjectId,
                    changed: false,
                    valid: true,
                }
            }

            if (currentProjectId !== entry.expectedProjectId) {
                return {
                    id: entry.id,
                    title: conversation.title ?? '',
                    originalProjectId: currentProjectId,
                    proposedProjectId: entry.newProjectId,
                    changed: true,
                    valid: false,
                    error: 'Current Project membership does not match expectedProjectId.',
                }
            }

            return {
                id: entry.id,
                title: conversation.title ?? '',
                originalProjectId: currentProjectId,
                proposedProjectId: entry.newProjectId,
                changed: true,
                valid: true,
            }
        }),
    }
}

export function buildProjectRenamePreview(
    value: string,
    projects: ProjectManagementProject[],
): ProjectManagementPreview<ProjectRenamePreviewRow> {
    let entries: ProjectRenameManifestEntry[]
    try {
        entries = parseProjectRenameManifest(value)
    }
    catch (error) {
        return { rows: [], error: error instanceof Error ? error.message : 'Manifest is invalid.' }
    }

    const projectsById = new Map(projects.map(project => [project.id, project]))
    return {
        rows: entries.map((entry) => {
            const project = projectsById.get(entry.id)
            if (!project) {
                return {
                    id: entry.id,
                    originalName: entry.expectedName,
                    proposedName: entry.newName,
                    changed: true,
                    valid: false,
                    error: 'Project is not loaded.',
                }
            }

            const currentName = project.display?.name ?? ''
            if (currentName === entry.newName) {
                return {
                    id: entry.id,
                    originalName: currentName,
                    proposedName: entry.newName,
                    changed: false,
                    valid: true,
                }
            }

            if (currentName !== entry.expectedName) {
                return {
                    id: entry.id,
                    originalName: currentName,
                    proposedName: entry.newName,
                    changed: true,
                    valid: false,
                    error: 'Current Project name does not match expectedName.',
                }
            }

            return {
                id: entry.id,
                originalName: currentName,
                proposedName: entry.newName,
                changed: true,
                valid: true,
            }
        }),
    }
}
