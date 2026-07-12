import { classifyFileReference, isRecoverableAssetClass } from '../classifyFileReference'
import type { FileReference } from '../types'

function assert(name: string, condition: boolean): void {
    if (!condition) throw new Error(`File reference classification validation failed: ${name}`)
}

const embeddedAsset: FileReference = {
    conversationId: 'c1',
    conversationTitle: 'Uploaded Image',
    messageId: 'm1',
    authorRole: 'user',
    sourceType: 'uploaded',
    assetPointer: 'data:image/png;base64,aGVsbG8=',
    sourceField: 'message.content.parts[0].asset_pointer',
}

const backendAsset: FileReference = {
    conversationId: 'c2',
    conversationTitle: 'Uploaded File',
    messageId: 'm2',
    authorRole: 'user',
    sourceType: 'uploaded',
    fileId: 'file-abc123',
    sourceField: 'message.metadata.file_id',
}

const sandboxReference: FileReference = {
    conversationId: 'c3',
    conversationTitle: 'Generated Markdown',
    messageId: 'm3',
    authorRole: 'assistant',
    sourceType: 'generated',
    rawPath: 'sandbox:/mnt/data/report.md',
    sourceField: 'message.content.parts[0]',
}

const citationUrl: FileReference = {
    conversationId: 'c4',
    conversationTitle: 'Citation',
    messageId: 'm4',
    authorRole: 'assistant',
    sourceType: 'generated',
    assetPointer: '/c/abc',
    sourceField: 'message.metadata.conversation_context_citation_metadata[0].citation.url',
}

const searchResultUrl: FileReference = {
    conversationId: 'c5',
    conversationTitle: 'Search Result',
    messageId: 'm5',
    authorRole: 'assistant',
    sourceType: 'generated',
    rawUrl: 'https://example.com/result',
    sourceField: 'message.metadata.aggregate_result.messages[0].metadata.search_result.url',
}

const terminalText: FileReference = {
    conversationId: 'c6',
    conversationTitle: 'Terminal',
    messageId: 'm6',
    authorRole: 'user',
    sourceType: 'uploaded',
    filename: 'askmr@DESKTOP-DAN PowerShell command output',
    sourceField: 'message.content.parts[0]',
    rawValue: 'askmr@DESKTOP-DAN C:\\repo> git status',
}

assert('embedded asset classified', classifyFileReference(embeddedAsset) === 'recoverable_embedded_asset')
assert('backend asset classified', classifyFileReference(backendAsset) === 'recoverable_backend_asset')
assert('sandbox reference classified', classifyFileReference(sandboxReference) === 'metadata_only_sandbox_reference')
assert('citation URL classified', classifyFileReference(citationUrl) === 'citation_url')
assert('search result URL classified', classifyFileReference(searchResultUrl) === 'search_result_url')
assert('terminal text classified', classifyFileReference(terminalText) === 'terminal_or_execution_text')

assert('embedded asset is recoverable', isRecoverableAssetClass(classifyFileReference(embeddedAsset)))
assert('backend asset is recoverable', isRecoverableAssetClass(classifyFileReference(backendAsset)))
assert('citation URL is not recoverable', !isRecoverableAssetClass(classifyFileReference(citationUrl)))
assert('search result URL is not recoverable', !isRecoverableAssetClass(classifyFileReference(searchResultUrl)))
assert('sandbox reference is not recoverable', !isRecoverableAssetClass(classifyFileReference(sandboxReference)))
