export type ProjectManagementAction = 'moveConversation' | 'renameProject'

export interface MoveConversationManifestEntry {
    action: 'moveConversation'
    id: string
    expectedProjectId: string | null
    newProjectId: string
}

export interface RenameProjectManifestEntry {
    action: 'renameProject'
    id: string
    expectedName: string
    newName: string
}

export type ProjectManagementManifestEntry =
    | MoveConversationManifestEntry
    | RenameProjectManifestEntry

export interface ProjectManagementConversation {
    id: string
    title?: string
    gizmo_id?: string | null
}

export interface ProjectManagementProject {
    id: string
    display?: { name?: string }
}

export interface ProjectManagementPreviewRow {
    action: ProjectManagementAction
    id: string
    label: string
    originalValue: string
    proposedValue: string
    changed: boolean
    valid: boolean
    error?: string
    originalProjectId?: string | null
    proposedProjectId?: string
}

export interface ProjectManagementPreview {
    rows: ProjectManagementPreviewRow[]
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

export function parseProjectManagementManifest(value: string): ProjectManagementManifestEntry[] {
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

        const action = typeof item.action === 'string' ? item.action.trim() : ''
        const id = typeof item.id === 'string' ? item.id.trim() : ''

        if (action !== 'moveConversation' && action !== 'renameProject') {
            throw new Error(`Manifest entry ${index + 1} requires action "moveConversation" or "renameProject".`)
        }
        if (!id) throw new Error(`Manifest entry ${index + 1} requires an id.`)
        if (seen.has(id)) throw new Error(`Manifest contains duplicate id: ${id}`)
        seen.add(id)

        if (action === 'moveConversation') {
            const expectedProjectId = optionalString(item.expectedProjectId)
            const newProjectId = typeof item.newProjectId === 'string' ? item.newProjectId.trim() : ''
            if (expectedProjectId === undefined) {
                throw new Error(`Manifest entry ${index + 1} requires expectedProjectId as a Project id or null.`)
            }
            if (!newProjectId) {
                throw new Error(`Manifest entry ${index + 1} requires a destination newProjectId.`)
            }
            return { action, id, expectedProjectId, newProjectId }
        }

        const expectedName = typeof item.expectedName === 'string' ? item.expectedName : null
        const newName = typeof item.newName === 'string' ? item.newName : null
        if (expectedName === null) throw new Error(`Manifest entry ${index + 1} requires expectedName.`)
        if (newName === null || !newName.trim()) {
            throw new Error(`Manifest entry ${index + 1} requires a non-empty newName.`)
        }
        return { action, id, expectedName, newName }
    })
}

