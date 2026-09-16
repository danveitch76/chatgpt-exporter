import * as Dialog from '@radix-ui/react-dialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import {
    fetchAllConversations,
    fetchAllConversationsAll,
    fetchAllNonProjectConversations,
    fetchProjects,
} from '../api'
import { renameConversation } from '../conversationRename'
import { RequestQueue } from '../utils/queue'
import { CheckBox } from './CheckBox'
import { conversationMatchesDateRange } from './conversationDateFilter'
import { transformConversationTitle } from './conversationTitleTransform'
import { IconCross, IconLoading } from './Icons'
import { useSettingContext } from './SettingContext'
import type { ApiConversationItem, ApiProjectInfo } from '../api'
import type { RenameConversationResult } from '../conversationRename'
import type { FC } from '../type'
import type { RenameOperation } from './conversationTitleTransform'

const NOT_IN_PROJECT_ID = '__not_in_project__'

interface BulkRenameDialogProps {
    open: boolean
    onOpenChange: (value: boolean) => void
}

interface RenamePreviewRow {
    id: string
    originalTitle: string
    proposedTitle: string
    changed: boolean
    valid: boolean
    error?: string
}

interface RenameSummary {
    renamed: number
    unchanged: number
    invalid: number
    failed: number
}

function toMs(time: number | string | undefined): number {
    if (time == null) return 0
    if (typeof time === 'number') return time * 1000
    const parsed = new Date(time).getTime()
    return Number.isNaN(parsed) ? 0 : parsed
}

