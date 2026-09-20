import * as Dialog from '@radix-ui/react-dialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { fetchAllConversationsAll, fetchProjects } from '../api'
import { moveConversationToProject, renameProject } from '../projectManagement'
import { RequestQueue } from '../utils/queue'
import { IconCross, IconLoading } from './Icons'
import {
    buildConversationProjectPreview,
    buildProjectRenamePreview,
} from './projectManagementManifest'
import { useSettingContext } from './SettingContext'
import type { ApiConversationItem, ApiProjectInfo } from '../api'
import type { ProjectManagementResult } from '../projectManagement'
import type { FC } from '../type'

interface BulkProjectManagementDialogProps {
    open: boolean
    onOpenChange: (value: boolean) => void
}

type ManagementMode = 'conversation-project' | 'project-rename'

interface ManagementPreviewRow {
    id: string
    label: string
    originalValue: string
    proposedValue: string
    changed: boolean
    valid: boolean
    error?: string
    originalProjectId?: string | null
}

interface ManagementSummary {
    changed: number
    unchanged: number
    invalid: number
    failed: number
}

function mergeUnique(
    existing: ApiConversationItem[],
    incoming: ApiConversationItem[],
): ApiConversationItem[] {
    const byId = new Map(existing.map(item => [item.id, item]))
    for (const item of incoming) byId.set(item.id, item)
    return [...byId.values()]
}

