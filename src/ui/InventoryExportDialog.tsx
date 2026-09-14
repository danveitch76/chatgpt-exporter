import * as Dialog from '@radix-ui/react-dialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import {
    fetchAllConversations,
    fetchAllNonProjectConversations,
    fetchProjects,
} from '../api'
import {
    buildChatInventoryRows,
    buildProjectInventoryRows,
    exportInventoryHtml,
    exportInventoryJson,
    exportInventoryMarkdown,
    exportInventoryText,
    normaliseGizmoId,
    slugifyInventoryName,
} from '../exporter/inventory'
import { conversationMatchesDateRange } from './conversationDateFilter'
import { IconCross, IconLoading, IconUpload } from './Icons'
import { useSettingContext } from './SettingContext'
import type { ApiConversationItem, ApiProjectInfo } from '../api'
import type { InventoryFormat, InventoryKind, InventoryRow } from '../exporter/inventory'
import type { FC } from '../type'
import type { ChangeEvent } from 'preact/compat'

const NOT_IN_PROJECT_ID = '__not_in_project__'

type ExportSource = 'API' | 'Local'

interface InventoryExportDialogProps {
    open: boolean
    onOpenChange: (value: boolean) => void
}

interface LocalConversationShape {
    id?: unknown
    conversation_id?: unknown
    title?: unknown
    create_time?: unknown
    update_time?: unknown
    gizmo_id?: unknown
}

