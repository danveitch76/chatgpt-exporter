import urlcat from 'urlcat'
import { RateLimitError, getTeamAccountId } from './api'
import { apiUrl, baseUrl } from './constants'
import { memorize } from './utils/memorize'

interface ProjectManagementSession {
    accessToken: string
}

interface ConversationProjectState {
    id?: string
    title?: string
    gizmo_id?: string | null
}

interface ProjectState {
    id: string
    display: {
        name: string
        emoji?: string | null
        theme?: string | null
    }
    instructions?: string | null
}

export interface ProjectManagementResult {
    id: string
    kind: 'conversation-project' | 'project-rename'
    changed: boolean
    projectId?: string
    name?: string
}

const sessionApi = urlcat(baseUrl, '/api/auth/session')
const conversationApi = (id: string) => urlcat(apiUrl, '/conversation/:id', { id })
const projectApi = (id: string) => urlcat(apiUrl, '/gizmos/:id', { id })
const projectUpdateApi = (id: string) => urlcat(apiUrl, '/projects/:id', { id })

async function fetchSession(): Promise<ProjectManagementSession> {
    const response = await fetch(sessionApi)
    if (!response.ok) {
        throw new Error(response.statusText || 'Failed to load ChatGPT session')
    }
    return response.json()
}

const getSession = memorize(fetchSession)

async function authenticatedFetch(url: string, options?: RequestInit): Promise<Response> {
    const session = await getSession()
    const accountId = await getTeamAccountId()
    const response = await fetch(url, {
        ...options,
        headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'X-Authorization': `Bearer ${session.accessToken}`,
            ...(accountId ? { 'Chatgpt-Account-Id': accountId } : {}),
            ...options?.headers,
        },
    })

    if (!response.ok) {
        if (response.status === 429) {
            throw new RateLimitError(response.headers.get('Retry-After'))
        }
        throw new Error(response.statusText || `ChatGPT request failed (${response.status})`)
    }
    return response
}

async function readConversationProjectState(chatId: string): Promise<ConversationProjectState> {
    const response = await authenticatedFetch(conversationApi(chatId))
    return response.json()
}

function unwrapProjectPayload(value: unknown): ProjectState {
    let current = value
    for (let depth = 0; depth < 3; depth++) {
        if (!current || typeof current !== 'object' || Array.isArray(current)) break
        const record = current as Record<string, unknown>
        if (!record.gizmo) break
        current = record.gizmo
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
        throw new Error('ChatGPT returned an invalid Project payload')
    }

    const project = current as Partial<ProjectState>
    if (!project.id || !project.display?.name) {
        throw new Error('ChatGPT returned incomplete Project metadata')
    }
    return project as ProjectState
}

async function readProjectState(projectId: string): Promise<ProjectState> {
    const response = await authenticatedFetch(projectApi(projectId))
    return unwrapProjectPayload(await response.json())
}

/**
 * Move one conversation into an existing ChatGPT Project.
 *
 * This uses ChatGPT's undocumented web endpoint. The function therefore checks
 * the current Project membership immediately before the write, performs the
 * mutation, and verifies the resulting membership by reading the conversation
 * back. Conversations attached to a non-Project gizmo are rejected rather than
 * being silently detached from that gizmo.
 */
export async function moveConversationToProject(
    chatId: string,
    expectedProjectId: string | null,
    newProjectId: string,
    knownProjectIds: string[],
): Promise<ProjectManagementResult> {
    if (!chatId.trim()) throw new Error('Conversation id is required')
    if (!newProjectId.trim()) throw new Error('Destination Project id is required')

    const knownProjects = new Set(knownProjectIds)
    if (!knownProjects.has(newProjectId)) {
        throw new Error(`Destination Project is not loaded: ${newProjectId}`)
    }

    const before = await readConversationProjectState(chatId)
    const rawGizmoId = before.gizmo_id?.trim() || null
    if (rawGizmoId && !knownProjects.has(rawGizmoId)) {
        throw new Error('Conversation belongs to a non-Project gizmo and cannot be moved safely')
    }

    const currentProjectId = rawGizmoId
    if (currentProjectId === newProjectId) {
        return {
            id: chatId,
            kind: 'conversation-project',
            changed: false,
            projectId: newProjectId,
        }
    }
    if (currentProjectId !== expectedProjectId) {
        throw new Error('Current Project membership does not match expectedProjectId')
    }

    await authenticatedFetch(conversationApi(chatId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gizmo_id: newProjectId }),
    })

    const after = await readConversationProjectState(chatId)
    if ((after.gizmo_id?.trim() || null) !== newProjectId) {
        throw new Error('ChatGPT did not confirm the conversation Project move')
    }

    return {
        id: chatId,
        kind: 'conversation-project',
        changed: true,
        projectId: newProjectId,
    }
}

/**
 * Rename one ChatGPT Project while preserving the other fields that the current
 * Project update endpoint requires. The Project is read immediately before the
 * write and again afterwards so stale-name changes fail closed and successful
 * writes are verified rather than inferred from HTTP status alone.
 */
export async function renameProject(
    projectId: string,
    expectedName: string,
    newName: string,
): Promise<ProjectManagementResult> {
    if (!projectId.trim()) throw new Error('Project id is required')
    if (!newName.trim()) throw new Error('Project name cannot be empty')

    const before = await readProjectState(projectId)
    if (before.display.name === newName) {
        return {
            id: projectId,
            kind: 'project-rename',
            changed: false,
            name: newName,
        }
    }
    if (before.display.name !== expectedName) {
        throw new Error('Current Project name does not match expectedName')
    }

    await authenticatedFetch(projectUpdateApi(projectId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: newName,
            emoji: before.display.emoji ?? null,
            theme: before.display.theme ?? null,
            instructions: before.instructions ?? '',
        }),
    })

    const after = await readProjectState(projectId)
    if (after.display.name !== newName) {
        throw new Error('ChatGPT did not confirm the Project rename')
    }

    return {
        id: projectId,
        kind: 'project-rename',
        changed: true,
        name: newName,
    }
}
