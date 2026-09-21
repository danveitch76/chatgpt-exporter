import { strict as assert } from 'node:assert'
import {
    buildProjectManagementPreview,
    parseProjectManagementManifest,
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

const mixed = JSON.stringify([
    {
        action: 'moveConversation',
        id: 'chat-unassigned',
        expectedProjectId: null,
        newProjectId: 'g-p-one',
    },
    {
        action: 'moveConversation',
        id: 'chat-one',
        expectedProjectId: 'g-p-one',
        newProjectId: 'g-p-two',
    },
    {
        action: 'renameProject',
        id: 'g-p-two',
        expectedName: 'Two',
        newName: 'Two Renamed',
    },
])
let preview = buildProjectManagementPreview(mixed, conversations, projects)
assert.equal(preview.error, undefined)
assert.equal(preview.rows.length, 3)
assert.deepEqual(preview.rows[0], {
    action: 'moveConversation',
    id: 'chat-unassigned',
    label: 'Unassigned',
    originalValue: 'Not in a Project',
    proposedValue: 'One',
    changed: true,
    valid: true,
    originalProjectId: null,
    proposedProjectId: 'g-p-one',
})
assert.equal(preview.rows[1].action, 'moveConversation')
assert.equal(preview.rows[1].valid, true)
assert.equal(preview.rows[1].changed, true)
assert.deepEqual(preview.rows[2], {
    action: 'renameProject',
    id: 'g-p-two',
    label: 'Two',
    originalValue: 'Two',
    proposedValue: 'Two Renamed',
    changed: true,
    valid: true,
})

const alreadyMoved = JSON.stringify([
    {
        action: 'moveConversation',
        id: 'chat-one',
        expectedProjectId: null,
        newProjectId: 'g-p-one',
    },
])
preview = buildProjectManagementPreview(alreadyMoved, conversations, projects)
assert.equal(preview.rows[0].valid, true)
assert.equal(preview.rows[0].changed, false)

const stale = JSON.stringify([
    {
        action: 'moveConversation',
        id: 'chat-one',
        expectedProjectId: null,
        newProjectId: 'g-p-two',
    },
])
preview = buildProjectManagementPreview(stale, conversations, projects)
assert.equal(preview.rows[0].valid, false)
assert.equal(preview.rows[0].error, 'Current Project membership does not match expectedProjectId.')

const unknownProject = JSON.stringify([
    {
        action: 'moveConversation',
        id: 'chat-one',
        expectedProjectId: 'g-p-one',
        newProjectId: 'g-p-missing',
    },
])
preview = buildProjectManagementPreview(unknownProject, conversations, projects)
assert.equal(preview.rows[0].valid, false)
assert.equal(preview.rows[0].error, 'Destination Project is not loaded.')

const customGpt = JSON.stringify([
    {
        action: 'moveConversation',
        id: 'chat-custom-gpt',
        expectedProjectId: null,
        newProjectId: 'g-p-one',
    },
])
preview = buildProjectManagementPreview(customGpt, conversations, projects)
assert.equal(preview.rows[0].valid, false)
assert.equal(preview.rows[0].error, 'Conversation belongs to a non-Project gizmo and cannot be moved safely.')

const renameAlready = JSON.stringify([
    {
        action: 'renameProject',
        id: 'g-p-one',
        expectedName: 'Old One',
        newName: 'One',
    },
])
preview = buildProjectManagementPreview(renameAlready, conversations, projects)
assert.equal(preview.rows[0].valid, true)
assert.equal(preview.rows[0].changed, false)

const renameStale = JSON.stringify([
    {
        action: 'renameProject',
        id: 'g-p-one',
        expectedName: 'Wrong',
        newName: 'One Renamed',
    },
])
preview = buildProjectManagementPreview(renameStale, conversations, projects)
assert.equal(preview.rows[0].valid, false)
assert.equal(preview.rows[0].error, 'Current Project name does not match expectedName.')

const renameMissing = JSON.stringify([
    {
        action: 'renameProject',
        id: 'g-p-missing',
        expectedName: 'Missing',
        newName: 'Still Missing',
    },
])
preview = buildProjectManagementPreview(renameMissing, conversations, projects)
assert.equal(preview.rows[0].valid, false)
assert.equal(preview.rows[0].error, 'Project is not loaded.')

assert.throws(
    () => parseProjectManagementManifest(JSON.stringify([
        {
            action: 'moveConversation',
            id: 'chat-one',
            expectedProjectId: 'g-p-one',
            newProjectId: 'g-p-two',
        },
        {
            action: 'moveConversation',
            id: 'chat-one',
            expectedProjectId: 'g-p-two',
            newProjectId: 'g-p-one',
        },
    ])),
    /duplicate id/,
)
assert.throws(
    () => parseProjectManagementManifest(JSON.stringify([
        { action: 'unknown', id: 'chat-one' },
    ])),
    /requires action/,
)
assert.throws(
    () => parseProjectManagementManifest(JSON.stringify([
        { action: 'moveConversation', id: '', expectedProjectId: null, newProjectId: 'g-p-one' },
    ])),
    /requires an id/,
)
assert.throws(
    () => parseProjectManagementManifest(JSON.stringify([
        { action: 'moveConversation', id: 'chat-one', newProjectId: 'g-p-two' },
    ])),
    /requires expectedProjectId/,
)
assert.throws(
    () => parseProjectManagementManifest(JSON.stringify([
        { action: 'moveConversation', id: 'chat-one', expectedProjectId: 'g-p-one', newProjectId: '' },
    ])),
    /requires a destination newProjectId/,
)
assert.throws(
    () => parseProjectManagementManifest(JSON.stringify([
        { action: 'renameProject', id: 'g-p-one', expectedName: 'One', newName: '   ' },
    ])),
    /requires a non-empty newName/,
)
assert.throws(
    () => parseProjectManagementManifest(JSON.stringify([
        { action: 'renameProject', id: 'g-p-one', newName: 'One Renamed' },
    ])),
    /requires expectedName/,
)
assert.equal(
    buildProjectManagementPreview('{bad', conversations, projects).error,
    'Manifest must be valid JSON.',
)
