const PROFILE_SELECTOR = '[data-testid="accounts-profile-button"]'
const SHARE_SELECTOR = 'div[role="presentation"] > .w-full > div > .flex.w-full'
const SIDEBAR_SELECTOR = '[data-testid="sidebar"], [aria-label="Sidebar"], aside, nav, [role="navigation"]'

function isVisible(element: Element, document: Document): boolean {
    const style = document.defaultView?.getComputedStyle(element)
    return element.getClientRects().length > 0
        && style?.visibility !== 'hidden'
        && style?.visibility !== 'collapse'
}

/** Keep one menu reachable even when ChatGPT replaces or hides its old anchor. */
export function syncExporterMenu(container: HTMLDivElement, document: Document, sharePage = false): void {
    const profile = Array.from(document.querySelectorAll(PROFILE_SELECTOR))
        .find(element => isVisible(element, document))

    if (profile) {
        container.classList.remove('ce-menu-sidebar-slot')
        const wrapper = profile.parentElement
        const siblings = wrapper ? Array.from(wrapper.children).filter(child => child !== container) : []
        const target = wrapper && siblings.length === 1 ? wrapper : profile
        container.classList.remove('ce-menu-floating')
        container.dataset.ceMenuMode = 'sidebar'
        if (container.parentElement !== target.parentElement || container.nextElementSibling !== target) {
            target.before(container)
        }
        return
    }

    const shareTarget = sharePage
        ? Array.from(document.querySelectorAll(SHARE_SELECTOR)).find(element => isVisible(element, document))
        : undefined
    if (shareTarget) {
        container.classList.remove('ce-menu-sidebar-slot')
        container.classList.remove('ce-menu-floating')
        container.dataset.ceMenuMode = 'share'
        if (container.parentElement !== shareTarget || shareTarget.firstElementChild !== container) {
            shareTarget.prepend(container)
        }
        return
    }

    // Recognise a visible left-hand navigation region without guessing the new
    // account-button identifier. Avoid short header bars and scrolling lists.
    const sidebar = Array.from(document.querySelectorAll(SIDEBAR_SELECTOR))
        .filter((element) => {
            if (!isVisible(element, document)) return false
            const rect = element.getBoundingClientRect()
            const minHeight = Math.max(160, (document.defaultView?.innerHeight ?? 0) / 2)
            const style = document.defaultView?.getComputedStyle(element)
            const scrolls = (style?.overflowY === 'auto' || style?.overflowY === 'scroll')
                && element.scrollHeight > element.clientHeight
            return rect.left >= -2 && rect.left <= 32
                && rect.width >= 40 && rect.width <= 440
                && rect.height >= minHeight && !scrolls
        })
        .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0]
    if (sidebar) {
        container.classList.remove('ce-menu-floating')
        container.classList.add('ce-menu-sidebar-slot')
        container.dataset.ceMenuMode = 'sidebar-fallback'
        if (container.parentElement !== sidebar || sidebar.lastElementChild !== container) {
            sidebar.append(container)
        }
        return
    }

    // Unrecognised layouts retain a launcher away from the chat list.
    container.classList.remove('ce-menu-sidebar-slot')
    container.classList.add('ce-menu-floating')
    container.dataset.ceMenuMode = 'floating'
    if (document.body && container.parentElement !== document.body) document.body.append(container)
}
