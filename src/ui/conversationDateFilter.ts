export type ConversationDateField = 'create_time' | 'update_time'

export interface ConversationDateLike {
    create_time?: number | string
    update_time?: number | string
}

/**
 * Normalise ChatGPT conversation timestamps to milliseconds.
 *
 * Current API responses use ISO-8601 strings while older/exported data may use
 * Unix seconds. Invalid or missing values return 0 so callers can exclude them
 * when a date constraint is active.
 */
export function conversationTimeToMs(time: number | string | undefined): number {
    if (time == null) return 0
    if (typeof time === 'number') {
        const ms = time * 1000
        return Number.isFinite(ms) ? ms : 0
    }
    const ms = new Date(time).getTime()
    return Number.isNaN(ms) ? 0 : ms
}

function localDateBoundary(date: string, endOfDay: boolean): number | null {
    if (!date) return null
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
    if (!match) return null

    const year = Number(match[1])
    const month = Number(match[2]) - 1
    const day = Number(match[3])
    const boundary = endOfDay
        ? new Date(year, month, day, 23, 59, 59, 999)
        : new Date(year, month, day, 0, 0, 0, 0)

    // Reject impossible dates such as 2026-02-31 rather than silently rolling.
    if (
        boundary.getFullYear() !== year
        || boundary.getMonth() !== month
        || boundary.getDate() !== day
    ) return null

    return boundary.getTime()
}

/**
 * Return true when a conversation falls within the inclusive local-date range.
 * Empty From/To values leave that side unbounded. If either active bound is
 * invalid, no conversations match until the user corrects or clears it.
 */
export function conversationMatchesDateRange(
    conversation: ConversationDateLike,
    field: ConversationDateField,
    fromDate: string,
    toDate: string,
): boolean {
    if (!fromDate && !toDate) return true

    const fromMs = localDateBoundary(fromDate, false)
    const toMs = localDateBoundary(toDate, true)
    if ((fromDate && fromMs == null) || (toDate && toMs == null)) return false
    if (fromMs != null && toMs != null && fromMs > toMs) return false

    const valueMs = conversationTimeToMs(conversation[field])
    if (valueMs <= 0) return false
    if (fromMs != null && valueMs < fromMs) return false
    if (toMs != null && valueMs > toMs) return false
    return true
}
