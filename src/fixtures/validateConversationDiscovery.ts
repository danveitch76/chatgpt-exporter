import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

interface ConversationItem {
    id: string
}

function mergeUniqueConversationIds(sources: ConversationItem[][]): string[] {
    const seen = new Set<string>()
    const merged: string[] = []

    for (const source of sources) {
        for (const conversation of source) {
            if (seen.has(conversation.id)) continue
            seen.add(conversation.id)
            merged.push(conversation.id)
        }
    }

    return merged
}

const mainItems = [{ id: 'A' }, { id: 'B' }, { id: 'C' }]
const projectOneItems = [{ id: 'C' }, { id: 'D' }, { id: 'E' }]
const projectTwoItems = [{ id: 'F' }]

assert.deepEqual(
    mergeUniqueConversationIds([mainItems, projectOneItems, projectTwoItems]),
    ['A', 'B', 'C', 'D', 'E', 'F'],
    'All-conversation discovery must merge sources in order and deduplicate repeated conversation IDs.',
)

const apiPath = fileURLToPath(new URL('../api.ts', import.meta.url))
const apiSource = readFileSync(apiPath, 'utf8')
const aggregateFunctionMatch = apiSource.match(
    /export async function fetchAllConversationsAll\([\s\S]*?\n}\n\nexport async function archiveConversation/,
)

assert.ok(aggregateFunctionMatch, 'fetchAllConversationsAll must remain present in src/api.ts.')

const aggregateFunction = aggregateFunctionMatch[0]

assert.match(
    aggregateFunction,
    /const seen = new Set<string>\(\)/,
    'Aggregate discovery must track previously emitted conversation IDs.',
)
assert.match(
    aggregateFunction,
    /items\.filter\(c => !seen\.has\(c\.id\)\)/,
    'Aggregate discovery must filter duplicate conversation IDs before notifying the UI.',
)
assert.match(
    aggregateFunction,
    /await fetchAllConversations\(null, maxConversations, notify\)/,
    'Aggregate discovery must load the main conversation feed.',
)
assert.match(
    aggregateFunction,
    /for \(const project of projects\)[\s\S]*?await fetchAllConversations\(project\.id, maxConversations, notify\)/,
    'Aggregate discovery must load every Project feed with the same deduplicating notifier.',
)

// eslint-disable-next-line no-console
console.log('Conversation discovery regression fixture passed.')
