import assert from 'node:assert/strict'

function conversation(id: string, gizmoId?: string) {
    return {
        id,
        title: `Conversation ${id}`,
        create_time: '2026-08-25T12:00:00.000Z',
        gizmo_id: gizmoId ?? null,
    }
}

const mainItems = [conversation('A'), conversation('B'), conversation('C', 'project-1')]
const projectOneItems = [conversation('C', 'project-1'), conversation('D', 'project-1'), conversation('E', 'project-1')]
const projectTwoItems = [conversation('F', 'project-2')]

const requestedConversationSources: string[] = []

Object.defineProperty(globalThis, 'location', {
    configurable: true,
    value: new URL('https://chatgpt.com/'),
})

Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis,
})

Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { cookie: '' },
})

globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url)

    if (url.pathname === '/api/auth/session') {
        return Response.json({ accessToken: 'fixture-token' })
    }

    if (url.pathname === '/backend-api/accounts/check/v4-2023-04-27') {
        return Response.json({ accounts: {}, account_ordering: [] })
    }

    if (url.pathname === '/backend-api/conversations') {
        requestedConversationSources.push('main')
        assert.equal(url.searchParams.get('offset'), '0')
        assert.equal(url.searchParams.get('limit'), '100')
        return Response.json({
            has_missing_conversations: false,
            items: mainItems,
            limit: 100,
            offset: 0,
            total: mainItems.length,
            cursor: null,
        })
    }

    const projectMatch = url.pathname.match(/^\/backend-api\/gizmos\/([^/]+)\/conversations$/)
    if (projectMatch) {
        const projectId = projectMatch[1]
        requestedConversationSources.push(projectId)
        assert.equal(url.searchParams.get('limit'), '50')

        if (projectId === 'project-1') {
            return Response.json({ items: projectOneItems, cursor: null })
        }
        if (projectId === 'project-2') {
            return Response.json({ items: projectTwoItems, cursor: null })
        }
    }

    throw new Error(`Unexpected fixture request: ${url.toString()}`)
}) as typeof fetch

const { fetchAllConversationsAll } = await import('../api')

const projects = [
    {
        id: 'project-1',
        organization_id: 'org-1',
        display: { name: 'Project One', description: '' },
    },
    {
        id: 'project-2',
        organization_id: 'org-1',
        display: { name: 'Project Two', description: '' },
    },
]

const discoveredIds: string[] = []
await fetchAllConversationsAll(projects, 1000, (batch) => {
    discoveredIds.push(...batch.map(item => item.id))
})

assert.deepEqual(
    requestedConversationSources,
    ['main', 'project-1', 'project-2'],
    'All-conversation discovery must query the main feed and every Project feed exactly once.',
)
assert.deepEqual(
    discoveredIds,
    ['A', 'B', 'C', 'D', 'E', 'F'],
    'All-conversation discovery must merge every source and deduplicate repeated conversation IDs.',
)
assert.equal(
    discoveredIds.filter(id => id === 'C').length,
    1,
    'A conversation returned by both the main feed and a Project feed must appear only once.',
)

// eslint-disable-next-line no-console
console.log('Conversation discovery regression fixture passed.')