export function buildProjectManagementPreview(
    value: string,
    conversations: ProjectManagementConversation[],
    projects: ProjectManagementProject[],
): ProjectManagementPreview {
    let entries: ProjectManagementManifestEntry[]
    try {
        entries = parseProjectManagementManifest(value)
    }
    catch (error) {
        return { rows: [], error: error instanceof Error ? error.message : 'Manifest is invalid.' }
    }

    const projectIds = new Set(projects.map(project => project.id))
    const projectNames = new Map(projects.map(project => [project.id, project.display?.name ?? project.id]))
    const projectsById = new Map(projects.map(project => [project.id, project]))
    const conversationsById = new Map(conversations.map(conversation => [conversation.id, conversation]))

    return {
        rows: entries.map((entry) => {
            if (entry.action === 'renameProject') {
                const project = projectsById.get(entry.id)
                if (!project) {
                    return {
                        action: entry.action,
                        id: entry.id,
                        label: entry.id,
                        originalValue: entry.expectedName,
                        proposedValue: entry.newName,
                        changed: true,
                        valid: false,
                        error: 'Project is not loaded.',
                    }
                }

                const currentName = project.display?.name ?? ''
                if (currentName === entry.newName) {
                    return {
                        action: entry.action,
                        id: entry.id,
                        label: currentName || entry.id,
                        originalValue: currentName,
                        proposedValue: entry.newName,
                        changed: false,
                        valid: true,
                    }
                }

                if (currentName !== entry.expectedName) {
                    return {
                        action: entry.action,
                        id: entry.id,
                        label: currentName || entry.id,
                        originalValue: currentName,
                        proposedValue: entry.newName,
                        changed: true,
                        valid: false,
                        error: 'Current Project name does not match expectedName.',
                    }
                }

                return {
                    action: entry.action,
                    id: entry.id,
                    label: currentName || entry.id,
                    originalValue: currentName,
                    proposedValue: entry.newName,
                    changed: true,
                    valid: true,
                }
            }

            const conversation = conversationsById.get(entry.id)
            if (!conversation) {
                return {
                    action: entry.action,
                    id: entry.id,
                    label: entry.id,
                    originalValue: entry.expectedProjectId === null
                        ? 'Not in a Project'
                        : (projectNames.get(entry.expectedProjectId) ?? entry.expectedProjectId),
                    proposedValue: projectNames.get(entry.newProjectId) ?? entry.newProjectId,
                    changed: true,
                    valid: false,
                    error: 'Conversation is not loaded in the current scope.',
                    originalProjectId: entry.expectedProjectId,
                    proposedProjectId: entry.newProjectId,
                }
            }

            if (!projectIds.has(entry.newProjectId)) {
                const currentProjectId = projectIds.has(conversation.gizmo_id ?? '') ? conversation.gizmo_id! : null
                return {
                    action: entry.action,
                    id: entry.id,
                    label: conversation.title ?? entry.id,
                    originalValue: currentProjectId === null
                        ? 'Not in a Project'
                        : (projectNames.get(currentProjectId) ?? currentProjectId),
                    proposedValue: entry.newProjectId,
                    changed: true,
                    valid: false,
                    error: 'Destination Project is not loaded.',
                    originalProjectId: currentProjectId,
                    proposedProjectId: entry.newProjectId,
                }
            }

            const rawGizmoId = conversation.gizmo_id?.trim() || null
            if (rawGizmoId && !projectIds.has(rawGizmoId)) {
                return {
                    action: entry.action,
                    id: entry.id,
                    label: conversation.title ?? entry.id,
                    originalValue: 'Non-Project gizmo',
                    proposedValue: projectNames.get(entry.newProjectId) ?? entry.newProjectId,
                    changed: true,
                    valid: false,
                    error: 'Conversation belongs to a non-Project gizmo and cannot be moved safely.',
                    originalProjectId: null,
                    proposedProjectId: entry.newProjectId,
                }
            }

            const currentProjectId = rawGizmoId
            const originalValue = currentProjectId === null
                ? 'Not in a Project'
                : (projectNames.get(currentProjectId) ?? currentProjectId)
            const proposedValue = projectNames.get(entry.newProjectId) ?? entry.newProjectId

            if (currentProjectId === entry.newProjectId) {
                return {
                    action: entry.action,
                    id: entry.id,
                    label: conversation.title ?? entry.id,
                    originalValue,
                    proposedValue,
                    changed: false,
                    valid: true,
                    originalProjectId: currentProjectId,
                    proposedProjectId: entry.newProjectId,
                }
            }

            if (currentProjectId !== entry.expectedProjectId) {
                return {
                    action: entry.action,
                    id: entry.id,
                    label: conversation.title ?? entry.id,
                    originalValue,
                    proposedValue,
                    changed: true,
                    valid: false,
                    error: 'Current Project membership does not match expectedProjectId.',
                    originalProjectId: currentProjectId,
                    proposedProjectId: entry.newProjectId,
                }
            }

            return {
                action: entry.action,
                id: entry.id,
                label: conversation.title ?? entry.id,
                originalValue,
                proposedValue,
                changed: true,
                valid: true,
                originalProjectId: currentProjectId,
                proposedProjectId: entry.newProjectId,
            }
        }),
    }
}
