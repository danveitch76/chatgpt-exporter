import { render } from 'preact'
import sentinel from 'sentinel-js'
import { fetchConversation, processConversation } from './api'
import { getChatIdFromUrl, isSharePage } from './page'
import { Menu } from './ui/Menu'
import { syncExporterMenu } from './ui/menuMount'
import { onloadSafe } from './utils/utils'

import './i18n'
import './styles/missing-tailwind.css'

main()

function main() {
    onloadSafe(() => {
        // eslint-disable-next-line no-console
        console.log('[Exporter] Loaded', __EXPORTER_VERSION__)

        const styleEl = document.createElement('style')
        styleEl.id = 'sentinel-css'
        document.head.append(styleEl)

        const container = getMenuContainer()
        const syncMenu = () => syncExporterMenu(container, document, isSharePage())
        syncMenu()
        // Polling also recovers hidden anchors and client-side navigation without
        // observing every streaming message mutation or recreating menu state.
        setInterval(syncMenu, 1000)

        /** Insert timestamp to the bottom right of each message */
        let chatId = ''
        sentinel.on('[role="presentation"]', async () => {
            const currentChatId = getChatIdFromUrl()
            if (!currentChatId || currentChatId === chatId) return
            chatId = currentChatId

            const rawConversation = await fetchConversation(chatId, false)
            const { conversationNodes } = processConversation(rawConversation)

            const threadContents = Array.from(document.querySelectorAll('main [data-testid^="conversation-turn-"] [data-message-id]'))
            if (threadContents.length === 0) return

            threadContents.forEach((thread, index) => {
                const createTime = conversationNodes[index]?.message?.create_time
                if (!createTime) return

                const date = new Date(createTime * 1000)

                const timestamp = document.createElement('time')
                timestamp.className = 'w-full text-gray-500 dark:text-gray-400 text-sm text-right'
                timestamp.dateTime = date.toISOString()
                timestamp.title = date.toLocaleString()

                const hour12 = document.createElement('span')
                hour12.setAttribute('data-time-format', '12')
                hour12.textContent = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                const hour24 = document.createElement('span')
                hour24.setAttribute('data-time-format', '24')
                hour24.textContent = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                timestamp.append(hour12, hour24)
                thread.append(timestamp)
            })
        })
    })
}

function getMenuContainer() {
    const container = document.createElement('div')
    container.id = 'chatgpt-exporter-menu'
    // to overlap on the list section
    container.style.zIndex = '99'
    render(<Menu container={container} />, container)
    return container
}
