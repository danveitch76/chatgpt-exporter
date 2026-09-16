import { strict as assert } from 'node:assert'
import { transformConversationTitle } from '../ui/conversationTitleTransform'

const base = {
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
