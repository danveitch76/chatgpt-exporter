import { strict as assert } from 'node:assert'
import { syncExporterMenu } from '../ui/menuMount'

// Minimal tree fixture for relocation and idempotency. Real layout/interaction
// requires a browser smoke test in addition to these deterministic checks.
class FixtureElement {
    parentElement: FixtureElement | null = null
    children: FixtureElement[] = []
    dataset: Record<string, string> = {}
    visible = true
    visibility = 'visible'
    overflowY = 'visible'
    scrollHeight = 600
    clientHeight = 600
    rect = { left: 0, width: 300, height: 600 }
    classes = new Set<string>()
    classList = {
        add: (name: string) => this.classes.add(name),
        remove: (name: string) => this.classes.delete(name),
    }

    get nextElementSibling() {
        const siblings = this.parentElement?.children ?? []
        return siblings[siblings.indexOf(this) + 1] ?? null
    }

    get firstElementChild() {
        return this.children[0] ?? null
    }

    get lastElementChild() {
        return this.children[this.children.length - 1] ?? null
    }

    getBoundingClientRect() {
        return this.rect
    }

    getClientRects() {
        return this.visible ? [{}] : []
    }

    remove() {
        if (!this.parentElement) return
        const parent = this.parentElement
        parent.children.splice(parent.children.indexOf(this), 1)
        this.parentElement = null
    }

    append(child: FixtureElement) {
        child.remove()
        child.parentElement = this
        this.children.push(child)
    }

    prepend(child: FixtureElement) {
        child.remove()
        child.parentElement = this
        this.children.unshift(child)
    }

    before(child: FixtureElement) {
        const parent = this.parentElement
        assert.ok(parent)
        child.remove()
        child.parentElement = parent
        parent.children.splice(parent.children.indexOf(this), 0, child)
    }
}

const body = new FixtureElement()
const menu = new FixtureElement()
let profiles: FixtureElement[] = []
let shareTargets: FixtureElement[] = []
let sidebars: FixtureElement[] = []
const documentFixture = {
    body,
    defaultView: {
        innerHeight: 900,
        getComputedStyle: (element: FixtureElement) => ({ visibility: element.visibility, overflowY: element.overflowY }),
    },
    querySelectorAll: (selector: string) => selector.includes('accounts-profile-button')
        ? profiles
        : selector.includes('.flex.w-full') ? shareTargets : sidebars,
}
function sync(sharePage = false) {
    syncExporterMenu(
        menu as unknown as HTMLDivElement,
        documentFixture as unknown as Document,
        sharePage,
    )
}

// Changed layout with no original anchor, including repeated scans.
sync()
assert.equal(menu.parentElement, body)
assert.equal(menu.dataset.ceMenuMode, 'floating')
assert.ok(menu.classes.has('ce-menu-floating'))
for (let i = 0; i < 10; i++) sync()
assert.deepEqual(body.children, [menu])

// Original layout arrives later; preserve the same menu/state.
const nav = new FixtureElement()
const wrapper = new FixtureElement()
const profile = new FixtureElement()
body.append(nav)
nav.append(wrapper)
wrapper.append(profile)
profiles = [profile]
sync()
assert.deepEqual(nav.children, [menu, wrapper])
assert.equal(menu.dataset.ceMenuMode, 'sidebar')
assert.equal(menu.classes.has('ce-menu-floating'), false)
for (let i = 0; i < 10; i++) sync()
assert.deepEqual(nav.children, [menu, wrapper])

// Hidden sidebar and hidden first profile must not strand the menu.
profile.visible = false
sync()
assert.equal(menu.parentElement, body)
profile.visible = true
profile.visibility = 'hidden'
sync()
assert.equal(menu.parentElement, body)
profile.visibility = 'visible'
sync()
assert.equal(menu.parentElement, nav)

// Recognised non-scrolling sidebar with the original profile identifier absent.
profiles = []
sidebars = [nav]
sync()
assert.equal(menu.parentElement, nav)
assert.equal(menu.dataset.ceMenuMode, 'sidebar-fallback')
assert.ok(menu.classes.has('ce-menu-sidebar-slot'))
assert.equal(nav.lastElementChild, menu)
for (let i = 0; i < 10; i++) sync()
assert.equal(nav.children.filter(child => child === menu).length, 1)

// Short header navigation and overflowing lists are not sidebar mounting slots.
nav.rect.height = 80
sync()
assert.equal(menu.parentElement, body)
nav.rect.height = 600
nav.overflowY = 'auto'
nav.scrollHeight = 1200
sync()
assert.equal(menu.parentElement, body)
nav.scrollHeight = 600
sync()
assert.equal(menu.parentElement, nav)
nav.visible = false
sync()
assert.equal(menu.parentElement, body)
assert.equal(menu.classes.has('ce-menu-sidebar-slot'), false)
nav.visible = true
profiles = [profile]
sidebars = []

// A profile sharing a parent with other controls is mounted directly.
const extra = new FixtureElement()
wrapper.append(extra)
sync()
assert.deepEqual(wrapper.children, [menu, profile, extra])
for (let i = 0; i < 10; i++) sync()
assert.deepEqual(wrapper.children, [menu, profile, extra])
extra.remove()
sync()
sync()
assert.deepEqual(nav.children, [menu, wrapper])

// Replaced sidebar / removed menu recover without another menu instance.
profiles = []
nav.remove()
sync()
assert.equal(menu.parentElement, body)
menu.remove()
sync()
assert.equal(menu.parentElement, body)

// Shared page, unsupported share layout and route transitions.
const share = new FixtureElement()
body.append(share)
shareTargets = [share]
sync(true)
assert.equal(menu.parentElement, share)
assert.equal(menu.dataset.ceMenuMode, 'share')
sync(true)
assert.deepEqual(share.children, [menu])
share.visible = false
sync(true)
assert.equal(menu.dataset.ceMenuMode, 'floating')
share.visible = true
sync(false)
assert.equal(menu.parentElement, body)

// Ignore a hidden duplicate profile in favour of a visible one.
const hidden = new FixtureElement()
hidden.visible = false
body.append(nav)
profiles = [hidden, profile]
sync()
assert.equal(menu.parentElement, nav)
