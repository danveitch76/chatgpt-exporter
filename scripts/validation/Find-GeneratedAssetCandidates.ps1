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

function Get-CandidateClass {
    param([object]$Row)

    $sourceField = [string]$Row.sourceField
    $rawValue = [string]$Row.rawValue
    $assetPointer = [string]$Row.assetPointer
    $filename = [string]$Row.filename

    if ($assetPointer -match "^data:image/[^;]+;base64,") { return "generated-image" }
    if ($assetPointer -like "sediment://*") { return "generated-image" }
    if ($filename -match "\.(zip|pdf|docx|xlsx|csv|json|md|html|png|jpg|jpeg|webp)(\s|$)") { return "generated-file" }
    if ($rawValue -match "/mnt/data/[^\s'`"]+") { return "sandbox-path-mention" }
    if ($rawValue -match "\.(zip|pdf|docx|xlsx|csv|json|md|html|png|jpg|jpeg|webp)(\s|$)") { return "file-like-text-reference" }
    if ($sourceField -match "citation_metadata|conversation_context_citation_metadata") { return "citation-url" }
    if ($sourceField -match "search_result_groups") { return "search-result-url" }
    if ($sourceField -match "content_references") { return "content-reference-url" }
    if ($sourceField -match "aggregate_result\.code") { return "execution-code" }
    if ($sourceField -match "jupyter_messages|aggregate_result\.messages|final_expression_output|in_kernel_exception") { return "execution-output-text" }
    if ($sourceField -match "message\.content\.text|message\.content\.parts|message\.content\.result|message\.content\.thoughts") { return "conversation-content" }

    return "unknown-generated-reference"
}

$classified = @(
    $generated | ForEach-Object {
        [pscustomobject]@{
            conversationTitle = $_.conversationTitle
            sourceField = $_.sourceField
            downloadStatus = $_.downloadStatus
            candidateClass = Get-CandidateClass -Row $_
            zipPath = $_.zipPath
        }
    }
)

$result = [ordered]@{
    generatedAt = (Get-Date).ToString("s")
    totalGeneratedRows = $generated.Count
    classSummary = @(
        $classified |
        Group-Object candidateClass |
        Sort-Object Count -Descending |
        Select-Object Count,Name
    )
    downloadStatusSummary = @(
        $generated |
        Group-Object downloadStatus |
        Sort-Object Count -Descending |
        Select-Object Count,Name
    )
    samples = @(
        $classified |
        Select-Object -First 50
    )
}

$result |
    ConvertTo-Json -Depth 10 |
    Set-Content -Encoding UTF8 $OutputPath

Write-Host "Created: $OutputPath" -ForegroundColor Green
$result.classSummary | Format-Table -AutoSize
