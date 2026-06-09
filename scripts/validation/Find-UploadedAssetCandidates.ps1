param(
    [Parameter(Mandatory = $true)]
    [string]$DiscoveryJsonPath,

    [string]$OutputPath = ".\docs\validation\phase-1-5\asset-recovery\uploaded-asset-candidates.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $DiscoveryJsonPath)) {
    throw "Discovery JSON not found: $DiscoveryJsonPath"
}

$json = Get-Content $DiscoveryJsonPath -Raw | ConvertFrom-Json

if (-not $json.inventory) {
    throw "Discovery JSON does not contain an inventory property."
}

$candidates = @(
    $json.inventory | Where-Object {
        ($_.sourceType -match "upload|image|file") -or
        ($_.assetPointer -match "sediment://") -or
        ($_.rawPath -match "file-|sandbox:|/mnt/data|download") -or
        ($_.filename)
    } | Select-Object `
        conversationId,
        conversationTitle,
        messageId,
        sourceType,
        sourceField,
        filename,
        assetPointer,
        rawPath,
        downloadStatus,
        sizeBytes,
        mimeType
)

$summary = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    sourceFile = $DiscoveryJsonPath
    totalInventoryRows = @($json.inventory).Count
    candidateRows = @($candidates).Count
    candidates = $candidates
}

$summary | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $OutputPath

Write-Host "Uploaded asset candidate report created: $OutputPath"
Write-Host "Total inventory rows: $(@($json.inventory).Count)"
Write-Host "Candidate rows: $(@($candidates).Count)"
