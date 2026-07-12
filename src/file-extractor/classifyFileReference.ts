import type { FileAssetClass, FileReference } from './types'

export function classifyFileReference(reference: FileReference): FileAssetClass {
    const rawText = [
        reference.assetPointer,
        reference.rawPath,
        reference.rawUrl,
        reference.filename,
        reference.sourceField,
        typeof reference.rawValue === 'string' ? reference.rawValue : undefined,
    ]
        .filter(Boolean)
        .join(' ')

    if (isEmbeddedAsset(reference)) {
        return 'recoverable_embedded_asset'
    }

    if (isBackendAsset(reference)) {
        return 'recoverable_backend_asset'
    }

    if (isSandboxReference(reference)) {
        return 'metadata_only_sandbox_reference'
    }

    if (isCitationUrl(reference)) {
        return 'citation_url'
    }

    if (isSearchResultUrl(reference)) {
        return 'search_result_url'
    }

    if (isTerminalOrExecutionText(rawText)) {
        return 'terminal_or_execution_text'
    }

    if (isLikelyConversationContent(reference, rawText)) {
        return 'conversation_content'
    }

    return 'unknown_metadata'
}

export function isRecoverableAssetClass(assetClass?: FileAssetClass): boolean {
    return assetClass === 'recoverable_embedded_asset'
        || assetClass === 'recoverable_backend_asset'
}

function isEmbeddedAsset(reference: FileReference): boolean {
    return typeof reference.assetPointer === 'string'
        && reference.assetPointer.startsWith('data:')
}

function isBackendAsset(reference: FileReference): boolean {
    if (typeof reference.fileId === 'string' && reference.fileId.startsWith('file-')) {
        return true
    }

    if (typeof reference.assetPointer === 'string' && reference.assetPointer.startsWith('file-')) {
        return true
    }

    if (typeof reference.assetPointer === 'string' && reference.assetPointer.includes('/files/download/')) {
        return true
    }

    if (typeof reference.rawUrl === 'string' && reference.rawUrl.includes('/files/download/')) {
        return true
    }

    return false
}

function isSandboxReference(reference: FileReference): boolean {
    const values = [
        reference.rawPath,
        reference.assetPointer,
        reference.rawUrl,
        typeof reference.rawValue === 'string' ? reference.rawValue : undefined,
    ].filter(Boolean)

    return values.some(value =>
        typeof value === 'string'
        && (
            value.startsWith('sandbox:/mnt/data/')
            || value.startsWith('/mnt/data/')
            || value.includes('sandbox:/mnt/data/')
            || value.includes('/mnt/data/')
        ),
    )
}

function isCitationUrl(reference: FileReference): boolean {
    return reference.sourceField?.includes('citation') === true
        || reference.sourceField?.includes('content_references') === true
        || reference.sourceField?.includes('_cite_metadata') === true
}

function isSearchResultUrl(reference: FileReference): boolean {
    return reference.sourceField?.includes('search_result') === true
        || reference.sourceField?.includes('aggregate_result') === true
        || reference.sourceField?.includes('webpage') === true
        || reference.rawUrl?.startsWith('http') === true
}

function isTerminalOrExecutionText(text: string): boolean {
    return /askmr@DESKTOP|PowerShell|Traceback|Exception|Line \||^\s*at\s+/m.test(text)
}

function isLikelyConversationContent(reference: FileReference, text: string): boolean {
    if (reference.authorRole === 'assistant' && !reference.fileId && !reference.rawPath && !reference.rawUrl) {
        return true
    }

    return text.length > 120
        && !text.includes('/files/download/')
        && !text.includes('sandbox:/mnt/data/')
        && !text.includes('/mnt/data/')
}
