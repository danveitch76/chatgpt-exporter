/**
 * ChatGPT Exporter — Live Backend File Resolution Probe
 *
 * Purpose:
 * - prove or disprove recovery of a current ChatGPT backend file identifier;
 * - support both file_... and file-... identifier forms;
 * - validate that returned bytes match known File Discovery metadata;
 * - avoid printing credentials, signed download URLs, file identifiers or filenames.
 *
 * Usage:
 * 1. Run File Discovery for a conversation containing a known uploaded file.
 * 2. Copy the discovered fileId plus filename, MIME type and size into INPUT.
 * 3. Open ChatGPT while authenticated and open DevTools Console.
 * 4. Paste and run this script.
 * 5. Record only the redacted JSON result as validation evidence.
 */

(async () => {
    const INPUT = {
        fileId: 'file_REPLACE_ME',
        expectedFilename: null,
        expectedMimeType: null,
        expectedSizeBytes: null,
        expectedSha256: null,
    }

    const FILE_ID_PATTERN = /^file[-_][A-Za-z0-9_-]+$/

    if (!FILE_ID_PATTERN.test(INPUT.fileId)) {
        throw new Error('Set INPUT.fileId to a real file_... or file-... identifier from File Discovery.')
    }

    const expectedSizeBytes = INPUT.expectedSizeBytes === null
        ? null
        : Number(INPUT.expectedSizeBytes)

    if (expectedSizeBytes !== null && (!Number.isFinite(expectedSizeBytes) || expectedSizeBytes < 0)) {
        throw new Error('INPUT.expectedSizeBytes must be null or a non-negative number.')
    }

    const normaliseMimeType = value => (
        typeof value === 'string'
            ? value.split(';')[0].trim().toLowerCase()
            : null
    )

    const redactText = (value) => {
        if (typeof value !== 'string') return value

        return value
            .replaceAll(INPUT.fileId, '<file-id>')
            .replace(/https?:\/\/\S+/gi, '<url>')
    }

    const toHex = bytes => Array.from(bytes)
        .map(value => value.toString(16).padStart(2, '0'))
        .join('')

    const sha256 = async (bytes) => {
        const digest = await crypto.subtle.digest('SHA-256', bytes)
        return toHex(new Uint8Array(digest))
    }

    const allProvidedChecksPass = checks => Object.values(checks)
        .filter(value => value !== null)
        .every(Boolean)

    const route = `/backend-api/files/download/${encodeURIComponent(INPUT.fileId)}?post_id=&inline=false`

    const result = {
        probeVersion: 2,
        testedAt: new Date().toISOString(),
        identifierForm: INPUT.fileId.startsWith('file_') ? 'file_underscore' : 'file-hyphen',
        routePattern: '/backend-api/files/download/<file-id>?post_id=&inline=false',
        routeStatus: null,
        routeOk: false,
        routeContentType: null,
        backendStatus: null,
        backendErrorCode: null,
        backendErrorMessage: null,
        backendFilenamePresent: false,
        backendMimeType: null,
        backendSizeBytes: null,
        signedDownloadUrlPresent: false,
        signedDownloadStatus: null,
        signedDownloadOk: false,
        signedDownloadContentType: null,
        signedDownloadSizeBytes: null,
        signedDownloadSha256: null,
        checks: {
            expectedFilenameMatches: null,
            expectedMimeTypeMatches: null,
            expectedSizeMatches: null,
            expectedSha256Matches: null,
            nonZeroBytes: false,
        },
        retrievalSucceeded: false,
        expectedMetadataComplete: false,
        expectedAssetMetadataMatched: false,
        acceptanceGatePassed: false,
        evidenceLevel: 'failed',
        error: null,
    }

    try {
        const routeResponse = await fetch(route, {
            credentials: 'include',
        })

        result.routeStatus = routeResponse.status
        result.routeOk = routeResponse.ok
        result.routeContentType = routeResponse.headers.get('content-type')

        const responseText = await routeResponse.text()
        let responseJson = null

        try {
            responseJson = JSON.parse(responseText)
        }
        catch {
            throw new Error(
                `Backend route returned non-JSON content (HTTP ${routeResponse.status}, ${result.routeContentType ?? 'unknown content type'}).`,
            )
        }

        result.backendStatus = typeof responseJson?.status === 'string' ? responseJson.status : null
        result.backendErrorCode = typeof responseJson?.error_code === 'string' ? responseJson.error_code : null
        result.backendErrorMessage = typeof responseJson?.error_message === 'string'
            ? redactText(responseJson.error_message)
            : null
        result.backendFilenamePresent = typeof responseJson?.file_name === 'string' && responseJson.file_name.length > 0
        result.backendMimeType = normaliseMimeType(responseJson?.mime_type ?? responseJson?.mimedata)
        result.backendSizeBytes = Number.isFinite(responseJson?.file_size_bytes)
            ? responseJson.file_size_bytes
            : null

        const downloadUrl = responseJson?.download_url

        if (typeof downloadUrl !== 'string' || downloadUrl.length === 0) {
            throw new Error(
                result.backendStatus === 'error'
                    ? `Backend resolver returned error ${result.backendErrorCode ?? 'without an error code'}.`
                    : 'Backend resolver did not return a signed download URL.',
            )
        }

        result.signedDownloadUrlPresent = true

        const signedResponse = await fetch(downloadUrl)
        result.signedDownloadStatus = signedResponse.status
        result.signedDownloadOk = signedResponse.ok
        result.signedDownloadContentType = normaliseMimeType(
            signedResponse.headers.get('content-type'),
        )

        if (!signedResponse.ok) {
            throw new Error(`Signed download failed with HTTP ${signedResponse.status}.`)
        }

        const bytes = await signedResponse.arrayBuffer()
        result.signedDownloadSizeBytes = bytes.byteLength
        result.checks.nonZeroBytes = bytes.byteLength > 0

        if (!result.checks.nonZeroBytes) {
            throw new Error('Signed download returned zero bytes.')
        }

        result.signedDownloadSha256 = await sha256(bytes)

        if (INPUT.expectedFilename !== null) {
            result.checks.expectedFilenameMatches = responseJson?.file_name === INPUT.expectedFilename
        }

        if (INPUT.expectedMimeType !== null) {
            const expectedMimeType = normaliseMimeType(INPUT.expectedMimeType)
            result.checks.expectedMimeTypeMatches = [
                result.backendMimeType,
                result.signedDownloadContentType,
            ]
                .filter(Boolean)
                .some(value => value === expectedMimeType)
        }

        if (expectedSizeBytes !== null) {
            result.checks.expectedSizeMatches = result.signedDownloadSizeBytes === expectedSizeBytes
                && (result.backendSizeBytes === null || result.backendSizeBytes === expectedSizeBytes)
        }

        if (INPUT.expectedSha256 !== null) {
            result.checks.expectedSha256Matches
                = result.signedDownloadSha256 === String(INPUT.expectedSha256).trim().toLowerCase()
        }

        result.retrievalSucceeded = result.routeOk
            && result.backendStatus === 'success'
            && result.signedDownloadUrlPresent
            && result.signedDownloadOk
            && result.checks.nonZeroBytes

        result.expectedMetadataComplete = INPUT.expectedFilename !== null
            && INPUT.expectedMimeType !== null
            && expectedSizeBytes !== null

        result.expectedAssetMetadataMatched = result.expectedMetadataComplete
            && result.checks.expectedFilenameMatches === true
            && result.checks.expectedMimeTypeMatches === true
            && result.checks.expectedSizeMatches === true

        const identityProofPassed = result.checks.expectedSha256Matches === true
            || result.expectedAssetMetadataMatched

        result.acceptanceGatePassed = result.retrievalSucceeded
            && identityProofPassed
            && allProvidedChecksPass(result.checks)

        if (result.acceptanceGatePassed && result.checks.expectedSha256Matches === true) {
            result.evidenceLevel = 'expected_asset_hash_matched'
        }
        else if (result.acceptanceGatePassed) {
            result.evidenceLevel = 'expected_asset_metadata_matched'
        }
        else if (result.retrievalSucceeded) {
            result.evidenceLevel = 'bytes_recovered_identity_unproven'
        }
    }
    catch (error) {
        result.error = error instanceof Error
            ? { name: error.name, message: redactText(error.message) }
            : { message: redactText(String(error)) }
    }

    console.log(JSON.stringify(result, null, 2))
})()
