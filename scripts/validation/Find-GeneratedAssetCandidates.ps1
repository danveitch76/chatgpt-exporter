param(
    [Parameter(Mandatory = $true)]
    [string]$DiscoveryJsonPath,

    [string]$OutputPath = ".\docs\validation\phase-1-5\asset-recovery\generated-assets-summary.json"
)

$json = Get-Content $DiscoveryJsonPath -Raw | ConvertFrom-Json

$generated = @(
    $json.inventory |
    Where-Object { $_.sourceType -eq "generated" }
)

$classSummary = $generated |
    Group-Object sourceField |
    Sort-Object Count -Descending |
    Select-Object Count,Name

$statusSummary = $generated |
    Group-Object downloadStatus |
    Sort-Object Count -Descending |
    Select-Object Count,Name

$result = [ordered]@{
    generatedAt = (Get-Date).ToString("s")
    totalGeneratedRows = $generated.Count
    sourceFieldSummary = $classSummary
    downloadStatusSummary = $statusSummary
    sampleRows = @(
        $generated |
        Select-Object -First 50 `
            conversationTitle,
            sourceField,
            downloadStatus,
            zipPath
    )
}

$result |
    ConvertTo-Json -Depth 10 |
    Set-Content -Encoding UTF8 $OutputPath

Write-Host ""
Write-Host "Created: $OutputPath" -ForegroundColor Green
Write-Host ""

$classSummary | Format-Table -AutoSize
