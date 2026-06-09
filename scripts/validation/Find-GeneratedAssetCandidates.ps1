param(
    [Parameter(Mandatory = $true)]
    [string]$DiscoveryJsonPath,

    [int]$Limit = 50
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-PropertyValue {
    param(
        [Parameter(Mandatory = $true)]
        [object]$Object,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function Get-CandidateType {
    param([object]$Row)

    $assetPointer = Get-PropertyValue $Row "assetPointer"
    $rawPath = Get-PropertyValue $Row "rawPath"
    $rawUrl = Get-PropertyValue $Row "rawUrl"
    $fileId = Get-PropertyValue $Row "fileId"
    $filename = Get-PropertyValue $Row "filename"
    $sourceField = Get-PropertyValue $Row "sourceField"
    $rawValue = Get-PropertyValue $Row "rawValue"

    $text = @(
        $assetPointer
        $rawPath
        $rawUrl
        $fileId
        $filename
        $sourceField
        $rawValue
    ) -join " "

    if ($assetPointer -is [string] -and $assetPointer.StartsWith("data:image/")) {
        return "embedded-data-image"
    }

    if ($assetPointer -is [string] -and $assetPointer.StartsWith("sediment://")) {
        return "sediment-pointer"
    }

    if ($fileId -is [string] -and $fileId.StartsWith("file-")) {
        return "file-id"
    }

    if ($rawPath -is [string] -and ($rawPath.StartsWith("sandbox:/mnt/data/") -or $rawPath.StartsWith("/mnt/data/"))) {
        return "sandbox-path"
    }

    if ($rawUrl -is [string] -and $rawUrl.StartsWith("http")) {
        return "url"
    }

    if ($text -match "sandbox:/mnt/data/|/mnt/data/") {
        return "sandbox-path-mention"
    }

    if ($text -match "https?://") {
        return "url-mention"
    }

    if ($text -match "```|PowerShell|Traceback|Exception|askmr@DESKTOP") {
        return "execution-or-terminal-text"
    }

    return "unknown-or-conversation-content"
}

Write-Host "==> Loading discovery JSON" -ForegroundColor Cyan

if (-not (Test-Path $DiscoveryJsonPath)) {
    throw "Discovery JSON not found: $DiscoveryJsonPath"
}

$json = Get-Content -Raw -Path $DiscoveryJsonPath | ConvertFrom-Json

if ($null -eq $json.inventory) {
    throw "Discovery JSON does not contain an inventory property."
}

$generated = @(
    $json.inventory | Where-Object {
        (Get-PropertyValue $_ "sourceType") -eq "generated"
    }
)

Write-Host "==> Generated rows: $($generated.Count)" -ForegroundColor Cyan

$summary = $generated |
    ForEach-Object {
        [pscustomobject]@{
            CandidateType = Get-CandidateType $_
            SourceType = Get-PropertyValue $_ "sourceType"
            ConversationTitle = Get-PropertyValue $_ "conversationTitle"
            FileName = Get-PropertyValue $_ "filename"
            FileId = Get-PropertyValue $_ "fileId"
            AssetPointer = Get-PropertyValue $_ "assetPointer"
            RawPath = Get-PropertyValue $_ "rawPath"
            RawUrl = Get-PropertyValue $_ "rawUrl"
            DownloadStatus = Get-PropertyValue $_ "downloadStatus"
            ZipPath = Get-PropertyValue $_ "zipPath"
            SourceField = Get-PropertyValue $_ "sourceField"
        }
    }

Write-Host "`n==> Candidate type counts" -ForegroundColor Cyan

$summary |
    Group-Object CandidateType |
    Sort-Object Count -Descending |
    Select-Object Name, Count |
    Format-Table -AutoSize

Write-Host "`n==> Candidate sample" -ForegroundColor Cyan

$summary |
    Select-Object -First $Limit |
    Format-Table CandidateType, ConversationTitle, FileName, FileId, DownloadStatus, ZipPath -AutoSize

$outDir = ".\docs\validation\phase-1\file-resolver"
New-Item -ItemType Directory -Force $outDir | Out-Null

$summary |
    ConvertTo-Json -Depth 20 |
    Set-Content -Encoding UTF8 "$outDir\generated-asset-candidates-safe-summary.json"

$summary |
    Group-Object CandidateType |
    Sort-Object Count -Descending |
    Select-Object Name, Count |
    ConvertTo-Json -Depth 5 |
    Set-Content -Encoding UTF8 "$outDir\generated-asset-candidate-type-counts.json"

Write-Host "`n==> Wrote:" -ForegroundColor Green
Write-Host "$outDir\generated-asset-candidates-safe-summary.json"
Write-Host "$outDir\generated-asset-candidate-type-counts.json"
