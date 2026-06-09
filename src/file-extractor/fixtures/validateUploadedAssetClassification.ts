import { scanConversationForFiles } from '../scanConversation'
import type { ApiConversationWithId } from '../../api'

function assert(name: string, condition: boolean): void {
    if (!condition) throw new Error(`Uploaded asset classification failed: ${name}`)
}

const terminalTextFixture: ApiConversationWithId = {
    id: 'terminal-text-fixture',
    title: 'Terminal Text Fixture',
    create_time: 1780000000,
    update_time: 1780000100,
    current_node: 'terminalText',
    moderation_results: [],
    is_archived: false,
    mapping: {
        terminalText: {
            id: 'terminalText',
            children: [],
            message: {
                id: 'msg-terminal-text',
                author: { role: 'user', metadata: {} },
                create_time: 1780000001,
                content: {
                    content_type: 'text',
                    parts: [
                        'askmr@DESKTOP-DAN[2026-06-08 17:39:47] C:\\Users\\askmr\\OneDrive\\_DanOS\\dev\\git\\chatgpt-exporter$ Select-String -Path .\\src\\api.ts -Pattern "asset","attachment","file"',
                    ],
                },
                status: 'finished_successfully',
                weight: 1,
                metadata: {},
                recipient: 'all',
            },
        },
    },
}

const uploadedImageFixture: ApiConversationWithId = {
    id: 'uploaded-image-fixture',
    title: 'Uploaded Image Fixture',
    create_time: 1780000000,
    update_time: 1780000100,
    current_node: 'uploadedImage',
    moderation_results: [],
    is_archived: false,
    mapping: {
        uploadedImage: {
            id: 'uploadedImage',
            children: [],
            message: {
                id: 'msg-uploaded-image',
                author: { role: 'user', metadata: {} },
                create_time: 1780000001,
                content: {
                    content_type: 'multimodal_text',
                    parts: [
                        {
                            content_type: 'image_asset_pointer',
                            asset_pointer: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB',
                            fovea: 0,
                            height: 1,
                            size_bytes: 128,
                            width: 1,
                            metadata: {},
                        },
                    ],
                },
                status: 'finished_successfully',
                weight: 1,
                metadata: {},
                recipient: 'all',
            },
        },
    },
}

const terminalInventory = scanConversationForFiles(terminalTextFixture)
const uploadedImageInventory = scanConversationForFiles(uploadedImageFixture)

assert(
    'terminal text is not classified as uploaded asset',
    !terminalInventory.some(row => row.sourceType === 'uploaded'),
)

assert(
    'structured uploaded image remains classified as uploaded asset',
    uploadedImageInventory.some(row =>
        row.sourceType === 'uploaded'
        && row.assetPointer?.startsWith('data:image/png;base64,'),
    ),
)

export const uploadedAssetClassificationValidation = {
    terminalRows: terminalInventory.length,
    uploadedImageRows: uploadedImageInventory.length,
}
