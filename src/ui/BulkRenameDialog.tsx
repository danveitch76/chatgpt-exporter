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
import { buildRenameManifestPreview } from './conversationRenameManifest'
import { transformConversationTitle } from './conversationTitleTransform'
import { IconCross, IconLoading } from './Icons'
import { useSettingContext } from './SettingContext'
import type { RenameOperation } from './conversationTitleTransform'
import type { ApiConversationItem, ApiProjectInfo } from '../api'
import type { RenameConversationResult } from '../conversationRename'
import type { FC } from '../type'

const NOT_IN_PROJECT_ID = '__not_in_project__'

type BulkRenameOperation = RenameOperation | 'manifest'

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

function timeToMs(value: number | string | undefined): number {
    if (value == null) return 0
    if (typeof value === 'number') return value * 1000
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
}

function formatDate(value: number | string | undefined): string {
    const ms = timeToMs(value)
    if (!ms) return '—'
    return new Date(ms).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

function textSearch(value: string, query: string): boolean {
    const q = query.trim()
    if (!q) return true
    const lower = q.toLowerCase()
    if (!lower.includes('*') && !lower.includes('?')) {
        return value.toLowerCase().includes(lower)
    }

    const regexSource = lower
        .replace(/[\\\^$.|+()[\]{}]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')

    try {
        return new RegExp(regexSource).test(value.toLowerCase())
    }
    catch {
        return value.toLowerCase().includes(lower)
    }
}

function mergeUnique(
    existing: ApiConversationItem[],
    incoming: ApiConversationItem[],
): ApiConversationItem[] {
    const byId = new Map(existing.map(item => [item.id, item]))
    for (const item of incoming) byId.set(item.id, item)
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

    const [operation, setOperation] = useState<BulkRenameOperation>('prefix')
    const [text, setText] = useState('')
    const [replacement, setReplacement] = useState('')
    const [caseSensitive, setCaseSensitive] = useState(false)
    const [manifestText, setManifestText] = useState('')
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

        let cancelled = false
        setProjectsLoading(true)
        setProjectsLoaded(false)
        setError('')
        setSummary(null)

        fetchProjects()
            .then((items) => {
                if (cancelled) return
                setProjects(items)
                setProjectsLoaded(true)
            })
            .catch((err: Error) => {
                if (cancelled) return
                console.error('Error fetching projects for bulk rename:', err)
                setProjects([])
                setError(err.message || 'Failed to load projects')
            })
            .finally(() => {
                if (!cancelled) setProjectsLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [open])

    useEffect(() => {
        if (!open || !projectsLoaded) return

        let cancelled = false
        const alive = () => !cancelled
        setConversations([])
        setSelected([])
        setSummary(null)
        setError('')
        setLoading(true)

        const onBatch = (batch: ApiConversationItem[]) => {
            if (!alive()) return
            setConversations(previous => mergeUnique(previous, batch))
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
    }, [exportAllLimit, isNotInProject, open, projectIds, projects, projectsLoaded, selectedProjectId])

    const filtered = useMemo(() => {
        let result = conversations
        if (query.trim()) {
            result = result.filter(item => textSearch(item.title ?? '', query))
        }
        if (fromDate || toDate) {
            result = result.filter(item => conversationMatchesDateRange(item, dateField, fromDate, toDate))
        }

        const direction = sortDir === 'asc' ? 1 : -1
        return [...result].sort((a, b) => {
            if (sortField === 'title') {
                return direction * (a.title ?? '').localeCompare(b.title ?? '')
            }
            const aTime = timeToMs(sortField === 'update_time' ? a.update_time : a.create_time)
            const bTime = timeToMs(sortField === 'update_time' ? b.update_time : b.create_time)
            return direction * (aTime - bTime)
        })
    }, [conversations, dateField, fromDate, query, sortDir, sortField, toDate])

    const transformOperation: RenameOperation = operation === 'manifest' ? 'prefix' : operation
    const transform = useMemo(() => ({
        operation: transformOperation,
        text,
        replacement,
        caseSensitive,
    }), [caseSensitive, replacement, text, transformOperation])

    const manifestPreview = useMemo(
        () => buildRenameManifestPreview(manifestText, conversations),
        [conversations, manifestText],
    )
    const manifestError = operation === 'manifest' ? manifestPreview.error : undefined

    const preview = useMemo<RenamePreviewRow[]>(() => {
        if (operation === 'manifest') return manifestPreview.rows
        return selected.map(conversation => ({
            id: conversation.id,
            ...transformConversationTitle(conversation.title ?? '', transform),
        }))
    }, [manifestPreview.rows, operation, selected, transform])

    const previewCounts = useMemo(() => preview.reduce((counts, row) => {
        if (!row.valid) counts.invalid++
        else if (row.changed) counts.changed++
        else counts.unchanged++
        return counts
    }, {
        changed: 0,
        unchanged: 0,
        invalid: manifestError ? 1 : 0,
    }), [manifestError, preview])

    const allFilteredSelected = operation !== 'manifest'
        && filtered.length > 0
        && filtered.every(item => selected.some(selectedItem => selectedItem.id === item.id))

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
            const plan = pendingPlanRef.current
            const successful = new Map(results.map(result => [result.id, result.title]))
            const failedIds = new Set(plan.filter(item => !successful.has(item.id)).map(item => item.id))

            if (successful.size > 0) {
                setConversations(previous => previous.map((conversation) => {
                    const title = successful.get(conversation.id)
                    return title === undefined ? conversation : { ...conversation, title }
                }))
            }

            setSelected(previous => previous.filter(item => failedIds.has(item.id)))
            setSummary({
                renamed: results.length,
                unchanged: pendingUnchangedRef.current,
                invalid: pendingInvalidRef.current,
                failed: Math.max(0, plan.length - results.length),
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
        const sourceLabel = operation === 'manifest' ? 'manifest conversation' : 'selected conversation'
        const approved = confirm(
            `Rename ${plan.length} ${sourceLabel}${plan.length === 1 ? '' : 's'} using the previewed titles?`,
        )
        if (!approved) return

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
    }, [operation, preview, previewCounts, processing, renameQueue])

    const setDateAndClearSelection = useCallback((setter: (value: string) => void, value: string) => {
        setSelected([])
        setter(value)
    }, [])

    const closeGuarded = useCallback((value: boolean) => {
        if (!processing) onOpenChange(value)
    }, [onOpenChange, processing])

    const busy = projectsLoading || loading || processing
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
                        : operation === 'manifest'
                            ? `${preview.length} manifest entries / ${conversations.length} loaded`
                            : `${selected.length} selected / ${filtered.length} visible`
    const statusDetail = processing
        ? progress.currentName
        : !error && !busy
                ? `${conversations.length} conversations loaded · source scan limit ${exportAllLimit}`
                : ''

    return (
        <Dialog.Root open={open} onOpenChange={closeGuarded}>
            <Dialog.Trigger asChild>{children}</Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="DialogOverlay" />
                <Dialog.Content
                    className="DialogContent _export BulkRenameDialog"
                    onEscapeKeyDown={(event: Event) => {
                        if (processing) event.preventDefault()
                    }}
                    onPointerDownOutside={(event: Event) => {
                        if (processing) event.preventDefault()
                    }}
                >
                    <Dialog.Title className="DialogTitle">Bulk Rename Conversations</Dialog.Title>

                    <div className="ExportStatusBox" role="status" aria-live="polite">
                        {busy && <IconLoading className="w-4 h-4 shrink-0" />}
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
                                disabled={busy}
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
                                disabled={busy}
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
                                disabled={busy}
                                onChange={event => setDateAndClearSelection(setFromDate, event.currentTarget.value)}
                            />
                            <label htmlFor="rename-date-to">To</label>
                            <input
                                id="rename-date-to"
                                type="date"
                                value={toDate}
                                disabled={busy}
                                onChange={event => setDateAndClearSelection(setToDate, event.currentTarget.value)}
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
                                disabled={busy}
                                onInput={event => setQuery((event.currentTarget as HTMLInputElement).value)}
                            />
                        </div>
                    </section>

                    <div className="SelectToolbar">
                        <CheckBox
                            label="Select all visible"
                            disabled={busy || operation === 'manifest' || filtered.length === 0}
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

                    <ul className="SelectList BulkRenameConversationList">
                        {filtered.map(conversation => (
                            <li className="SelectItem" key={conversation.id}>
                                <CheckBox
                                    label={conversation.title || '(untitled)'}
                                    disabled={processing || operation === 'manifest'}
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

                    <section className="ExportFilters BulkRenameTransform" aria-label="Rename transformation">
                        <div className="ExportFiltersTitle">Rename transformation</div>
                        <div className="ExportFilterRow">
                            <span className="ExportFilterLabel">Operation</span>
                            <select
                                className="Select"
                                value={operation}
                                disabled={processing}
                                onChange={event => setOperation(event.currentTarget.value as BulkRenameOperation)}
                            >
                                <option value="prefix">Prefix</option>
                                <option value="suffix">Suffix</option>
                                <option value="replace">Find / Replace</option>
                                <option value="lowercase">lowercase</option>
                                <option value="uppercase">UPPERCASE</option>
                                <option value="propercase">Proper Case</option>
                                <option value="status">Status capitalisation</option>
                                <option value="manifest">Exact mapping manifest</option>
                            </select>
                        </div>

                        {(operation === 'prefix' || operation === 'suffix' || operation === 'replace') && (
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
                        )}

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

                        {operation === 'manifest' && (
                            <>
                                <div className="ExportFilterRow ExportSearchRow">
                                    <label className="ExportFilterLabel" htmlFor="rename-manifest">Manifest JSON</label>
                                    <textarea
                                        id="rename-manifest"
                                        className="SelectSearch"
                                        value={manifestText}
                                        disabled={processing}
                                        rows={4}
                                        placeholder='[{"id":"...","expectedTitle":"...","newTitle":"..."}]'
                                        onInput={event => setManifestText((event.currentTarget as HTMLTextAreaElement).value)}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>
                                <div style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                                    Manifest mode resolves conversations by identifier. Project controls the loaded scope; Date and Search only filter the displayed list. Manual selection is ignored.
                                </div>
                                {manifestError && (
                                    <div style={{ fontSize: '0.72rem' }} role="alert">
                                        {manifestError}
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    <div className="BulkRenamePreviewSummary">
                        <strong>Preview</strong>
                        <span style={{ marginLeft: '0.5rem', opacity: 0.75 }}>
                            {previewCounts.changed} change · {previewCounts.unchanged} unchanged · {previewCounts.invalid} invalid
                        </span>
                    </div>
                    <div className="BulkRenamePreviewTable">
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
                                <span title={row.originalTitle} style={{ overflowWrap: 'anywhere' }}>
                                    {row.originalTitle || '(untitled)'}
                                </span>
                                <span title={row.proposedTitle} style={{ overflowWrap: 'anywhere' }}>
                                    {row.proposedTitle || '(empty)'}
                                </span>
                                <span title={row.error}>
                                    {!row.valid ? 'Invalid' : row.changed ? 'Change' : 'Unchanged'}
                                </span>
                            </div>
                        ))}
                        {preview.length === 0 && (
                            <div style={{ padding: '0.65rem', fontSize: '0.75rem', opacity: 0.7 }}>
                                {operation === 'manifest'
                                    ? 'Paste a valid manifest to preview exact title mappings.'
                                    : 'Select one or more conversations to preview title changes.'}
                            </div>
                        )}
                    </div>

                    <div className="ActionBar BulkRenameFooter flex flex-wrap items-center gap-2">
                        <span style={{ fontSize: '0.75rem', opacity: 0.75 }}>
                            Unchanged conversations are skipped. Invalid results block the batch.
                        </span>
                        <div className="flex flex-grow"></div>
                        <button
                            className="Button green"
                            disabled={
                                busy
                                || !!error
                                || !!manifestError
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
