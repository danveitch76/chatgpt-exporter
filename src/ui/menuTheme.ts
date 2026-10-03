/** Detect the page theme without depending exclusively on ChatGPT's .dark class. */
export function syncExporterTheme(document: Document): void {
    const root = document.documentElement
    const view = document.defaultView
    if (!root || !view) return
    const scheme = view.getComputedStyle(root).colorScheme
    let dark = scheme === 'dark' || root.matches('.dark, [data-theme="dark"]')
    if (scheme !== 'dark' && scheme !== 'light' && !dark) {
        const background = view.getComputedStyle(document.body).backgroundColor
        const components = background.match(/[\d.]+/g)?.map(Number)
        if (components && components.length >= 3 && (components[3] ?? 1) > 0) {
            dark = (components[0] + components[1] + components[2]) / 3 < 128
        }
        else {
            dark = view.matchMedia('(prefers-color-scheme: dark)').matches
        }
    }
    const theme = dark ? 'dark' : 'light'
    if (root.dataset.ceTheme !== theme) root.dataset.ceTheme = theme
}
