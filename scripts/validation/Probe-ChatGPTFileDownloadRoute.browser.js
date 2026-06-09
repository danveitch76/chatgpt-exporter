/**
 * ChatGPT Exporter — Live File Download Route Probe
 *
 * Usage:
 * 1. Open ChatGPT in the browser while authenticated.
 * 2. Open DevTools Console.
 * 3. Replace FILE_ID with a real file-* identifier from file discovery inventory.
 * 4. Paste and run this script.
 * 5. Copy the JSON result into validation evidence.
 */

(async () => {
    const FILE_ID = 'file-REPLACE_ME'

    if (FILE_ID === 'file-REPLACE_ME') {
        throw new Error('Set FILE_ID to a real file-* identifier before running.')
    }

    const route = `/backend-api/files/download/${encodeURIComponent(FILE_ID)}?post_id=&inline=false`

    const result = {
        fileId: FILE_ID,
        route,
        routeStatus: null,
        routeOk: false,
        routeContentType: null,
        responseJson: null,
        signedDownloadUrlPresent: false,
        signedDownloadStatus: null,
        signedDownloadOk: false,
        signedDownloadContentType: null,
        signedDownloadSizeBytes: null,
        error: null,
    }

    try {
        const routeResponse = await fetch(route, {
            credentials: 'include',
        })

        result.routeStatus = routeResponse.status
        result.routeOk = routeResponse.ok
        result.routeContentType = routeResponse.headers.get('content-type')

        const text = await routeResponse.text()

        try {
            result.responseJson = JSON.parse(text)
        }
        catch {
            result.responseJson = { rawText: text.slice(0, 1000) }
        }

        const downloadUrl = result.responseJson?.download_url

        if (typeof downloadUrl === 'string' && downloadUrl.length > 0) {
            result.signedDownloadUrlPresent = true

            const signedResponse = await fetch(downloadUrl)
            result.signedDownloadStatus = signedResponse.status
            result.signedDownloadOk = signedResponse.ok
            result.signedDownloadContentType = signedResponse.headers.get('content-type')

            const blob = await signedResponse.blob()
            result.signedDownloadSizeBytes = blob.size
        }
    }
    catch (error) {
        result.error = error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : { message: String(error) }
    }

    console.log(JSON.stringify(result, null, 2))
})()
