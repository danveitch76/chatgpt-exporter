const PROFILE_SELECTOR = '[data-testid="accounts-profile-button"]'
const SHARE_SELECTOR = 'div[role="presentation"] > .w-full > div > .flex.w-full'

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
        container.classList.remove('ce-menu-floating')
        container.dataset.ceMenuMode = 'share'
        if (container.parentElement !== shareTarget || shareTarget.firstElementChild !== container) {
            shareTarget.prepend(container)
        }
        return
    }

    // No guessed account selectors: retain the complete existing menu on the page.
    container.classList.add('ce-menu-floating')
    container.dataset.ceMenuMode = 'floating'
    if (document.body && container.parentElement !== document.body) document.body.append(container)
}
