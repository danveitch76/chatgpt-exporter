import { strict as assert } from 'node:assert'
import { buildRenameManifestPreview, parseRenameManifest } from '../ui/conversationRenameManifest'
import { transformConversationTitle } from '../ui/conversationTitleTransform'

const base = {
    text: '',
    replacement: '',
    caseSensitive: false,
}

assert.deepEqual(
    transformConversationTitle('Project Audit', { ...base, operation: 'prefix', text: 'COMPLETE - ' }),
    {
        originalTitle: 'Project Audit',
        proposedTitle: 'COMPLETE - Project Audit',
        changed: true,
        valid: true,
    },
)

assert.deepEqual(
    transformConversationTitle('Project Audit', { ...base, operation: 'suffix', text: ' - ARCHIVE' }),
    {
        originalTitle: 'Project Audit',
        proposedTitle: 'Project Audit - ARCHIVE',
        changed: true,
        valid: true,
    },
)

assert.equal(
    transformConversationTitle('TODO - TODO - Project Audit', {
        ...base,
        operation: 'replace',
        text: 'TODO',
        replacement: 'ACTIVE',
    }).proposedTitle,
    'ACTIVE - ACTIVE - Project Audit',
)

assert.equal(
    transformConversationTitle('Todo - TODO - Project Audit', {
        ...base,
        operation: 'replace',
        text: 'TODO',
        replacement: 'ACTIVE',
        caseSensitive: false,
    }).proposedTitle,
    'ACTIVE - ACTIVE - Project Audit',
)

assert.equal(
    transformConversationTitle('Todo - TODO - Project Audit', {
        ...base,
        operation: 'replace',
        text: 'TODO',
        replacement: 'ACTIVE',
        caseSensitive: true,
    }).proposedTitle,
    'Todo - ACTIVE - Project Audit',
)

assert.equal(
    transformConversationTitle('COMPLETE - Project Audit', {
        ...base,
        operation: 'replace',
        text: 'COMPLETE - ',
        replacement: '',
    }).proposedTitle,
    'Project Audit',
)

const noMatch = transformConversationTitle('Project Audit', {
    ...base,
    operation: 'replace',
    text: 'TODO',
    replacement: 'ACTIVE',
})
assert.equal(noMatch.changed, false)
assert.equal(noMatch.valid, true)

const missingFind = transformConversationTitle('Project Audit', {
    ...base,
    operation: 'replace',
    text: '',
    replacement: 'ACTIVE',
})
assert.equal(missingFind.valid, false)
assert.equal(missingFind.error, 'Find text is required.')

const emptyResult = transformConversationTitle('REMOVE', {
    ...base,
    operation: 'replace',
    text: 'REMOVE',
    replacement: '',
})
assert.equal(emptyResult.changed, true)
assert.equal(emptyResult.valid, false)
assert.equal(emptyResult.error, 'Resulting title cannot be empty.')

const whitespaceResult = transformConversationTitle('Project Audit', {
    ...base,
    operation: 'replace',
    text: 'Project Audit',
    replacement: '   ',
})
assert.equal(whitespaceResult.valid, false)

const regexCharacters = transformConversationTitle('A [draft] + notes', {
    ...base,
    operation: 'replace',
    text: '[draft] +',
    replacement: 'final',
})
assert.equal(regexCharacters.proposedTitle, 'A final notes')

const literalReplacement = transformConversationTitle('TODO - Project Audit', {
    ...base,
    operation: 'replace',
    text: 'TODO',
    replacement: '$& $1 $$',
})
assert.equal(literalReplacement.proposedTitle, '$& $1 $$ - Project Audit')

assert.equal(
    transformConversationTitle('Mixed CASE Title', { ...base, operation: 'lowercase' }).proposedTitle,
    'mixed case title',
)
assert.equal(
    transformConversationTitle('Mixed CASE Title', { ...base, operation: 'uppercase' }).proposedTitle,
    'MIXED CASE TITLE',
)
assert.equal(
    transformConversationTitle('chatGPT exporter - POWERshell', { ...base, operation: 'propercase' }).proposedTitle,
    'Chatgpt Exporter - Powershell',
)

const statusCases: Array<[string, string]> = [
    ['active - Example', 'ACTIVE - Example'],
    ['to do - Example', 'TO DO - Example'],
    ['todo - Example', 'TO DO - Example'],
    ['waiting - Example', 'WAITING - Example'],
    ['on hold - Example', 'ON HOLD - Example'],
    ['complete - Example', 'COMPLETE - Example'],
    ['retired - Example', 'RETIRED - Example'],
    ['no - Example', 'NO - Example'],
    ['rejected - Example', 'REJECTED - Example'],
]
for (const [input, expected] of statusCases) {
    assert.equal(
        transformConversationTitle(input, { ...base, operation: 'status' }).proposedTitle,
        expected,
    )
}
assert.equal(
    transformConversationTitle('Branch · todo - Example', { ...base, operation: 'status' }).proposedTitle,
    'Branch · TO DO - Example',
)
assert.equal(
    transformConversationTitle('TLDR Example', { ...base, operation: 'status' }).proposedTitle,
    'TLDR Example',
)

const manifest = JSON.stringify([
    { id: 'one', expectedTitle: 'Old title', newTitle: 'New title' },
])
const manifestPreview = buildRenameManifestPreview(manifest, [{ id: 'one', title: 'Old title' }])
assert.equal(manifestPreview.error, undefined)
assert.deepEqual(manifestPreview.rows, [{
    id: 'one',
    originalTitle: 'Old title',
    proposedTitle: 'New title',
    changed: true,
    valid: true,
}])

const alreadyApplied = buildRenameManifestPreview(manifest, [{ id: 'one', title: 'New title' }])
assert.equal(alreadyApplied.rows[0].valid, true)
assert.equal(alreadyApplied.rows[0].changed, false)

const stale = buildRenameManifestPreview(manifest, [{ id: 'one', title: 'Unexpected title' }])
assert.equal(stale.rows[0].valid, false)
assert.equal(stale.rows[0].error, 'Current title does not match expectedTitle.')

const missing = buildRenameManifestPreview(manifest, [])
assert.equal(missing.rows[0].valid, false)
assert.equal(missing.rows[0].error, 'Conversation is not loaded in the current scope.')

assert.throws(
    () => parseRenameManifest(JSON.stringify([
        { id: 'one', expectedTitle: 'A', newTitle: 'B' },
        { id: 'one', expectedTitle: 'B', newTitle: 'C' },
    ])),
    /duplicate conversation id/,
)
assert.throws(
    () => parseRenameManifest(JSON.stringify([
        { id: ' ', expectedTitle: 'A', newTitle: 'B' },
    ])),
    /requires a conversation id/,
)
assert.throws(
    () => parseRenameManifest(JSON.stringify([
        { id: 'one', expectedTitle: 'A', newTitle: '   ' },
    ])),
    /requires a non-empty newTitle/,
)
assert.equal(buildRenameManifestPreview('{not-json', []).error, 'Manifest must be valid JSON.')
