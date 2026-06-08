import { exportAllFileDiscovery } from '../file-extractor/discoveryExport'
import type { ApiConversationWithId } from '../api'
import type { ExportMeta } from '../ui/SettingContext'

export async function exportAllToFileDiscovery(
    fileNameFormat: string,
    apiConversations: ApiConversationWithId[],
    _metaList?: ExportMeta[],
    _projectName?: string,
    _partIndex?: number,
    _totalParts?: number,
): Promise<boolean> {
    return exportAllFileDiscovery(fileNameFormat, apiConversations)
}
