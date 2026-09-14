import assert from 'node:assert/strict'
import {
    buildChatInventoryRows,
    buildProjectInventoryRows,
    buildProjectToken,
    normaliseGizmoId,
    serialiseInventoryHtml,
    serialiseInventoryJson,
    serialiseInventoryMarkdown,
    serialiseInventoryText,
    slugifyInventoryName,
} from '../exporter/inventory'
import type { ApiConversationItem, ApiProjectInfo } from '../api'

const projects: ApiProjectInfo[] = [
    {
        id: 'g-p-68aecdb11a0881919c9cba50a8ac05b8',
        organization_id: 'org-1',
        display: {
            name: 'Windows 11 First Boot Setup',
            description: '',
        },
    },
    {
        id: 'g-p-6a7b74e2095881919288ff18dc08b1e9-github-chatgpt-exporter',
        organization_id: 'org-1',
        display: {
            name: 'GitHub - ChatGPT Exporter',
            description: '',
        },
    },
    {
        id: 'g-p-6a7b74e2095881919288ff18dc08b1e9-github-chatgpt-exporter',
        organization_id: 'org-1',
        display: {
            name: 'Duplicate should be suppressed',
            description: '',
        },
    },
]

const conversations: ApiConversationItem[] = [
    {
        id: '6a0dc2f5-1950-83eb-9a54-e9e6f9391e3c',
        title: 'TODO Raspberry Pi Travel Router',
        create_time: '2026-01-01T10:00:00Z',
        update_time: '2026-01-02T10:00:00Z',
        gizmo_id: 'g-p-68aecdb11a0881919c9cba50a8ac05b8',
    },
    {
        id: '68a19df3-adb0-832d-89ba-24d39678baff',
        title: 'Chat list | in markdown',
        create_time: '2026-02-01T10:00:00Z',
        update_time: '2026-02-02T10:00:00Z',
        gizmo_id: 'g-p-ffffffffffffffffffffffffffffffff-unknown-project',
    },
    {
        id: '6a0dc2f5-1950-83eb-9a54-e9e6f9391e3c',
        title: 'Duplicate should be suppressed',
        create_time: '2026-03-01T10:00:00Z',
        gizmo_id: null,
    },
]

assert.equal(slugifyInventoryName('GitHub - ChatGPT Exporter'), 'github-chatgpt-exporter')
assert.equal(slugifyInventoryName('Dan’s Café / Notes'), 'dans-cafe-notes')
assert.equal(
    normaliseGizmoId('g-p-68aecdb11a0881919c9cba50a8ac05b8-windows-11-first-boot-setup'),
    'g-p-68aecdb11a0881919c9cba50a8ac05b8',
)
assert.equal(
    buildProjectToken('g-p-68aecdb11a0881919c9cba50a8ac05b8', 'Windows 11 First Boot Setup'),
    'g-p-68aecdb11a0881919c9cba50a8ac05b8-windows-11-first-boot-setup',
)
assert.equal(
    buildProjectToken(
        'g-p-6a7b74e2095881919288ff18dc08b1e9-github-chatgpt-exporter',
        'Changed display name',
    ),
    'g-p-6a7b74e2095881919288ff18dc08b1e9-github-chatgpt-exporter',
)

const projectRows = buildProjectInventoryRows(projects)
assert.equal(projectRows.length, 2)
assert.deepEqual(projectRows[0], {
    URL: 'https://chatgpt.com/g/g-p-68aecdb11a0881919c9cba50a8ac05b8-windows-11-first-boot-setup/project',
    Token: 'g-p-68aecdb11a0881919c9cba50a8ac05b8-windows-11-first-boot-setup',
    GizmoID: 'g-p-68aecdb11a0881919c9cba50a8ac05b8',
    Slug: 'windows-11-first-boot-setup',
    'Actual Project Name': 'Windows 11 First Boot Setup',
})

const renamedProjectRows = buildProjectInventoryRows([{
    id: 'g-p-6a7b74e2095881919288ff18dc08b1e9-github-chatgpt-exporter',
    organization_id: 'org-1',
    display: {
        name: 'Renamed Project',
        description: '',
    },
}])
assert.equal(renamedProjectRows[0].Slug, 'github-chatgpt-exporter')
assert.equal(renamedProjectRows[0].Token, 'g-p-6a7b74e2095881919288ff18dc08b1e9-github-chatgpt-exporter')
assert.equal(renamedProjectRows[0]['Actual Project Name'], 'Renamed Project')

const allowed = new Set(['g-p-6a7b74e2095881919288ff18dc08b1e9'])
const filteredProjects = buildProjectInventoryRows(projects, allowed)
assert.equal(filteredProjects.length, 1)
assert.equal(filteredProjects[0]['Actual Project Name'], 'GitHub - ChatGPT Exporter')

const chatRows = buildChatInventoryRows(conversations, projects)
assert.equal(chatRows.length, 2)
assert.deepEqual(chatRows[0], {
    URL: 'https://chatgpt.com/c/6a0dc2f5-1950-83eb-9a54-e9e6f9391e3c',
    Token: '6a0dc2f5-1950-83eb-9a54-e9e6f9391e3c',
    Slug: 'todo-raspberry-pi-travel-router',
    'Actual Chat Name': 'TODO Raspberry Pi Travel Router',
    'Project Name': 'Windows 11 First Boot Setup',
})
assert.equal(chatRows[1]['Project Name'], '')

const json = serialiseInventoryJson(projectRows)
assert.deepEqual(JSON.parse(json), projectRows)

const text = serialiseInventoryText('chats', chatRows)
assert.match(text, /^URL\tToken\tSlug\tActual Chat Name\tProject Name\n/)
assert.ok(text.includes('TODO Raspberry Pi Travel Router'))

const html = serialiseInventoryHtml('projects', [{
    URL: 'https://example.test/?a=1&b=2',
    Token: '<token>',
    GizmoID: 'g-p-test',
    Slug: 'example',
    'Actual Project Name': 'A <Project> & "Name"',
}])
assert.ok(html.includes('https://example.test/?a=1&amp;b=2'))
assert.ok(html.includes('A &lt;Project&gt; &amp; &quot;Name&quot;'))
assert.ok(!html.includes('<token>'))

const markdown = serialiseInventoryMarkdown('chats', chatRows)
assert.ok(markdown.includes('| URL | Token | Slug | Actual Chat Name | Project Name |'))
assert.ok(markdown.includes('Chat list \\| in markdown'))

console.log('Inventory export validation passed.')
