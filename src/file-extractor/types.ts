export type FileSourceType = 'uploaded' | 'generated' | 'image' | 'unknown'

export type FileAssetClass =
    | 'recoverable_embedded_asset'
    | 'recoverable_backend_asset'
    | 'metadata_only_sandbox_reference'
    | 'citation_url'
    | 'search_result_url'
    | 'conversation_content'
    | 'terminal_or_execution_text'
    | 'unknown_metadata'

export type FileDownloadStatus =
    | 'pending'
    | 'downloaded'
    | 'metadata_only'
    | 'failed'
    | 'skipped_duplicate'

export interface FileReference {
    conversationId: string
    conversationTitle: string
    conversationCreateTime?: number | string
    conversationUpdateTime?: number | string
    messageId?: string
    messageCreateTime?: number | string
    authorRole?: string
    sourceType: FileSourceType
    assetClass?: FileAssetClass
    fileId?: string
    assetPointer?: string
    filename?: string
    extension?: string
    mimeType?: string
    sizeBytes?: number
    rawPath?: string
    rawUrl?: string
    sourceField?: string
    rawValue?: unknown
}

export interface FileInventoryRow extends FileReference {
    downloadStatus: FileDownloadStatus
    zipPath?: string
    failureReason?: string
    duplicateOf?: string
}

export interface FileExtractionStats {
    conversationsScanned: number
    messagesScanned: number
    referencesFound: number
    downloaded: number
    metadataOnly: number
    failed: number
    skippedDuplicates: number
}

export interface FileExtractionOptions {
    includeUploaded?: boolean
    includeGenerated?: boolean
    includeImages?: boolean
    includeUnknown?: boolean
    maxConversations?: number
    onProgress?: (message: string, stats: FileExtractionStats) => void
}
