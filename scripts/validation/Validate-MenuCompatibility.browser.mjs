import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
    const split = arg.indexOf('=')
    if (split < 0) throw new Error('Use --name=value arguments')
    return [arg.slice(2, split), arg.slice(split + 1)]
}))
if (!args['browser-executable'] || !args['screenshots-dir']) throw new Error('Required: --browser-executable=<path> --screenshots-dir=<directory>, optional: --playwright-module=<path>')
const { chromium } = require(args['playwright-module'] || 'playwright')
const root = fileURLToPath(new URL('../../', import.meta.url))
const screenshotDir = args['screenshots-dir']
mkdirSync(screenshotDir, { recursive: true })
const browser = await chromium.launch({ executablePath: args['browser-executable'], args: ['--no-sandbox', '--disable-dev-shm-usage', '--single-process', '--no-zygote', '--disable-gpu', '--use-gl=disabled', '--disable-software-rasterizer'], headless: true })
const bundle = readFileSync(`${root}/dist/chatgpt.user.js`, 'utf8')
async function fixture(page, theme, sidebar = true) {
    await page.unroute('**/*')
    await page.route('**/*', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html style="color-scheme:${theme}"><head><style>body{margin:0;background:${theme === 'dark' ? '#101010' : '#fff'};color:${theme === 'dark' ? '#eee' : '#111'};font:14px Arial}aside{position:fixed;left:0;top:0;width:340px;height:100vh;display:flex;flex-direction:column;box-sizing:border-box;background:${theme === 'dark' ? '#080808' : '#f6f6f6'}}header,footer{padding:16px}.chatlist{flex:1;min-height:0;overflow:auto;padding:16px}.chatlist p{padding:10px 0}main{margin-left:360px;padding:24px}</style></head><body>${sidebar ? `<aside><header>ChatGPT</header><div class="chatlist">${Array.from({ length: 20 }, (_, i) => `<p>Saved conversation ${i + 1}</p>`).join('')}</div><footer><button aria-haspopup="menu">Account</button></footer></aside>` : ''}<main><h1>Menu compatibility fixture</h1></main></body></html>` }))
    await page.goto('http://exporter.test/g/test-project')
    await page.evaluate(() => {
        window.unsafeWindow = window
        window.GM_getValue = (_key, initial) => initial
        window.GM_setValue = () => {}
        window.GM_deleteValue = () => {}
    })
    for (const p of ['/node_modules/jszip/dist/jszip.min.js', '/node_modules/html2canvas/dist/html2canvas.min.js']) await page.addScriptTag({ content: readFileSync(root + p, 'utf8') })
    await page.addScriptTag({ content: bundle })
    await page.locator('#chatgpt-exporter-menu .ce-nav-trigger').waitFor()
}
try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await fixture(page, 'dark')
    assert.equal(await page.locator('#chatgpt-exporter-menu').getAttribute('data-ce-menu-mode'), 'sidebar-fallback')
    assert.equal(await page.locator('html').getAttribute('data-ce-theme'), 'dark')
    await page.locator('#chatgpt-exporter-menu .ce-nav-trigger').click()
    await page.locator('.ce-export-menu').waitFor({ state: 'visible' })
    const style = await page.locator('.ce-export-menu').evaluate(el => ({ background: getComputedStyle(el).backgroundColor, display: getComputedStyle(el).display, rect: { x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height }, items: [...el.querySelectorAll('.ce-menu-item')].map(x => getComputedStyle(x).display) }))
    assert.equal(style.background, 'rgb(42, 42, 42)')
    assert.equal(style.display, 'grid')
    assert.ok(style.items.every(x => x === 'flex'))
    assert.ok(style.rect.x >= 0 && style.rect.y >= 0 && style.rect.x + style.rect.w <= 1280 && style.rect.y + style.rect.h <= 900)
    await page.locator('.ce-export-menu').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
    await page.screenshot({ path: join(screenshotDir, 'dark-sidebar.png') })
    assert.equal(await page.locator('.ce-export-menu .ce-menu-item').count(), 10)
    await page.locator('aside').evaluate(el => el.style.width = '64px')
    await page.waitForFunction(() => document.querySelector('#chatgpt-exporter-menu')?.hasAttribute('data-ce-sidebar-collapsed'))
    await page.locator('aside').evaluate(el => el.remove())
    await page.waitForFunction(() => document.querySelector('#chatgpt-exporter-menu')?.dataset.ceMenuMode === 'floating')
    assert.equal(await page.locator('#chatgpt-exporter-menu').count(), 1)
    const rect = await page.locator('#chatgpt-exporter-menu').boundingBox()
    assert.ok(rect.x > 640)
    await page.locator('#chatgpt-exporter-menu .ce-nav-trigger').click()
    await page.locator('.ce-export-menu').waitFor({ state: 'visible' })
    await page.locator('.ce-export-menu').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
    await page.screenshot({ path: join(screenshotDir, 'dark-fallback.png') })
    await page.locator('.ce-export-menu').getByText('Setting', { exact: true }).click()
    await page.getByText('Exporter Settings', { exact: true }).waitFor({ state: 'visible' })
    assert.deepEqual(errors, [])
    const light = page
    await fixture(light, 'light', false)
    await light.locator('#chatgpt-exporter-menu .ce-nav-trigger').click()
    await light.locator('.ce-export-menu').waitFor({ state: 'visible' })
    assert.equal(await light.locator('.ce-export-menu').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)')
    await light.locator('.ce-export-menu').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
    await light.screenshot({ path: join(screenshotDir, 'light-fallback.png') })
    const mobile = page
    await mobile.setViewportSize({ width: 390, height: 844 })
    await fixture(mobile, 'dark', false)
    await mobile.locator('#chatgpt-exporter-menu .ce-nav-trigger').click()
    await mobile.locator('.ce-export-menu').waitFor({ state: 'visible' })
    await mobile.locator('.ce-export-menu').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
    const mr = await mobile.locator('.ce-export-menu').boundingBox()
    assert.ok(mr.x >= 0 && mr.y >= 0 && mr.x + mr.width <= 390 && mr.y + mr.height <= 844)
    await mobile.locator('.ce-export-menu').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
    await mobile.screenshot({ path: join(screenshotDir, 'mobile-fallback.png') })
    console.log('Browser fixture passed: opaque dark/light menus, self-contained layout, recognised sidebar, collapse, relocation, one menu, right-hand fallback, settings interaction and mobile bounds.')
}
finally { await browser.close() }