function toConversationItem(value: LocalConversationShape): ApiConversationItem | null {
    const idValue = value.id ?? value.conversation_id
    if (typeof idValue !== 'string' || !idValue.trim()) return null

    const createTime = typeof value.create_time === 'number' || typeof value.create_time === 'string'
        ? value.create_time
        : 0
    const updateTime = typeof value.update_time === 'number' || typeof value.update_time === 'string'
        ? value.update_time
        : undefined

    return {
        id: idValue.trim(),
        title: typeof value.title === 'string' ? value.title : '',
        create_time: createTime,
        update_time: updateTime,
        gizmo_id: typeof value.gizmo_id === 'string' ? value.gizmo_id : null,
    }
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

function mergeUniqueConversations(
    existing: ApiConversationItem[],
    incoming: ApiConversationItem[],
): ApiConversationItem[] {
    const byId = new Map(existing.map(conversation => [conversation.id, conversation]))
    for (const conversation of incoming) {
        const current = byId.get(conversation.id)
        if (!current) {
            byId.set(conversation.id, conversation)
            continue
        }

        if (!current.gizmo_id && conversation.gizmo_id) {
            byId.set(conversation.id, { ...current, gizmo_id: conversation.gizmo_id })
        }
    }
    return [...byId.values()]
}

function assignProjectMembership(
    conversations: ApiConversationItem[],
    projectId: string,
): ApiConversationItem[] {
    return conversations.map(conversation => ({
        ...conversation,
        gizmo_id: conversation.gizmo_id || projectId,
    }))
}

const EXPORTERS: Record<InventoryFormat, (kind: InventoryKind, rows: InventoryRow[], projectName?: string) => boolean> = {
    json: exportInventoryJson,
    txt: exportInventoryText,
    html: exportInventoryHtml,
    md: exportInventoryMarkdown,
}

const PROJECT_PREVIEW_HEADERS = ['Actual Project Name', 'GizmoID', 'Slug', 'URL'] as const
const CHAT_PREVIEW_HEADERS = ['Actual Chat Name', 'Project Name', 'Slug', 'URL'] as const

function inventoryValue(row: InventoryRow, header: string): string {
    return String((row as unknown as Record<string, string>)[header] ?? '')
}

const InventoryPreview: FC<{ kind: InventoryKind, rows: InventoryRow[] }> = ({ kind, rows }) => {
    const headers = kind === 'projects' ? PROJECT_PREVIEW_HEADERS : CHAT_PREVIEW_HEADERS

    return (
        <div className="InventoryPreview" aria-label={`${kind === 'projects' ? 'Project' : 'Chat'} inventory preview`}>
            <div className="InventoryPreviewHeader" role="row">
                {headers.map(header => (
                    <div className="InventoryPreviewHeaderCell" role="columnheader" key={header}>{header}</div>
                ))}
            </div>
            <div className="InventoryPreviewBody" role="rowgroup">
                {rows.map((row) => {
                    const key = inventoryValue(row, 'URL') || inventoryValue(row, 'Token')
                    return (
                        <div className="InventoryPreviewRow" role="row" key={key}>
                            {headers.map(header => (
                                <div
                                    className={`InventoryPreviewCell${header === 'Actual Project Name' || header === 'Actual Chat Name' ? ' InventoryPreviewCellPrimary' : ''}`}
                                    role="cell"
                                    title={inventoryValue(row, header) || undefined}
                                    key={header}
                                >
                                    {inventoryValue(row, header) || '—'}
                                </div>
                            ))}
                        </div>
                    )
                })}
                {rows.length === 0 && (
                    <div className="InventoryPreviewEmpty">No rows to display.</div>
                )}
            </div>
        </div>
    )
}

export const InventoryExportDialog: FC<InventoryExportDialogProps> = ({ open, onOpenChange, children }) => {
    const { exportAllLimit } = useSettingContext()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [kind, setKind] = useState<InventoryKind>('projects')
    const [outputFormat, setOutputFormat] = useState<InventoryFormat>('json')
    const [exportSource, setExportSource] = useState<ExportSource>('API')
    const [projects, setProjects] = useState<ApiProjectInfo[]>([])
    const [projectsLoaded, setProjectsLoaded] = useState(false)
    const [projectsLoading, setProjectsLoading] = useState(false)
    const [apiConversations, setApiConversations] = useState<ApiConversationItem[]>([])
    const [localConversations, setLocalConversations] = useState<ApiConversationItem[]>([])
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
    const [dateField, setDateField] = useState<'create_time' | 'update_time'>('update_time')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [query, setQuery] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const projectGizmoIds = useMemo(
        () => projects.map(project => normaliseGizmoId(project.id)).filter(Boolean),
        [projects],
    )
    const selectedProject = projects.find(project => project.id === selectedProjectId) ?? null
    const isNotInProject = selectedProjectId === NOT_IN_PROJECT_ID
    const conversations = exportSource === 'API' ? apiConversations : localConversations
    const needsConversationData = kind === 'chats' || !!fromDate || !!toDate

    useEffect(() => {
        if (!open) return
        setProjectsLoading(true)
        setProjectsLoaded(false)
        fetchProjects()
            .then((items) => {
                setProjects(items)
                setProjectsLoaded(true)
                setError('')
            })
            .catch((err: Error) => {
                console.error('Error fetching projects for inventory export:', err)
                setProjects([])
                setProjectsLoaded(false)
                setError(err.message || 'Failed to load projects')
            })
            .finally(() => {
                setProjectsLoading(false)
            })
    }, [open])

    useEffect(() => {
        if (!open || exportSource !== 'API' || !projectsLoaded) return

        if (!needsConversationData) {
            setApiConversations([])
            setLoading(false)
            setError('')
            return
        }

        let cancelled = false
        const alive = () => !cancelled
        setApiConversations([])
        setError('')
        setLoading(true)

        const addConversations = (batch: ApiConversationItem[]) => {
            if (!alive()) return
            setApiConversations(previous => mergeUniqueConversations(previous, batch))
        }

        const loadConversations = async () => {
            if (selectedProjectId === null) {
                const nonProject = await fetchAllNonProjectConversations(projectGizmoIds, exportAllLimit)
                addConversations(nonProject)

                for (const project of projects) {
                    if (!alive()) return
                    const projectConversations = await fetchAllConversations(project.id, exportAllLimit)
                    addConversations(assignProjectMembership(projectConversations, project.id))
                }
                return
            }

            if (isNotInProject) {
                const nonProject = await fetchAllNonProjectConversations(projectGizmoIds, exportAllLimit)
                addConversations(nonProject)
                return
            }

            const projectConversations = await fetchAllConversations(selectedProjectId, exportAllLimit)
            addConversations(assignProjectMembership(projectConversations, selectedProjectId))
        }

        loadConversations()
            .catch((err: Error) => {
                if (!alive()) return
                console.error('Error fetching conversations for inventory export:', err)
                setError(err.message || 'Failed to load conversations')
            })
            .finally(() => {
                if (alive()) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [exportAllLimit, exportSource, isNotInProject, needsConversationData, open, projectGizmoIds, projects, projectsLoaded, selectedProjectId])

    const filteredConversations = useMemo(() => {
        let result = conversations

        if (exportSource === 'Local' && selectedProjectId) {
            const knownProjectIds = new Set(projectGizmoIds)
            if (isNotInProject) {
                result = result.filter((conversation) => {
                    const projectId = normaliseGizmoId(conversation.gizmo_id)
                    return !projectId || !knownProjectIds.has(projectId)
                })
            }
            else {
                const targetProjectId = normaliseGizmoId(selectedProjectId)
                result = result.filter(conversation => normaliseGizmoId(conversation.gizmo_id) === targetProjectId)
            }
        }

        if (kind === 'chats' && query.trim()) {
            result = result.filter(conversation => textSearch(conversation.title ?? '', query))
        }

        if (fromDate || toDate) {
            result = result.filter(conversation => conversationMatchesDateRange(conversation, dateField, fromDate, toDate))
        }

        return result
    }, [conversations, dateField, exportSource, fromDate, isNotInProject, kind, projectGizmoIds, query, selectedProjectId, toDate])

    const rows = useMemo<InventoryRow[]>(() => {
        if (kind === 'chats') {
            return buildChatInventoryRows(filteredConversations, projects)
        }

        let candidateProjects = projects
        if (selectedProjectId && !isNotInProject) {
            const targetProjectId = normaliseGizmoId(selectedProjectId)
            candidateProjects = projects.filter(project => normaliseGizmoId(project.id) === targetProjectId)
        }
        else if (isNotInProject) {
            candidateProjects = []
        }

        if (query.trim()) {
            candidateProjects = candidateProjects.filter((project) => {
                const name = project.display?.name ?? ''
                const slug = slugifyInventoryName(name)
                return textSearch(`${name} ${slug}`, query)
            })
        }

        if (fromDate || toDate) {
            const projectIdsWithMatchingConversation = new Set(
                filteredConversations
                    .map(conversation => normaliseGizmoId(conversation.gizmo_id))
                    .filter(Boolean),
            )
            candidateProjects = candidateProjects.filter(project => (
                projectIdsWithMatchingConversation.has(normaliseGizmoId(project.id))
            ))
        }

        return buildProjectInventoryRows(candidateProjects)
    }, [filteredConversations, fromDate, isNotInProject, kind, projects, query, selectedProjectId, toDate])

    const onUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result))
                if (!Array.isArray(parsed)) throw new Error('The selected file does not contain a conversation array.')

                const normalised = parsed
                    .map(item => toConversationItem(item as LocalConversationShape))
                    .filter((item): item is ApiConversationItem => item !== null)

                setLocalConversations(normalised)
                setError('')
            }
            catch (err) {
                const message = err instanceof Error ? err.message : 'Invalid JSON file.'
                setError(message)
                setLocalConversations([])
            }
        }
        reader.onerror = () => {
            setError('Failed to read the selected file.')
            setLocalConversations([])
        }
        reader.readAsText(file)
    }, [])

    const onExport = useCallback(() => {
        if (rows.length === 0) return
        const selectedProjectName = selectedProject?.display?.name
        EXPORTERS[outputFormat](kind, rows, selectedProjectName)
    }, [kind, outputFormat, rows, selectedProject])

    const statusText = error
        ? `Error: ${error}`
        : projectsLoading
            ? 'Loading projects...'
            : loading
                ? 'Loading conversations...'
                : `${rows.length} ${kind === 'projects' ? 'projects' : 'chats'} ready to export`

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Trigger asChild>{children}</Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="DialogOverlay" />
                <Dialog.Content className="DialogContent _export">
                    <Dialog.Title className="DialogTitle">Export Project / Chat Lists</Dialog.Title>

                    <div className="ExportStatusBox" role="status" aria-live="polite">
                        {(projectsLoading || loading) && <IconLoading className="w-4 h-4 shrink-0" />}
                        <span className="ExportStatusText">{statusText}</span>
                        {!error && !loading && !projectsLoading && needsConversationData && (
                            <span className="ExportStatusDetail">Limit: {exportAllLimit} conversations per source scan</span>
                        )}
                    </div>

                    <input
                        type="file"
                        accept="application/json"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={onUpload}
                    />

                    <section className="ExportFilters" aria-label="Inventory export filters">
                        <div className="ExportFiltersTitle">Export</div>

                        <div className="ExportFilterRow">
                            <span className="ExportFilterLabel">List</span>
                            <select
                                className="Select"
                                value={kind}
                                disabled={loading || projectsLoading}
                                onChange={event => setKind(event.currentTarget.value as InventoryKind)}
                            >
                                <option value="projects">Projects</option>
                                <option value="chats">Chats</option>
                            </select>
                        </div>

                        <div className="ExportFilterRow ExportSourceRow">
                            <span className="ExportFilterLabel">Export from</span>
                            <select
                                className="Select ExportFilterControl"
                                value={exportSource}
                                disabled={loading || projectsLoading}
                                onChange={(event) => {
                                    setError('')
                                    setExportSource(event.currentTarget.value as ExportSource)
                                }}
                            >
                                <option value="API">ChatGPT API</option>
                                <option value="Local">Official export file (conversations.json)</option>
                            </select>
                            <div className="ExportSourceActions">
                                {exportSource === 'Local' && (
                                    <button
                                        className="Button neutral flex items-center gap-1"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <IconUpload className="w-4 h-4" />
                                        Select file...
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="ExportFilterRow">
                            <span className="ExportFilterLabel">Project</span>
                            <select
                                className="Select"
                                value={selectedProjectId ?? ''}
                                disabled={loading || projectsLoading}
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
                                disabled={loading || projectsLoading}
                                onChange={event => setDateField(event.currentTarget.value as 'create_time' | 'update_time')}
                            >
                                <option value="update_time">Last updated</option>
                                <option value="create_time">Created</option>
                            </select>
                            <label htmlFor="inventory-date-from">From</label>
                            <input
                                id="inventory-date-from"
                                type="date"
                                value={fromDate}
                                disabled={loading || projectsLoading}
                                onChange={event => setFromDate(event.currentTarget.value)}
                            />
                            <label htmlFor="inventory-date-to">To</label>
                            <input
                                id="inventory-date-to"
                                type="date"
                                value={toDate}
                                disabled={loading || projectsLoading}
                                onChange={event => setToDate(event.currentTarget.value)}
                            />
                            <button
                                className="Button neutral"
                                disabled={!fromDate && !toDate}
                                onClick={() => {
                                    setFromDate('')
                                    setToDate('')
                                }}
                            >
                                Clear dates
                            </button>
                        </div>

                        <div className="ExportFilterRow ExportSearchRow">
                            <label className="ExportFilterLabel" htmlFor="inventory-search">Search</label>
                            <input
                                id="inventory-search"
                                type="search"
                                className="SelectSearch"
                                placeholder={kind === 'projects' ? 'Search projects...' : 'Search conversations...'}
                                value={query}
                                disabled={loading || projectsLoading}
                                onInput={event => setQuery((event.currentTarget as HTMLInputElement).value)}
                            />
                        </div>
                    </section>

                    <InventoryPreview kind={kind} rows={rows} />

                    <div className="ActionBar flex flex-wrap mt-3 items-center gap-2">
                        <select
                            className="Select shrink-0"
                            value={outputFormat}
                            onChange={event => setOutputFormat(event.currentTarget.value as InventoryFormat)}
                        >
                            <option value="json">JSON</option>
                            <option value="txt">TXT</option>
                            <option value="html">HTML</option>
                            <option value="md">Markdown</option>
                        </select>
                        <div className="flex flex-grow"></div>
                        <button
                            className="Button green"
                            disabled={loading || projectsLoading || !!error || rows.length === 0}
                            onClick={onExport}
                        >
                            Export
                        </button>
                    </div>

                    <Dialog.Close asChild>
                        <button className="IconButton CloseButton" aria-label="Close">
                            <IconCross />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
