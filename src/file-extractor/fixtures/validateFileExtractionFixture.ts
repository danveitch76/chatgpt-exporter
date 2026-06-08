import { buildInventory } from '../buildInventory'
import { fileExtractionFixture } from './fileExtractionFixture'

interface Assertion {
    name: string
    passed: boolean
}

function assert(name: string, condition: boolean): Assertion {
    if (!condition) throw new Error(`Fixture validation failed: ${name}`)
    return { name, passed: true }
}

const result = buildInventory([fileExtractionFixture])
const inventory = result.inventory

const assertions: Assertion[] = [
    assert('scans one conversation', result.stats.conversationsScanned === 1),
    assert('scans fixture messages', result.stats.messagesScanned >= 4),
    assert('finds file references', result.stats.referencesFound >= 4),
    assert(
        'finds uploaded sediment image asset',
        inventory.some(row =>
            row.sourceType === 'image'
            && row.assetPointer === 'sediment://file-uploaded-image',
        ),
    ),
    assert(
        'finds generated execution image asset',
        inventory.some(row =>
            row.sourceType === 'image'
            && row.assetPointer === 'sediment://file-generated-chart',
        ),
    ),
    assert(
        'finds generated sandbox report path',
        inventory.some(row =>
            row.sourceType === 'generated'
            && row.rawPath?.includes('/mnt/data/report.md'),
        ),
    ),
    assert(
        'finds generated sandbox export path',
        inventory.some(row =>
            row.sourceType === 'generated'
            && row.rawPath?.includes('/mnt/data/export.zip'),
        ),
    ),
    assert(
        'finds file identifier',
        inventory.some(row => row.rawPath?.includes('file-abc123xyz')),
    ),
    assert(
        'marks unresolved path references as metadata-only',
        inventory.some(row =>
            row.rawPath?.includes('/mnt/data/report.md')
            && row.downloadStatus === 'metadata_only',
        ),
    ),
]

export const validatedAssertions = assertions
