import { fetchConversation, getCurrentChatId } from '../api'
import { checkIfConversationStarted } from '../page'
import { downloadFile, getFileNameWithFormat } from '../utils/download'
import { buildInventory } from './buildInventory'
import type { ApiConversationWithId } from '../api'

export async function exportCurrentConversationFileDiscovery(fileNameFormat: string): Promise<boolean> {
    if (!checkIfConversationStarted()) {
        alert('Please start a conversation first')
        return false
    }

    const chatId = await getCurrentChatId()
    const rawConversation = await fetchConversation(chatId, false)

    return exportFileDiscovery(fileNameFormat, [rawConversation], rawConversation.title, chatId)
}

export async function exportAllFileDiscovery(
    fileNameFormat: string,
    apiConversations: ApiConversationWithId[],
): Promise<boolean> {
    return exportFileDiscovery(fileNameFormat, apiConversations, 'chatgpt-file-discovery')
}

function exportFileDiscovery(
    fileNameFormat: string,
    apiConversations: ApiConversationWithId[],
    title = 'chatgpt-file-discovery',
    chatId = '',
): boolean {
    const result = buildInventory(apiConversations)

    const discoveryPayload = {
        generatedAt: new Date().toISOString(),
        mode: 'discovery_only',
        stats: result.stats,
        inventory: result.inventory,
    }

    const fileName = getFileNameWithFormat(fileNameFormat, 'file-discovery.json', {
        title,
        chatId,
    })

    downloadFile(
        fileName,
        'application/json',
        JSON.stringify(discoveryPayload, null, 2),
    )

    return true
}
