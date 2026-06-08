import type { ApiConversationWithId } from '../../api'

export const fileExtractionFixture: ApiConversationWithId = {
    id: 'fixture-conversation',
    title: 'Fixture Conversation',
    create_time: 1780000000,
    update_time: 1780000100,
    current_node: 'fileIdentifier',
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
                        'Please review this image.',
                        {
                            content_type: 'image_asset_pointer',
                            asset_pointer: 'sediment://file-uploaded-image',
                            size_bytes: 12345,
                            width: 800,
                            height: 600,
                            fovea: 0,
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
        generatedSandboxFile: {
            id: 'generatedSandboxFile',
            parent: 'uploadedImage',
            children: [],
            message: {
                id: 'msg-generated-sandbox-file',
                author: { role: 'assistant', metadata: {} },
                create_time: 1780000002,
                content: {
                    content_type: 'text',
                    parts: [
                        'Created file: sandbox:/mnt/data/report.md',
                    ],
                },
                status: 'finished_successfully',
                end_turn: true,
                weight: 1,
                metadata: {},
                recipient: 'all',
            },
        },
        generatedExecutionImage: {
            id: 'generatedExecutionImage',
            parent: 'generatedSandboxFile',
            children: [],
            message: {
                id: 'msg-generated-execution-image',
                author: { role: 'tool', name: 'python', metadata: {} },
                create_time: 1780000003,
                content: {
                    content_type: 'execution_output',
                    text: '',
                },
                status: 'finished_successfully',
                weight: 1,
                metadata: {
                    aggregate_result: {
                        code: '',
                        end_time: 1780000004,
                        final_expression_output: '',
                        jupyter_messages: [],
                        messages: [
                            {
                                message_type: 'image',
                                image_url: 'sediment://file-generated-chart',
                                sender: 'server',
                                time: 1780000003,
                                width: 1200,
                                height: 800,
                            },
                        ],
                        run_id: 'fixture-run',
                        start_time: 1780000003,
                        status: 'success',
                        update_time: 1780000004,
                    },
                },
                recipient: 'all',
            },
        },
        fileIdentifier: {
            id: 'fileIdentifier',
            parent: 'generatedExecutionImage',
            children: [],
            message: {
                id: 'msg-file-identifier',
                author: { role: 'assistant', metadata: {} },
                create_time: 1780000004,
                content: {
                    content_type: 'text',
                    parts: [
                        'Download file file-abc123xyz from sandbox:/mnt/data/export.zip',
                    ],
                },
                status: 'finished_successfully',
                end_turn: true,
                weight: 1,
                metadata: {},
                recipient: 'all',
            },
        },
    },
}
