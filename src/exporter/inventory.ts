import { downloadFile, normalizeProjectName } from '../utils/download'
import type { ApiConversationItem, ApiProjectInfo } from '../api'

export type InventoryKind = 'projects' | 'chats'
export type InventoryFormat = 'json' | 'txt' | 'html' | 'md'

export interface ProjectInventoryRow {
    URL: string
    Token: string
    GizmoID: string
    Slug: string
    'Actual Project Name': string
}

export interface ChatInventoryRow {
    URL: string
    Token: string
    Slug: string
    'Actual Chat Name': string
    'Project Name': string
}

export type InventoryRow = ProjectInventoryRow | ChatInventoryRow

const PROJECT_HEADERS: Array<keyof ProjectInventoryRow> = [
    'URL',
    'Token',
    'GizmoID',
    'Slug',
    'Actual Project Name',
]

const CHAT_HEADERS: Array<keyof ChatInventoryRow> = [
    'URL',
    'Token',
    'Slug',
    'Actual Chat Name',
    'Project Name',
]

const PROJECT_ID_PATTERN = /^(g-p-[a-f0-9]{32})(?:-(.+))?$/i

interface ProjectIdentity {
    gizmoId: string
    slug: string
    token: string
}

export function slugifyInventoryName(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036F]/g, '')
        .replace(/[’']/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
}

function projectIdentity(projectId: string, projectName: string): ProjectIdentity {
    const match = projectId.match(PROJECT_ID_PATTERN)
    const gizmoId = match?.[1] ?? projectId
    const slug = match?.[2] || slugifyInventoryName(projectName)
    const token = slug ? `${gizmoId}-${slug}` : gizmoId
    return { gizmoId, slug, token }
}

export function normaliseGizmoId(value: string | null | undefined): string {
    if (!value) return ''
    return projectIdentity(value, '').gizmoId
}

export function buildProjectToken(projectId: string, projectName: string): string {
    return projectIdentity(projectId, projectName).token
}

export function buildProjectInventoryRows(
    projects: ApiProjectInfo[],
    allowedProjectIds?: ReadonlySet<string>,
): ProjectInventoryRow[] {
    const seen = new Set<string>()

    return projects.flatMap((project) => {
        const projectName = project.display?.name?.trim() || ''
        const identity = projectIdentity(project.id, projectName)
        if (!identity.gizmoId || seen.has(identity.gizmoId)) return []
        if (allowedProjectIds && !allowedProjectIds.has(identity.gizmoId)) return []

        seen.add(identity.gizmoId)

        return [{
            URL: `https://chatgpt.com/g/${identity.token}/project`,
            Token: identity.token,
            GizmoID: identity.gizmoId,
            Slug: identity.slug,
            'Actual Project Name': projectName,
        }]
    })
}

export function buildChatInventoryRows(
    conversations: Array<Pick<ApiConversationItem, 'id' | 'title' | 'gizmo_id'>>,
    projects: ApiProjectInfo[],
): ChatInventoryRow[] {
    const projectNameById = new Map(
        projects.map(project => [normaliseGizmoId(project.id), project.display?.name?.trim() || '']),
    )
    const seen = new Set<string>()

    return conversations.flatMap((conversation) => {
        const token = conversation.id?.trim()
        if (!token || seen.has(token)) return []
        seen.add(token)

        const actualChatName = conversation.title?.trim() || ''
        const projectId = normaliseGizmoId(conversation.gizmo_id)

        return [{
            URL: `https://chatgpt.com/c/${token}`,
            Token: token,
            Slug: slugifyInventoryName(actualChatName) || token,
            'Actual Chat Name': actualChatName,
            'Project Name': projectId ? projectNameById.get(projectId) || '' : '',
        }]
    })
}

function headersFor(kind: InventoryKind): string[] {
    return kind === 'projects' ? PROJECT_HEADERS : CHAT_HEADERS
}

function valueFor(row: InventoryRow, header: string): string {
    return String((row as unknown as Record<string, string>)[header] ?? '')
}

function escapePlainText(value: string): string {
    return value.replace(/[\t\r\n]+/g, ' ')
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function escapeMarkdown(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\|/g, '\\|')
        .replace(/[\r\n]+/g, ' ')
}

export function serialiseInventoryJson(rows: InventoryRow[]): string {
    return `${JSON.stringify(rows, null, 2)}\n`
}

export function serialiseInventoryText(kind: InventoryKind, rows: InventoryRow[]): string {
    const headers = headersFor(kind)
    const lines = [headers.join('\t')]
    for (const row of rows) {
        lines.push(headers.map(header => escapePlainText(valueFor(row, header))).join('\t'))
    }
    return `${lines.join('\n')}\n`
}

export function serialiseInventoryHtml(kind: InventoryKind, rows: InventoryRow[]): string {
    const headers = headersFor(kind)
    const title = kind === 'projects' ? 'ChatGPT Project List' : 'ChatGPT Chat List'
    const head = headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')
    const body = rows.map(row => (
        `<tr>${headers.map(header => `<td>${escapeHtml(valueFor(row, header))}</td>`).join('')}</tr>`
    )).join('\n')

    return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${escapeHtml(title)}</title>\n<style>body{font-family:system-ui,sans-serif;margin:2rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:.4rem;text-align:left;vertical-align:top}th{background:#f3f4f6}td{word-break:break-word}</style>\n</head>\n<body>\n<h1>${escapeHtml(title)}</h1>\n<table>\n<thead><tr>${head}</tr></thead>\n<tbody>\n${body}\n</tbody>\n</table>\n</body>\n</html>\n`
}

export function serialiseInventoryMarkdown(kind: InventoryKind, rows: InventoryRow[]): string {
    const headers = headersFor(kind)
    const title = kind === 'projects' ? '# ChatGPT Project List' : '# ChatGPT Chat List'
    const separator = headers.map(() => '---').join(' | ')
    const lines = [
        title,
        '',
        `| ${headers.join(' | ')} |`,
        `| ${separator} |`,
        ...rows.map(row => `| ${headers.map(header => escapeMarkdown(valueFor(row, header))).join(' | ')} |`),
    ]
    return `${lines.join('\n')}\n`
}

function buildInventoryFileName(kind: InventoryKind, extension: InventoryFormat, projectName?: string): string {
    const scope = projectName ? `-project-${normalizeProjectName(projectName)}` : ''
    const base = kind === 'projects' ? 'chatgpt-project-list' : 'chatgpt-chat-list'
    return `${base}${scope}.${extension}`
}

export function exportInventoryJson(kind: InventoryKind, rows: InventoryRow[], projectName?: string): boolean {
    downloadFile(buildInventoryFileName(kind, 'json', projectName), 'application/json', serialiseInventoryJson(rows))
    return true
}

export function exportInventoryText(kind: InventoryKind, rows: InventoryRow[], projectName?: string): boolean {
    downloadFile(buildInventoryFileName(kind, 'txt', projectName), 'text/plain;charset=utf-8', serialiseInventoryText(kind, rows))
    return true
}

export function exportInventoryHtml(kind: InventoryKind, rows: InventoryRow[], projectName?: string): boolean {
    downloadFile(buildInventoryFileName(kind, 'html', projectName), 'text/html;charset=utf-8', serialiseInventoryHtml(kind, rows))
    return true
}

export function exportInventoryMarkdown(kind: InventoryKind, rows: InventoryRow[], projectName?: string): boolean {
    downloadFile(buildInventoryFileName(kind, 'md', projectName), 'text/markdown;charset=utf-8', serialiseInventoryMarkdown(kind, rows))
    return true
}
