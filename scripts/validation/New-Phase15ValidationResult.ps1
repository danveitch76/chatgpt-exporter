param(
    [Parameter(Mandatory = $true)]
    [ValidateSet(100, 500, 1000)]
    [int]$TargetConversationCount,

    [Parameter(Mandatory = $true)]
    [string]$DiscoveryJsonPath,

    [string]$OutputDirectory = ".\docs\validation\phase-1-5\results"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path $DiscoveryJsonPath)) {
    throw "Discovery JSON not found: $DiscoveryJsonPath"
}

New-Item -ItemType Directory -Force $OutputDirectory | Out-Null

$json = Get-Content $DiscoveryJsonPath -Raw | ConvertFrom-Json
$stats = $json.stats

$date = Get-Date -Format "yyyy-MM-dd"
$outFile = Join-Path $OutputDirectory "$date-real-account-validation-$TargetConversationCount.md"

$content = @"
# Phase 1.5 Real Account Validation Result

## Run Metadata

| Field | Value |
|---|---|
| Date | $date |
| Tester | Dan |
| Issue | #42 |
| Target conversation count | $TargetConversationCount |
| Actual conversations scanned | $($stats.conversationsScanned) |
| Browser | TODO |
| Browser version | TODO |
| Operating system | Windows 11 |
| Machine notes | TODO |

## Result Summary

| Metric | Value |
|---|---:|
| Runtime seconds | TODO |
| Messages scanned | $($stats.messagesScanned) |
| References found | $($stats.referencesFound) |
| Downloaded | $($stats.downloaded) |
| Metadata only | $($stats.metadataOnly) |
| Failed | $($stats.failed) |
| Skipped duplicates | $($stats.skippedDuplicates) |
| Inventory file generated | Yes |
| Browser crash | TODO |
| Browser instability | TODO |

## Observations

- TODO

## Failure Modes

| Failure | Impact | Follow-up Issue |
|---|---|---|
| TODO | TODO | TODO |

## Decision

| Question | Answer |
|---|---|
| Did this scale target pass? | TODO |
| Can validation proceed to next scale target? | TODO |
| Is product code change required before proceeding? | TODO |

## Notes

- Generated from discovery JSON: $DiscoveryJsonPath
"@

Set-Content -Encoding UTF8 -Path $outFile -Value $content

Write-Host "Validation result created: $outFile"