export const BulkProjectManagementDialog: FC<BulkProjectManagementDialogProps> = ({ open, onOpenChange, children }) => {
    const { exportAllLimit } = useSettingContext()
    const [mode, setMode] = useState<ManagementMode>('conversation-project')
    const [projects, setProjects] = useState<ApiProjectInfo[]>([])
    const [projectsLoaded, setProjectsLoaded] = useState(false)
    const [projectsLoading, setProjectsLoading] = useState(false)
    const [conversations, setConversations] = useState<ApiConversationItem[]>([])
    const [conversationsLoading, setConversationsLoading] = useState(false)
    const [conversationManifest, setConversationManifest] = useState('')
    const [projectRenameManifest, setProjectRenameManifest] = useState('')
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState('')
    const [summary, setSummary] = useState<ManagementSummary | null>(null)
    const [progress, setProgress] = useState({ total: 0, completed: 0, currentName: '' })

    const queue = useMemo(() => new RequestQueue<ProjectManagementResult>(200, 1600), [])
    const pendingPlanRef = useRef<ManagementPreviewRow[]>([])
    const pendingUnchangedRef = useRef(0)
    const pendingInvalidRef = useRef(0)
    const pendingModeRef = useRef<ManagementMode>('conversation-project')

    const projectIds = useMemo(() => projects.map(project => project.id), [projects])
    const projectNames = useMemo(
        () => new Map(projects.map(project => [project.id, project.display?.name ?? project.id])),
        [projects],
    )

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
                console.error('Error fetching projects for bulk Project management:', err)
                setProjects([])
                setError(err.message || 'Failed to load Projects')
            })
            .finally(() => {
                if (!cancelled) setProjectsLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [open])

    useEffect(() => {
        if (!open || !projectsLoaded || mode !== 'conversation-project') return
        let cancelled = false
        setConversations([])
        setConversationsLoading(true)
        setSummary(null)
        setError('')

        const onBatch = (batch: ApiConversationItem[]) => {
            if (cancelled) return
            setConversations(previous => mergeUnique(previous, batch))
        }

        fetchAllConversationsAll(projects, exportAllLimit, onBatch)
            .catch((err: Error) => {
                if (cancelled) return
                console.error('Error fetching conversations for bulk Project management:', err)
                setError(err.message || 'Failed to load conversations')
            })
            .finally(() => {
                if (!cancelled) setConversationsLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [exportAllLimit, mode, open, projects, projectsLoaded])

    const manifestText = mode === 'conversation-project' ? conversationManifest : projectRenameManifest

    const rawConversationPreview = useMemo(
        () => buildConversationProjectPreview(conversationManifest, conversations, projects),
        [conversationManifest, conversations, projects],
    )
    const rawProjectRenamePreview = useMemo(
        () => buildProjectRenamePreview(projectRenameManifest, projects),
        [projectRenameManifest, projects],
    )

    const manifestError = mode === 'conversation-project'
        ? rawConversationPreview.error
        : rawProjectRenamePreview.error

    const preview = useMemo<ManagementPreviewRow[]>(() => {
        if (mode === 'conversation-project') {

            return rawConversationPreview.rows.map(row => ({
                id: row.id,
                label: row.title || row.id,
                originalValue: row.originalProjectId === null
                    ? 'Not in a Project'
                    : (projectNames.get(row.originalProjectId) ?? row.originalProjectId),
                proposedValue: projectNames.get(row.proposedProjectId) ?? row.proposedProjectId,
                changed: row.changed,
                valid: row.valid,
                error: row.error,
                originalProjectId: row.originalProjectId,
            }))
        }
        return rawProjectRenamePreview.rows.map(row => ({
            id: row.id,
            label: row.id,
            originalValue: row.originalName,
            proposedValue: row.proposedName,
            changed: row.changed,
            valid: row.valid,
            error: row.error,
        }))
    }, [mode, projectNames, rawConversationPreview.rows, rawProjectRenamePreview.rows])

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

    useEffect(() => {
        const off = queue.on('progress', (event) => setProgress({
            total: event.total,
            completed: event.completed,
            currentName: event.currentName,
        }))
        return () => off()
    }, [queue])

    useEffect(() => {
        const off = queue.on('done', (results) => {
            const plan = pendingPlanRef.current
            const successful = new Map(results.map(result => [result.id, result]))

            if (pendingModeRef.current === 'conversation-project' && successful.size > 0) {
                setConversations(previous => previous.map((conversation) => {
                    const result = successful.get(conversation.id)
                    return result?.kind === 'conversation-project' && result.projectId
                        ? { ...conversation, gizmo_id: result.projectId }
                        : conversation
                }))
            }
            if (pendingModeRef.current === 'project-rename' && successful.size > 0) {
                setProjects(previous => previous.map((project) => {
                    const result = successful.get(project.id)
                    return result?.kind === 'project-rename' && result.name
                        ? { ...project, display: { ...project.display, name: result.name } }
                        : project
                }))
            }

            const appliedChanges = results.filter(result => result.changed).length
            const idempotentResults = results.length - appliedChanges
            setSummary({
                changed: appliedChanges,
                unchanged: pendingUnchangedRef.current + idempotentResults,
                invalid: pendingInvalidRef.current,
                failed: Math.max(0, plan.length - results.length),
            })
            setProcessing(false)
            pendingPlanRef.current = []
        })
        return () => off()
    }, [queue])

    useEffect(() => () => queue.clear(), [queue])

    const applyChanges = useCallback(() => {
        if (processing || previewCounts.invalid > 0 || previewCounts.changed === 0) return

        const plan = preview.filter(row => row.valid && row.changed)
        const action = mode === 'conversation-project' ? 'move' : 'rename'
        const approved = confirm(
            `${action === 'move' ? 'Move' : 'Rename'} ${plan.length} ${mode === 'conversation-project' ? 'conversation' : 'Project'}${plan.length === 1 ? '' : 's'} using the previewed manifest?`,
        )
        if (!approved) return

        pendingPlanRef.current = plan
        pendingUnchangedRef.current = previewCounts.unchanged
        pendingInvalidRef.current = previewCounts.invalid
        pendingModeRef.current = mode
        setSummary(null)
        setProcessing(true)
        setProgress({ total: plan.length, completed: 0, currentName: '' })

        queue.clear()
        for (const row of plan) {
            queue.add({
                name: row.label,
                request: mode === 'conversation-project'
                    ? () => moveConversationToProject(
                        row.id,
                        row.originalProjectId ?? null,
                        rawConversationPreview.rows.find(item => item.id === row.id)!.proposedProjectId,
                        projectIds,
                    )
                    : () => renameProject(row.id, row.originalValue, row.proposedValue),
            })
        }
        queue.start()
    }, [mode, preview, previewCounts, processing, projectIds, queue, rawConversationPreview.rows])

    const closeGuarded = useCallback((value: boolean) => {
        if (!processing) onOpenChange(value)
    }, [onOpenChange, processing])

    const busy = projectsLoading || conversationsLoading || processing
    const statusText = error
        ? `Error: ${error}`
        : processing
            ? `Applying ${progress.completed} / ${progress.total}`
            : projectsLoading
                ? 'Loading Projects...'
                : conversationsLoading
                    ? 'Loading conversations...'
                    : summary
                        ? `Changed ${summary.changed}; unchanged ${summary.unchanged}; invalid ${summary.invalid}; failed ${summary.failed}`
                        : `${preview.length} manifest entries`
    const statusDetail = processing
        ? progress.currentName
        : !error && !busy && mode === 'conversation-project'
            ? `${conversations.length} conversations loaded · source scan limit ${exportAllLimit}`
            : !error && !busy
                ? `${projects.length} Projects loaded`
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
                    <Dialog.Title className="DialogTitle">Bulk Project Management</Dialog.Title>

                    <div className="ExportStatusBox" role="status" aria-live="polite">
                        {busy && <IconLoading className="w-4 h-4 shrink-0" />}
                        <span className="ExportStatusText">{statusText}</span>
                        {statusDetail && <span className="ExportStatusDetail">{statusDetail}</span>}
                    </div>

                    <section className="ExportFilters" aria-label="Bulk Project management mode">
                        <div className="ExportFiltersTitle">Operation</div>
                        <div className="ExportFilterRow">
                            <label className="ExportFilterLabel" htmlFor="project-management-mode">Mode</label>
                            <select
                                id="project-management-mode"
                                className="Select"
                                value={mode}
                                disabled={busy}
                                onChange={(event: Event) => {
                                    setMode((event.currentTarget as HTMLSelectElement).value as ManagementMode)
                                    setSummary(null)
                                    setError('')
                                }}
                            >
                                <option value="conversation-project">Move conversations to Projects</option>
                                <option value="project-rename">Rename Projects</option>
                            </select>
                        </div>
                    </section>

                    <section className="RenameControls" aria-label="Project management manifest">
                        <div className="ExportFiltersTitle">Approved JSON manifest</div>
                        <textarea
                            className="RenameManifestInput"
                            rows={8}
                            spellCheck={false}
                            disabled={busy}
                            value={manifestText}
                            placeholder={mode === 'conversation-project'
                                ? '[{"id":"<conversation-id>","expectedProjectId":null,"newProjectId":"g-p-..."}]'
                                : '[{"id":"g-p-...","expectedName":"Current name","newName":"New name"}]'}
                            onInput={(event: Event) => {
                                const value = (event.currentTarget as HTMLTextAreaElement).value
                                if (mode === 'conversation-project') setConversationManifest(value)
                                else setProjectRenameManifest(value)
                                setSummary(null)
                            }}
                        />
                        <div className="RenameHelpText">
                            Manifest-driven execution only. This feature does not decide Project placement or generate names.
                        </div>
                    </section>

                    <section className="RenamePreview" aria-label="Project management preview">
                        <div className="ExportFiltersTitle">
                            Preview · change {previewCounts.changed} · unchanged {previewCounts.unchanged} · invalid {previewCounts.invalid}
                        </div>
                        {manifestError && <div className="RenameValidationError">{manifestError}</div>}
                        <div className="RenamePreviewTableWrap">
                            <table className="RenamePreviewTable">
                                <thead>
                                    <tr>
                                        <th>{mode === 'conversation-project' ? 'Conversation' : 'Project'}</th>
                                        <th>Current</th>
                                        <th>Proposed</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.length === 0 && (
                                        <tr>
                                            <td colSpan={4}>Enter a manifest to preview changes.</td>
                                        </tr>
                                    )}
                                    {preview.map(row => (
                                        <tr key={row.id}>
                                            <td title={row.id}>{row.label}</td>
                                            <td>{row.originalValue}</td>
                                            <td>{row.proposedValue}</td>
                                            <td>{!row.valid ? row.error : row.changed ? 'Change' : 'Unchanged'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <div className="DialogActions">
                        <button
                            className="Button neutral"
                            disabled={processing || !manifestText}
                            onClick={() => {
                                if (mode === 'conversation-project') setConversationManifest('')
                                else setProjectRenameManifest('')
                                setSummary(null)
                            }}
                        >
                            Clear
                        </button>
                        <button
                            className="Button danger"
                            disabled={busy || previewCounts.invalid > 0 || previewCounts.changed === 0}
                            onClick={applyChanges}
                        >
                            Apply previewed changes
                        </button>
                    </div>

                    <Dialog.Close asChild>
                        <button className="IconButton DialogCloseButton" disabled={processing} aria-label="Close">
                            <IconCross />
                        </button>
                    </Dialog.Close>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
