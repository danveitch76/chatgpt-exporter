import urlcat from 'urlcat'
import { RateLimitError, getTeamAccountId } from './api'
import { apiUrl, baseUrl } from './constants'
import { memorize } from './utils/memorize'

interface RenameSession {
    accessToken: string
}

export interface RenameConversationResult {
    id: string
    title: string
}

const sessionApi = urlcat(baseUrl, '/api/auth/session')
const conversationApi = (id: string) => urlcat(apiUrl, '/conversation/:id', { id })

async function fetchSession(): Promise<RenameSession> {
    const response = await fetch(sessionApi)
    if (!response.ok) {
        throw new Error(response.statusText || 'Failed to load ChatGPT session')
    }
    return response.json()
}

const getSession = memorize(fetchSession)

/**
 * Rename one saved ChatGPT conversation using the same internal conversation
 * PATCH endpoint used by archive/delete operations.
 *
 * This is an undocumented ChatGPT web endpoint. Keep callers defensive: a
 * non-success response is treated as a failed operation and may change if the
 * upstream web application changes.
 */
export async function renameConversation(
    chatId: string,
    title: string,
): Promise<RenameConversationResult> {
    if (!chatId.trim()) throw new Error('Conversation id is required')
    if (!title.trim()) throw new Error('Conversation title cannot be empty')

    const session = await getSession()
    const accountId = await getTeamAccountId()
    const response = await fetch(conversationApi(chatId), {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'X-Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
            ...(accountId ? { 'Chatgpt-Account-Id': accountId } : {}),
        },
        body: JSON.stringify({ title }),
    })

    if (!response.ok) {
        if (response.status === 429) {
            throw new RateLimitError(response.headers.get('Retry-After'))
        }
        throw new Error(response.statusText || `Rename failed (${response.status})`)
    }

    const payload = await response.json() as { success?: boolean }
    if (payload.success !== true) {
        throw new Error('ChatGPT did not confirm the rename')
    }

    return { id: chatId, title }
}
