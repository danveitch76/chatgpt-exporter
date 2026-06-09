import { classifyGeneratedAsset } from '../classifyGeneratedAsset'

interface FailureRecoveryCase {
    name: string
    input: Parameters<typeof classifyGeneratedAsset>[0]
    expected: ReturnType<typeof classifyGeneratedAsset>
}

function assertEqual(name: string, actual: string, expected: string): void {
    if (actual !== expected) {
        throw new Error(`Failure recovery classification failed: ${name}. Expected ${expected}, got ${actual}`)
    }
}

const cases: FailureRecoveryCase[] = [
    {
        name: 'empty generated reference does not crash',
        input: {},
        expected: 'unknown-generated-reference',
    },
    {
        name: 'missing asset pointer with citation source is classified',
        input: {
            sourceField: 'message.metadata.citation_metadata.url',
        },
        expected: 'citation-url',
    },
    {
        name: 'missing asset pointer with search source is classified',
        input: {
            sourceField: 'message.metadata.search_result_groups[0].entries[0].url',
        },
        expected: 'search-result-url',
    },
    {
        name: 'missing asset pointer with execution output source is classified',
        input: {
            sourceField: 'message.metadata.aggregate_result.jupyter_messages[2].content.text',
        },
        expected: 'execution-output-text',
    },
    {
        name: 'malformed text with no file signal becomes conversation content',
        input: {
            sourceField: 'message.content.text',
            rawValue: 'Dan, done.',
        },
        expected: 'conversation-content',
    },
    {
        name: 'sandbox mention remains metadata not direct recovery',
        input: {
            sourceField: 'message.content.parts[0]',
            rawValue: 'Created file: sandbox:/mnt/data/report.md',
        },
        expected: 'sandbox-path-mention',
    },
    {
        name: 'plain unknown metadata is preserved as unknown',
        input: {
            sourceField: 'message.metadata.some_new_unexpected_shape',
            rawValue: 'unexpected content',
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

export const failureRecoveryClassificationCases = cases
