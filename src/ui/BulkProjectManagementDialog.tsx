import * as Dialog from '@radix-ui/react-dialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { fetchAllConversationsAll, fetchProjects } from '../api'
import { moveConversationToProject, renameProject } from '../projectManagement'
import { RequestQueue } from '../utils/queue'
import { IconCross, IconLoading } from './Icons'
import { buildProjectManagementPreview } from './projectManagementManifest'
import { useSettingContext } from './SettingContext'
import type { ApiConversationItem, ApiProjectInfo } from '../api'
import type { ProjectManagementResult } from '../projectManagement'
import type { ProjectManagementPreviewRow } from './projectManagementManifest'
import type { FC } from '../type'

interface BulkProjectManagementDialogProps {
    open: boolean
    onOpenChange: (value: boolean) => void
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

function actionLabel(action: ProjectManagementPreviewRow['action']): string {
    return action === 'moveConversation' ? 'Move conversation' : 'Rename Project'
}

export const BulkProjectManagementDialog: FC<BulkProjectManagementDialogProps> = ({ open, onOpenChange, children }) => {
    const { exportAllLimit } = useSettingContext()
    const [projects, setProjects] = useState<ApiProjectInfo[]>([])
    const [projectsLoaded, setProjectsLoaded] = useState(false)
    const [projectsLoading, setProjectsLoading] = useState(false)
    const [conversations, setConversations] = useState<ApiConversationItem[]>([])
    const [conversationsLoading, setConversationsLoading] = useState(false)
    const [manifest, setManifest] = useState('')
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState('')
    const [summary, setSummary] = useState<ManagementSummary | null>(null)
    const [progress, setProgress] = useState({ total: 0, completed: 0, currentName: '' })

    const queue = useMemo(() => new RequestQueue<ProjectManagementResult>(200, 1600), [])
    const pendingPlanRef = useRef<ProjectManagementPreviewRow[]>([])
    const pendingUnchangedRef = useRef(0)
    const pendingInvalidRef = useRef(0)

    const projectIds = useMemo(() => projects.map(project => project.id), [projects])

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
        if (!open || !projectsLoaded) return
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
    }, [exportAllLimit, open, projects, projectsLoaded])

    const rawPreview = useMemo(
        () => buildProjectManagementPreview(manifest, conversations, projects),
        [manifest, conversations, projects],
    )
    const preview = rawPreview.rows
    const manifestError = rawPreview.error

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
        const off = queue.on('progress', event => setProgress({
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

            if (successful.size > 0) {
                setConversations(previous => previous.map((conversation) => {
                    const result = successful.get(conversation.id)
                    return result?.kind === 'conversation-project' && result.projectId
                        ? { ...conversation, gizmo_id: result.projectId }
                        : conversation
                }))
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
        const approved = confirm(
            `Apply ${plan.length} previewed Project-management change${plan.length === 1 ? '' : 's'}?`,
        )
        if (!approved) return

        pendingPlanRef.current = plan
        pendingUnchangedRef.current = previewCounts.unchanged
        pendingInvalidRef.current = previewCounts.invalid
        setSummary(null)
        setProcessing(true)
        setProgress({ total: plan.length, completed: 0, currentName: '' })

        queue.clear()
        for (const row of plan) {
            if (row.action === 'moveConversation') {
                queue.add({
                    name: row.label,
                    request: () => moveConversationToProject(
                        row.id,
                        row.originalProjectId ?? null,
                        row.proposedProjectId!,
                        projectIds,
                    ),
                })
            }
            else {
                queue.add({
                    name: row.label,
                    request: () => renameProject(row.id, row.originalValue, row.proposedValue),
                })
            }
        }
        queue.start()
    }, [preview, previewCounts, processing, projectIds, queue])

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
                        : `${preview.length} action${preview.length === 1 ? '' : 's'} loaded`
    let statusDetail = ''
    if (processing) {
        statusDetail = progress.currentName
    }
    else if (!error && !busy) {
        statusDetail = `${conversations.length} conversations across general + Project sources · general scan limit ${exportAllLimit}`
    }

    return (
        <Dialog.Root open={open} onOpenChange={closeGuarded}>
            <Dialog.Trigger asChild>{children}</Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="DialogOverlay" />
                <Dialog.Content
                    className="DialogContent _export BulkProjectManagementDialog"
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

                    <section className="ProjectManagementManifest" aria-label="Project management manifest">
                        <label className="ProjectManagementSectionTitle" htmlFor="project-management-manifest">
                            Approved JSON manifest
                        </label>
                        <textarea
                            id="project-management-manifest"
                            className="ProjectManagementManifestInput"
                            rows={12}
                            spellCheck={false}
                            disabled={busy}
                            value={manifest}
                            placeholder={'[\n  {"action":"moveConversation","id":"<conversation-id>","expectedProjectId":null,"newProjectId":"g-p-..."},\n  {"action":"renameProject","id":"g-p-...","expectedName":"Current name","newName":"New name"}\n]'}
                            onInput={(event: Event) => {
                                setManifest((event.currentTarget as HTMLTextAreaElement).value)
                                setSummary(null)
                            }}
                        />
                        <div className="RenameHelpText">
                            One manifest can contain any number of moveConversation and renameProject actions.
                            Every action is validated against current state before Apply is enabled.
                        </div>
                    </section>

                    <section className="ProjectManagementPreview" aria-label="Project management preview">
                        <div className="ProjectManagementPreviewHeader">
                            <span>Preview</span>
                            <span>
                                change {previewCounts.changed} · unchanged {previewCounts.unchanged} · invalid {previewCounts.invalid}
                            </span>
                        </div>
                        {manifestError && <div className="RenameValidationError">{manifestError}</div>}
                        <div className="ProjectManagementPreviewTableWrap">
                            <table className="ProjectManagementPreviewTable">
                                <thead>
                                    <tr>
                                        <th>Action</th>
                                        <th>Item</th>
                                        <th>Current</th>
                                        <th>Proposed</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {preview.length === 0 && (
                                        <tr>
                                            <td colSpan={5}>Enter a manifest to preview changes.</td>
                                        </tr>
                                    )}
                                    {preview.map(row => (
                                        <tr key={row.id}>
                                            <td>{actionLabel(row.action)}</td>
                                            <td title={row.id}>{row.label}</td>
                                            <td>{row.originalValue}</td>
                                            <td>{row.proposedValue}</td>
                                            <td className={row.valid ? '' : 'ProjectManagementInvalid'}>
                                                {!row.valid ? row.error : row.changed ? 'Ready' : 'Unchanged'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <div className="DialogActions ProjectManagementActions">
                        <button
                            className="Button neutral"
                            disabled={processing || !manifest}
                            onClick={() => {
                                setManifest('')
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
                            Apply {previewCounts.changed} previewed change{previewCounts.changed === 1 ? '' : 's'}
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
