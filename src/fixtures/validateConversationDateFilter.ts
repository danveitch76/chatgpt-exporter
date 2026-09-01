import { strict as assert } from 'node:assert'
import { conversationMatchesDateRange, conversationTimeToMs } from '../ui/conversationDateFilter'

const localIso = (year: number, month: number, day: number, hour = 12) => new Date(year, month - 1, day, hour, 0, 0, 0).toISOString()

assert.equal(conversationTimeToMs(1_700_000_000), 1_700_000_000_000)
assert.equal(conversationTimeToMs('not-a-date'), 0)
assert.equal(conversationTimeToMs(undefined), 0)

const conversation = {
    create_time: localIso(2026, 8, 10),
    update_time: localIso(2026, 8, 20),
}

// Inclusive boundaries.
assert.equal(conversationMatchesDateRange(conversation, 'create_time', '2026-08-10', '2026-08-10'), true)
assert.equal(conversationMatchesDateRange(conversation, 'update_time', '2026-08-20', '2026-08-20'), true)

// Created vs last-updated selection.
assert.equal(conversationMatchesDateRange(conversation, 'create_time', '2026-08-15', '2026-08-25'), false)
assert.equal(conversationMatchesDateRange(conversation, 'update_time', '2026-08-15', '2026-08-25'), true)

// Open-ended ranges.
assert.equal(conversationMatchesDateRange(conversation, 'create_time', '2026-08-01', ''), true)
assert.equal(conversationMatchesDateRange(conversation, 'create_time', '2026-08-11', ''), false)
assert.equal(conversationMatchesDateRange(conversation, 'update_time', '', '2026-08-20'), true)
assert.equal(conversationMatchesDateRange(conversation, 'update_time', '', '2026-08-19'), false)

// Legacy Unix-second timestamps.
const legacy = {
    create_time: Math.floor(new Date(2026, 7, 12, 9, 30).getTime() / 1000),
    update_time: Math.floor(new Date(2026, 7, 22, 9, 30).getTime() / 1000),
}
assert.equal(conversationMatchesDateRange(legacy, 'create_time', '2026-08-12', '2026-08-12'), true)
assert.equal(conversationMatchesDateRange(legacy, 'update_time', '2026-08-22', '2026-08-22'), true)

// Missing/invalid timestamps do not match an active date filter.
assert.equal(conversationMatchesDateRange({}, 'create_time', '2026-08-01', ''), false)
assert.equal(conversationMatchesDateRange({ create_time: 'invalid' }, 'create_time', '2026-08-01', ''), false)

// Invalid/reversed ranges fail closed.
assert.equal(conversationMatchesDateRange(conversation, 'create_time', '2026-02-31', ''), false)
assert.equal(conversationMatchesDateRange(conversation, 'create_time', '2026-08-20', '2026-08-10'), false)

// No date criterion leaves the conversation unfiltered, including missing timestamps.
assert.equal(conversationMatchesDateRange({}, 'create_time', '', ''), true)
