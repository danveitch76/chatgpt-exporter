import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'
import monkey, { cdn } from 'vite-plugin-monkey'
import packageJson from './package.json'

// https://vitejs.dev/config/
export default defineConfig({
    define: {
        __EXPORTER_VERSION__: JSON.stringify(packageJson.version),
    },
    // https://github.com/lisonge/vite-plugin-monkey/issues/10#issuecomment-1207264978
    esbuild: {
        charset: 'utf8',
    },
    plugins: [
        preact({
            devToolsEnabled: false,
            devtoolsInProd: false,
        }),
        monkey({
            entry: 'src/main.tsx',
            userscript: {
                'name': {
                    '': packageJson.title,
                    'zh-CN': packageJson['title:zh-CN'],
                    'zh-TW': packageJson['title:zh-TW'],
                },
                'author': packageJson.author,
                'namespace': packageJson.author,
                'description': {
                    '': packageJson.description,
                    'zh-CN': packageJson['description:zh-CN'],
                    'zh-TW': packageJson['description:zh-TW'],
                },
                'license': packageJson.license,
                'updateURL': 'https://raw.githubusercontent.com/danveitch76/chatgpt-exporter/master/dist/chatgpt.user.js',
                'downloadURL': 'https://raw.githubusercontent.com/danveitch76/chatgpt-exporter/master/dist/chatgpt.user.js',
                'match': [
                    // Include new application routes as well as existing chat,
                    // Project and share routes; remain restricted to these hosts.
                    'https://chat.openai.com/*',
                    'https://chatgpt.com/*',
                ],
                'icon': 'https://chatgpt.com/favicon.ico',
                'run-at': 'document-end',
            },
            build: {
                fileName: 'chatgpt.user.js',
                externalGlobals: [
                    ['jszip', cdn.jsdelivr('JSZip', 'dist/jszip.min.js')],
                    ['html2canvas', cdn.jsdelivr('html2canvas', 'dist/html2canvas.min.js')],
                ],
                cssSideEffects() {
                    return (e) => {
                        const o = document.createElement('style')
                        o.textContent = e
                        document.head.append(o)
                        setInterval(() => {
                            if (o.isConnected) return
                            document.head.append(o)
                        }, 300)
                    }
                },
            },
            server: {
                open: true,
            },
        }),
    ],
    build: {
        cssMinify: false,
    },
})
