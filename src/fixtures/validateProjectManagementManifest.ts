import { strict as assert } from 'node:assert'
import {
    buildConversationProjectPreview,
    buildProjectRenamePreview,
    parseConversationProjectManifest,
    parseProjectRenameManifest,
} from '../ui/projectManagementManifest'

const projects = [
    { id: 'g-p-one', display: { name: 'One' } },
    { id: 'g-p-two', display: { name: 'Two' } },
]
const conversations = [
    { id: 'chat-unassigned', title: 'Unassigned', gizmo_id: null },
    { id: 'chat-one', title: 'In One', gizmo_id: 'g-p-one' },
    { id: 'chat-custom-gpt', title: 'Custom GPT', gizmo_id: 'g-custom' },
]

const assign = JSON.stringify([
    { id: 'chat-unassigned', expectedProjectId: null, newProjectId: 'g-p-one' },
])
let preview = buildConversationProjectPreview(assign, conversations, projects)
assert.equal(preview.error, undefined)
assert.deepEqual(preview.rows[0], {
    id: 'chat-unassigned',
    title: 'Unassigned',
    originalProjectId: null,
    proposedProjectId: 'g-p-one',
    changed: true,
    valid: true,
})

const move = JSON.stringify([
    { id: 'chat-one', expectedProjectId: 'g-p-one', newProjectId: 'g-p-two' },
])
preview = buildConversationProjectPreview(move, conversations, projects)
assert.equal(preview.rows[0].valid, true)
assert.equal(preview.rows[0].changed, true)

const alreadyMoved = JSON.stringify([
    { id: 'chat-one', expectedProjectId: null, newProjectId: 'g-p-one' },
])
preview = buildConversationProjectPreview(alreadyMoved, conversations, projects)
assert.equal(preview.rows[0].valid, true)
assert.equal(preview.rows[0].changed, false)

const stale = JSON.stringify([
    { id: 'chat-one', expectedProjectId: null, newProjectId: 'g-p-two' },
])
preview = buildConversationProjectPreview(stale, conversations, projects)
assert.equal(preview.rows[0].valid, false)
assert.equal(preview.rows[0].error, 'Current Project membership does not match expectedProjectId.')

const unknownProject = JSON.stringify([
    { id: 'chat-one', expectedProjectId: 'g-p-one', newProjectId: 'g-p-missing' },
])
preview = buildConversationProjectPreview(unknownProject, conversations, projects)
assert.equal(preview.rows[0].valid, false)
assert.equal(preview.rows[0].error, 'Destination Project is not loaded.')

const customGptAsNoProject = JSON.stringify([
    { id: 'chat-custom-gpt', expectedProjectId: null, newProjectId: 'g-p-one' },
])
preview = buildConversationProjectPreview(customGptAsNoProject, conversations, projects)
assert.equal(preview.rows[0].valid, false)
assert.equal(preview.rows[0].error, 'Conversation belongs to a non-Project gizmo and cannot be moved safely.')

assert.throws(
    () => parseConversationProjectManifest(JSON.stringify([
        { id: 'chat-one', expectedProjectId: 'g-p-one', newProjectId: 'g-p-two' },
        { id: 'chat-one', expectedProjectId: 'g-p-two', newProjectId: 'g-p-one' },
    ])),
    /duplicate conversation id/,
)
assert.throws(
    () => parseConversationProjectManifest(JSON.stringify([
        { id: '', expectedProjectId: null, newProjectId: 'g-p-one' },
    ])),
    /requires a conversation id/,
)
assert.throws(
    () => parseConversationProjectManifest(JSON.stringify([
        { id: 'chat-one', newProjectId: 'g-p-two' },
    ])),
    /requires expectedProjectId/,
)
assert.throws(
    () => parseConversationProjectManifest(JSON.stringify([
        { id: 'chat-one', expectedProjectId: 'g-p-one', newProjectId: '' },
    ])),
    /requires a destination newProjectId/,
)
assert.equal(buildConversationProjectPreview('{bad', conversations, projects).error, 'Manifest must be valid JSON.')

const rename = JSON.stringify([
    { id: 'g-p-one', expectedName: 'One', newName: 'One Renamed' },
])
let renamePreview = buildProjectRenamePreview(rename, projects)
assert.equal(renamePreview.error, undefined)
assert.deepEqual(renamePreview.rows[0], {
    id: 'g-p-one',
    originalName: 'One',
    proposedName: 'One Renamed',
    changed: true,
    valid: true,
})

const renameAlready = JSON.stringify([
    { id: 'g-p-one', expectedName: 'Old One', newName: 'One' },
])
renamePreview = buildProjectRenamePreview(renameAlready, projects)
assert.equal(renamePreview.rows[0].valid, true)
assert.equal(renamePreview.rows[0].changed, false)

const renameStale = JSON.stringify([
    { id: 'g-p-one', expectedName: 'Wrong', newName: 'One Renamed' },
])
renamePreview = buildProjectRenamePreview(renameStale, projects)
assert.equal(renamePreview.rows[0].valid, false)
assert.equal(renamePreview.rows[0].error, 'Current Project name does not match expectedName.')

const renameMissing = JSON.stringify([
    { id: 'g-p-missing', expectedName: 'Missing', newName: 'Still Missing' },
])
renamePreview = buildProjectRenamePreview(renameMissing, projects)
assert.equal(renamePreview.rows[0].valid, false)
assert.equal(renamePreview.rows[0].error, 'Project is not loaded.')

assert.throws(
    () => parseProjectRenameManifest(JSON.stringify([
        { id: 'g-p-one', expectedName: 'One', newName: 'One A' },
        { id: 'g-p-one', expectedName: 'One A', newName: 'One B' },
    ])),
    /duplicate Project id/,
)
assert.throws(
    () => parseProjectRenameManifest(JSON.stringify([
        { id: '', expectedName: 'One', newName: 'One A' },
    ])),
    /requires a Project id/,
)
assert.throws(
    () => parseProjectRenameManifest(JSON.stringify([
        { id: 'g-p-one', expectedName: 'One', newName: '   ' },
    ])),
    /requires a non-empty newName/,
)
assert.equal(buildProjectRenamePreview('{bad', projects).error, 'Manifest must be valid JSON.')