function formatDate(time: number | string | undefined): string {
    const ms = toMs(time)
    if (!ms) return '—'
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function textSearch(title: string, query: string): boolean {
    const q = query.trim()
    if (!q) return true
    const lower = q.toLowerCase()
    if (!lower.includes('*') && !lower.includes('?')) {
        return title.toLowerCase().includes(lower)
    }

    const regexSource = lower
        .replace(/[\\\^$.|+()[\]{}]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')

    try {
        return new RegExp(regexSource).test(title.toLowerCase())
    }
    catch {
        return title.toLowerCase().includes(lower)
    }
}

function mergeUniqueConversations(
    existing: ApiConversationItem[],
    incoming: ApiConversationItem[],
): ApiConversationItem[] {
    const byId = new Map(existing.map(conversation => [conversation.id, conversation]))
    for (const conversation of incoming) {
        byId.set(conversation.id, conversation)
    }
    return [...byId.values()]
}

export const BulkRenameDialog: FC<BulkRenameDialogProps> = ({ open, onOpenChange, children }) => {
    const { exportAllLimit } = useSettingContext()
    const [projects, setProjects] = useState<ApiProjectInfo[]>([])
    const [projectsLoaded, setProjectsLoaded] = useState(false)
    const [projectsLoading, setProjectsLoading] = useState(false)
    const [conversations, setConversations] = useState<ApiConversationItem[]>([])
    const [selected, setSelected] = useState<ApiConversationItem[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
    const [dateField, setDateField] = useState<'create_time' | 'update_time'>('update_time')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [query, setQuery] = useState('')
    const [sortField, setSortField] = useState<'title' | 'create_time' | 'update_time'>('update_time')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const [operation, setOperation] = useState<RenameOperation>('prefix')
    const [text, setText] = useState('')
    const [replacement, setReplacement] = useState('')
    const [caseSensitive, setCaseSensitive] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [summary, setSummary] = useState<RenameSummary | null>(null)
    const [progress, setProgress] = useState({ total: 0, completed: 0, currentName: '' })

    const renameQueue = useMemo(() => new RequestQueue<RenameConversationResult>(200, 1600), [])
    const pendingPlanRef = useRef<RenamePreviewRow[]>([])
    const pendingUnchangedRef = useRef(0)
    const pendingInvalidRef = useRef(0)

    const projectIds = useMemo(() => projects.map(project => project.id), [projects])
    const isNotInProject = selectedProjectId === NOT_IN_PROJECT_ID

    useEffect(() => {
        if (!open) return
        setProjectsLoading(true)
        setProjectsLoaded(false)
        setError('')
        setSummary(null)

        fetchProjects()
            .then((items) => {
                setProjects(items)
                setProjectsLoaded(true)
            })
            .catch((err: Error) => {
                console.error('Error fetching projects for bulk rename:', err)
                setProjects([])
                setProjectsLoaded(false)
                setError(err.message || 'Failed to load projects')
            })
            .finally(() => setProjectsLoading(false))
    }, [open])

    useEffect(() => {
        if (!open || !projectsLoaded || processing) return

        let cancelled = false
        const alive = () => !cancelled
        setConversations([])
        setSelected([])
        setSummary(null)
        setError('')
        setLoading(true)

        const onBatch = (batch: ApiConversationItem[]) => {
            if (!alive()) return
            setConversations(previous => mergeUniqueConversations(previous, batch))
        }

        const load = async () => {
            if (selectedProjectId === null) {
                await fetchAllConversationsAll(projects, exportAllLimit, onBatch)
                return
            }

            if (isNotInProject) {
                await fetchAllNonProjectConversations(projectIds, exportAllLimit, onBatch)
                return
            }

            await fetchAllConversations(selectedProjectId, exportAllLimit, onBatch)
        }

        load()
            .catch((err: Error) => {
                if (!alive()) return
                console.error('Error fetching conversations for bulk rename:', err)
                setError(err.message || 'Failed to load conversations')
            })
            .finally(() => {
                if (alive()) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [exportAllLimit, isNotInProject, open, processing, projectIds, projects, projectsLoaded, selectedProjectId])

    const filtered = useMemo(() => {
        let result = conversations
        if (query.trim()) result = result.filter(conversation => textSearch(conversation.title ?? '', query))
        if (fromDate || toDate) {
            result = result.filter(conversation => conversationMatchesDateRange(conversation, dateField, fromDate, toDate))
        }

        const dir = sortDir === 'asc' ? 1 : -1
        return [...result].sort((a, b) => {
            if (sortField === 'title') return dir * (a.title ?? '').localeCompare(b.title ?? '')
            const aValue = toMs(sortField === 'update_time' ? a.update_time : a.create_time)
            const bValue = toMs(sortField === 'update_time' ? b.update_time : b.create_time)
            return dir * (aValue - bValue)
        })
    }, [conversations, dateField, fromDate, query, sortDir, sortField, toDate])

    const transform = useMemo(() => ({
        operation,
        text,
        replacement,
        caseSensitive,
    }), [caseSensitive, operation, replacement, text])

    const preview = useMemo<RenamePreviewRow[]>(() => selected.map((conversation) => {
        const result = transformConversationTitle(conversation.title ?? '', transform)
        return {
            id: conversation.id,
            ...result,
        }
    }), [selected, transform])

    const previewCounts = useMemo(() => preview.reduce((counts, row) => {
        if (!row.valid) counts.invalid++
        else if (row.changed) counts.changed++
        else counts.unchanged++
        return counts
    }, { changed: 0, unchanged: 0, invalid: 0 }), [preview])

    const allFilteredSelected = filtered.length > 0 && filtered.every(item => selected.some(selectedItem => selectedItem.id === item.id))

    useEffect(() => {
        const off = renameQueue.on('progress', (event) => {
            setProgress({
                total: event.total,
                completed: event.completed,
                currentName: event.currentName,
            })
        })
        return () => off()
    }, [renameQueue])

    useEffect(() => {
        const off = renameQueue.on('done', (results) => {
            const planned = pendingPlanRef.current
            const successById = new Map(results.map(result => [result.id, result.title]))
            const failedIds = new Set(planned.filter(item => !successById.has(item.id)).map(item => item.id))

            if (successById.size > 0) {
                setConversations(previous => previous.map((conversation) => {
                    const renamed = successById.get(conversation.id)
                    return renamed === undefined ? conversation : { ...conversation, title: renamed }
                }))
            }

            setSelected(previous => previous.filter(conversation => failedIds.has(conversation.id)))
            setSummary({
                renamed: results.length,
                unchanged: pendingUnchangedRef.current,
                invalid: pendingInvalidRef.current,
                failed: Math.max(0, planned.length - results.length),
            })
            setProcessing(false)
            pendingPlanRef.current = []
        })
        return () => off()
    }, [renameQueue])

    useEffect(() => () => renameQueue.clear(), [renameQueue])

    const applyRename = useCallback(() => {
        if (processing || previewCounts.invalid > 0 || previewCounts.changed === 0) return

        const plan = preview.filter(row => row.valid && row.changed)
        if (!confirm(`Rename ${plan.length} selected conversation${plan.length === 1 ? '' : 's'} using the previewed titles?`)) return

        pendingPlanRef.current = plan
        pendingUnchangedRef.current = previewCounts.unchanged
        pendingInvalidRef.current = previewCounts.invalid
        setSummary(null)
        setProcessing(true)
        setProgress({ total: plan.length, completed: 0, currentName: '' })
        renameQueue.clear()
        for (const item of plan) {
            renameQueue.add({
                name: item.originalTitle,
                request: () => renameConversation(item.id, item.proposedTitle),
            })
        }
        renameQueue.start()
    }, [preview, previewCounts, processing, renameQueue])

    const closeGuarded = useCallback((value: boolean) => {
        if (!processing) onOpenChange(value)
    }, [onOpenChange, processing])

    const statusText = error
        ? `Error: ${error}`
        : processing
            ? `Renaming ${progress.completed} / ${progress.total}`
            : projectsLoading
                ? 'Loading projects...'
                : loading
                    ? 'Loading conversations...'
                    : summary
                        ? `Renamed ${summary.renamed}; unchanged ${summary.unchanged}; invalid ${summary.invalid}; failed ${summary.failed}`
                        : `${selected.length} selected / ${filtered.length} visible`

    const statusDetail = processing
        ? progress.currentName
        : !error && !loading && !projectsLoading
            ? `${conversations.length} conversations loaded · source scan limit ${exportAllLimit}`
            : ''

    return (
        <Dialog.Root open={open} onOpenChange={closeGuarded}>
            <Dialog.Trigger asChild>{children}</Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="DialogOverlay" />
                <Dialog.Content
                    className="DialogContent _export"
                    onEscapeKeyDown={event => processing && event.preventDefault()}
                    onPointerDownOutside={event => processing && event.preventDefault()}
                >
                    <Dialog.Title className="DialogTitle">Bulk Rename Conversations</Dialog.Title>

                    <div className="ExportStatusBox" role="status" aria-live="polite">
                        {(projectsLoading || loading || processing) && <IconLoading className="w-4 h-4 shrink-0" />}
                        <span className="ExportStatusText">{statusText}</span>
                        {statusDetail && <span className="ExportStatusDetail">{statusDetail}</span>}
                    </div>

                    <section className="ExportFilters" aria-label="Conversation rename filters">
                        <div className="ExportFiltersTitle">Filters</div>

                        <div className="ExportFilterRow">
                            <span className="ExportFilterLabel">Project</span>
                            <select
                                className="Select"
                                value={selectedProjectId ?? ''}
                                disabled={loading || projectsLoading || processing}
                                onChange={(event) => {
                                    const value = event.currentTarget.value
                                    setSelectedProjectId(value || null)
                                }}
                            >
                                <option value="">All conversations</option>
                                <option value={NOT_IN_PROJECT_ID}>Not in a project</option>
                                {projects.map(project => (
                                    <option key={project.id} value={project.id}>{project.display?.name ?? project.id}</option>
                                ))}
                            </select>
                        </div>

                        <div className="ExportFilterRow ExportDateRow">
                            <span className="ExportFilterLabel">Date</span>
                            <select
                                className="Select"
                                value={dateField}
                                disabled={loading || projectsLoading || processing}
                                onChange={(event) => {
                                    setSelected([])
                                    setDateField(event.currentTarget.value as 'create_time' | 'update_time')
                                }}
                            >
                                <option value="update_time">Last updated</option>
                                <option value="create_time">Created</option>
                            </select>
                            <label htmlFor="rename-date-from">From</label>
                            <input
                                id="rename-date-from"
                                type="date"
                                value={fromDate}
                                disabled={loading || projectsLoading || processing}
                                onChange={(event) => {
                                    setSelected([])
                                    setFromDate(event.currentTarget.value)
                                }}
                            />
                            <label htmlFor="rename-date-to">To</label>
                            <input
                                id="rename-date-to"
                                type="date"
                                value={toDate}
                                disabled={loading || projectsLoading || processing}
                                onChange={(event) => {
                                    setSelected([])
                                    setToDate(event.currentTarget.value)
                                }}
                            />
                            <button
                                className="Button neutral"
                                disabled={processing || (!fromDate && !toDate)}
                                onClick={() => {
                                    setSelected([])
                                    setFromDate('')
                                    setToDate('')
                                }}
                            >
                                Clear dates
                            </button>
                        </div>

                        <div className="ExportFilterRow ExportSearchRow">
                            <label className="ExportFilterLabel" htmlFor="rename-search">Search</label>
                            <input
                                id="rename-search"
                                type="search"
                                className="SelectSearch"
                                placeholder="Search conversations..."
                                value={query}
                                disabled={loading || projectsLoading || processing}
                                onInput={event => setQuery((event.currentTarget as HTMLInputElement).value)}
                            />
                        </div>
                    </section>

                    <div className="SelectToolbar">
                        <CheckBox
                            label="Select all visible"
                            disabled={loading || projectsLoading || processing || filtered.length === 0}
                            checked={allFilteredSelected}
                            onCheckedChange={checked => setSelected(checked ? filtered : [])}
                        />
                        <div className="flex flex-grow"></div>
                        <select
                            className="Select"
                            value={sortField}
                            disabled={processing}
                            onChange={event => setSortField(event.currentTarget.value as 'title' | 'create_time' | 'update_time')}
                        >
                            <option value="title">Sort: title</option>
                            <option value="create_time">Sort: created</option>
                            <option value="update_time">Sort: updated</option>
                        </select>
                        <button
                            className="Button neutral"
                            disabled={processing}
                            onClick={() => setSortDir(direction => direction === 'asc' ? 'desc' : 'asc')}
                        >
                            {sortDir === 'asc' ? 'Ascending' : 'Descending'}
                        </button>
                    </div>

                    <ul className="SelectList" style={{ maxHeight: '13rem' }}>
                        {filtered.map(conversation => (
                            <li className="SelectItem" key={conversation.id}>
                                <CheckBox
                                    label={conversation.title || '(untitled)'}
                                    disabled={processing}
                                    checked={selected.some(item => item.id === conversation.id)}
                                    onCheckedChange={(checked) => {
                                        setSelected(previous => checked
                                            ? [...previous.filter(item => item.id !== conversation.id), conversation]
                                            : previous.filter(item => item.id !== conversation.id))
                                    }}
                                />
                                <span className="SelectItemMeta" title={`Created: ${conversation.create_time ?? '—'}`}>
                                    {formatDate(conversation.create_time)}
                                </span>
                                <span className="SelectItemMeta" title={`Updated: ${conversation.update_time ?? '—'}`}>
                                    {formatDate(conversation.update_time)}
                                </span>
                            </li>
                        ))}
                        {!loading && !error && filtered.length === 0 && (
                            <li className="SelectItem text-gray-400 dark:text-gray-500">No conversations to display.</li>
                        )}
                    </ul>

                    <section className="ExportFilters" aria-label="Rename transformation" style={{ marginTop: '0.75rem' }}>
                        <div className="ExportFiltersTitle">Rename transformation</div>

                        <div className="ExportFilterRow">
                            <span className="ExportFilterLabel">Operation</span>
                            <select
                                className="Select"
                                value={operation}
                                disabled={processing}
                                onChange={event => setOperation(event.currentTarget.value as RenameOperation)}
                            >
                                <option value="prefix">Prefix</option>
                                <option value="suffix">Suffix</option>
                                <option value="replace">Find / Replace</option>
                            </select>
                        </div>

                        <div className="ExportFilterRow ExportSearchRow">
                            <label className="ExportFilterLabel" htmlFor="rename-text">
                                {operation === 'replace' ? 'Find text' : operation === 'prefix' ? 'Prefix' : 'Suffix'}
                            </label>
                            <input
                                id="rename-text"
                                type="text"
                                className="SelectSearch"
                                value={text}
                                disabled={processing}
                                placeholder={operation === 'replace' ? 'Text to find...' : 'Text to add...'}
                                onInput={event => setText((event.currentTarget as HTMLInputElement).value)}
                            />
                        </div>

                        {operation === 'replace' && (
                            <>
                                <div className="ExportFilterRow ExportSearchRow">
                                    <label className="ExportFilterLabel" htmlFor="rename-replacement">Replace with</label>
                                    <input
                                        id="rename-replacement"
                                        type="text"
                                        className="SelectSearch"
                                        value={replacement}
                                        disabled={processing}
                                        placeholder="Leave blank to remove matches"
                                        onInput={event => setReplacement((event.currentTarget as HTMLInputElement).value)}
                                    />
                                </div>
                                <div className="ExportFilterRow">
                                    <span className="ExportFilterLabel">Matching</span>
                                    <CheckBox
                                        label="Case sensitive"
                                        disabled={processing}
                                        checked={caseSensitive}
                                        onCheckedChange={setCaseSensitive}
                                    />
                                </div>
                            </>
                        )}
                    </section>

                    <div style={{ marginTop: '0.75rem', fontSize: '0.78rem' }}>
                        <strong>Preview</strong>
                        <span style={{ marginLeft: '0.5rem', opacity: 0.75 }}>
                            {previewCounts.changed} change · {previewCounts.unchanged} unchanged · {previewCounts.invalid} invalid
                        </span>
                    </div>
                    <div
                        style={{
                            border: '1px solid var(--ce-border-light)',
                            borderRadius: '4px',
                            marginTop: '0.35rem',
                            maxHeight: '13rem',
                            overflow: 'auto',
                        }}
                    >
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 5.5rem',
                                gap: '0.5rem',
                                padding: '0.4rem 0.55rem',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                borderBottom: '1px solid var(--ce-border-light)',
                            }}
                        >
                            <span>Current title</span>
                            <span>Proposed title</span>
                            <span>Status</span>
                        </div>
                        {preview.map(row => (
                            <div
                                key={row.id}
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 5.5rem',
                                    gap: '0.5rem',
                                    padding: '0.4rem 0.55rem',
                                    fontSize: '0.72rem',
                                    borderBottom: '1px solid var(--ce-border-light)',
                                }}
                            >
                                <span title={row.originalTitle} style={{ overflowWrap: 'anywhere' }}>{row.originalTitle || '(untitled)'}</span>
                                <span title={row.proposedTitle} style={{ overflowWrap: 'anywhere' }}>{row.proposedTitle || '(empty)'}</span>
                                <span title={row.error}>{!row.valid ? 'Invalid' : row.changed ? 'Change' : 'Unchanged'}</span>
                            </div>
                        ))}
                        {preview.length === 0 && (
                            <div style={{ padding: '0.65rem', fontSize: '0.75rem', opacity: 0.7 }}>
                                Select one or more conversations to preview title changes.
                            </div>
                        )}
                    </div>

                    <div className="ActionBar flex flex-wrap mt-3 items-center gap-2">
                        <span style={{ fontSize: '0.75rem', opacity: 0.75 }}>
                            Unchanged conversations are skipped. Invalid results block the batch.
                        </span>
                        <div className="flex flex-grow"></div>
                        <button
                            className="Button green"
                            disabled={
                                loading
                                || projectsLoading
                                || processing
                                || !!error
                                || previewCounts.changed === 0
                                || previewCounts.invalid > 0
                            }
                            onClick={applyRename}
                        >
                            Apply {previewCounts.changed > 0 ? `to ${previewCounts.changed}` : ''}
                        </button>
                    </div>

                    <Dialog.Close asChild>
                        <button className="IconButton CloseButton" aria-label="Close" disabled={processing}>
                            <IconCross />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
