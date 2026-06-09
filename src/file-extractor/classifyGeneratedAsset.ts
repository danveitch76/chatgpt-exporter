export type GeneratedAssetClass =
    | 'generated-file'
    | 'generated-image'
    | 'sandbox-path-mention'
    | 'file-like-text-reference'
    | 'execution-code'
    | 'execution-output-text'
    | 'citation-url'
    | 'search-result-url'
    | 'content-reference-url'
    | 'conversation-content'
    | 'unknown-generated-reference'

export interface GeneratedAssetClassificationInput {
    sourceField?: string
    rawValue?: string
    assetPointer?: string
    filename?: string
}

export function classifyGeneratedAsset(input: GeneratedAssetClassificationInput): GeneratedAssetClass {
    const sourceField = input.sourceField ?? ''
    const rawValue = input.rawValue ?? ''
    const assetPointer = input.assetPointer ?? ''
    const filename = input.filename ?? ''

    if (/^data:image\/[^;]+;base64,/i.test(assetPointer)) {
        return 'generated-image'
    }

    if (assetPointer.startsWith('sediment://')) {
        return 'generated-image'
    }

    if (isFileLike(filename)) {
        return 'generated-file'
    }

    if (/\/mnt\/data\/[^\s'"`]+/i.test(rawValue)) {
        return 'sandbox-path-mention'
    }

    if (isFileLike(rawValue)) {
        return 'file-like-text-reference'
    }

    if (/citation_metadata|conversation_context_citation_metadata/i.test(sourceField)) {
        return 'citation-url'
    }

    if (/search_result_groups/i.test(sourceField)) {
        return 'search-result-url'
    }

    if (/content_references/i.test(sourceField)) {
        return 'content-reference-url'
    }

    if (/aggregate_result\.code/i.test(sourceField)) {
        return 'execution-code'
    }

    if (/jupyter_messages|aggregate_result\.messages|final_expression_output|in_kernel_exception/i.test(sourceField)) {
        return 'execution-output-text'
    }

    if (/message\.content\.text|message\.content\.parts|message\.content\.result|message\.content\.thoughts/i.test(sourceField)) {
        return 'conversation-content'
    }

    return 'unknown-generated-reference'
}

function isFileLike(value: string): boolean {
    return /\.(zip|pdf|docx|xlsx|csv|json|md|html|png|jpg|jpeg|webp)(\s|$|["'`])/i.test(value)
}
