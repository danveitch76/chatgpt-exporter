import { classifyGeneratedAsset } from '../classifyGeneratedAsset'

interface ClassificationCase {
    name: string
    input: Parameters<typeof classifyGeneratedAsset>[0]
    expected: ReturnType<typeof classifyGeneratedAsset>
}

function assertEqual(name: string, actual: string, expected: string): void {
    if (actual !== expected) {
        throw new Error(`Generated asset classification failed: ${name}. Expected ${expected}, got ${actual}`)
    }
}

const cases: ClassificationCase[] = [
    {
        name: 'embedded generated image',
        input: {
            assetPointer: 'data:image/png;base64,abc123',
            sourceField: 'message.metadata.aggregate_result.messages[0].image_url',
        },
        expected: 'generated-image',
    },
    {
        name: 'sediment generated image',
        input: {
            assetPointer: 'sediment://file-generated-chart',
            sourceField: 'message.metadata.aggregate_result.messages[0].image_url',
        },
        expected: 'generated-image',
    },
    {
        name: 'explicit generated filename',
        input: {
            filename: 'report.xlsx',
            sourceField: 'message.content.parts[0]',
        },
        expected: 'generated-file',
    },
    {
        name: 'sandbox path mention',
        input: {
            rawValue: 'Created file: sandbox:/mnt/data/report.md',
            sourceField: 'message.content.parts[0]',
        },
        expected: 'sandbox-path-mention',
    },
    {
        name: 'file-like text reference',
        input: {
            rawValue: 'Download report.zip when ready.',
            sourceField: 'message.content.text',
        },
        expected: 'file-like-text-reference',
    },
    {
        name: 'citation url',
        input: {
            sourceField: 'message.metadata.citation_metadata.url',
        },
        expected: 'citation-url',
    },
    {
        name: 'search result url',
        input: {
            sourceField: 'message.metadata.search_result_groups[0].entries[0].url',
        },
        expected: 'search-result-url',
    },
    {
        name: 'content reference url',
        input: {
            sourceField: 'message.metadata.content_references[0].items[0].url',
        },
        expected: 'content-reference-url',
    },
    {
        name: 'execution code',
        input: {
            sourceField: 'message.metadata.aggregate_result.code',
        },
        expected: 'execution-code',
    },
    {
        name: 'execution output text',
        input: {
            sourceField: 'message.metadata.aggregate_result.jupyter_messages[2].content.text',
        },
        expected: 'execution-output-text',
    },
    {
        name: 'conversation content',
        input: {
            sourceField: 'message.content.text',
            rawValue: 'Dan, done.',
        },
        expected: 'conversation-content',
    },
    {
        name: 'unknown metadata',
        input: {
            sourceField: 'message.metadata.unknown_field',
        },
        expected: 'unknown-generated-reference',
    },
]

for (const testCase of cases) {
    assertEqual(
        testCase.name,
        classifyGeneratedAsset(testCase.input),
        testCase.expected,
    )
}

export const generatedAssetClassificationCases = cases
