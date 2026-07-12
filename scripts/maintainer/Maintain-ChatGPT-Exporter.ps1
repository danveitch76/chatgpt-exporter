#requires -Version 7.0
<#
.SYNOPSIS
Maintains danveitch76/chatgpt-exporter as a governed downstream fork.

.DESCRIPTION
This tool inspects upstream divergence, classifies upstream commits, detects
equivalent commits already carried by the fork, optionally applies selected
commits, validates the repository, rebuilds the userscript, commits changes,
pushes a branch and opens a pull request.

It is designed for repeated use. The default mode is analysis only.

.EXAMPLES
# Analyse divergence only
.\Maintain-ChatGPT-Exporter.ps1

# Interactively select upstream commits, validate, push and open a pull request
.\Maintain-ChatGPT-Exporter.ps1 -Apply -Interactive -Push -CreatePullRequest

# Apply all recommended functional commits without prompting
.\Maintain-ChatGPT-Exporter.ps1 -Apply -ApplyRecommended -Push -CreatePullRequest

# Use an existing clone
.\Maintain-ChatGPT-Exporter.ps1 -RepoPath C:\GitHub\chatgpt-exporter -Apply -Interactive
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$RepoPath = (Join-Path $PWD 'chatgpt-exporter'),
    [string]$ForkUrl = 'https://github.com/danveitch76/chatgpt-exporter.git',
    [string]$UpstreamUrl = 'https://github.com/pionxzh/chatgpt-exporter.git',
    [string]$BaseBranch = 'master',
    [string]$BranchPrefix = 'maintenance/upstream-sync',
    [switch]$Apply,
    [switch]$Interactive,
    [switch]$ApplyRecommended,
    [switch]$Push,
    [switch]$CreatePullRequest,
    [switch]$AutoFixLint,
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$SkipLint
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Step {
    param([Parameter(Mandatory)][string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [Parameter(ValueFromRemainingArguments)][string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw ("Command failed with exit code {0}: {1} {2}" -f
            $LASTEXITCODE,
            $FilePath,
            ($Arguments -join ' '))
    }
}

function Assert-Command {
    param([Parameter(Mandatory)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Get-GitLines {
    param([Parameter(ValueFromRemainingArguments)][string[]]$Arguments)

    $output = @(& git @Arguments)
    if ($LASTEXITCODE -ne 0) {
        throw "Git command failed: git $($Arguments -join ' ')"
    }
    return $output
}

function Get-CommitCategory {
    param(
        [Parameter(Mandatory)][string]$Subject,
        [Parameter(Mandatory)][string[]]$Files
    )

    if ($Subject -match '^(fix|feat)(\(.+\))?:') {
        return 'functional'
    }

    if ($Subject -match '^(docs|chore\(docs\)):' -or
        ($Files.Count -gt 0 -and ($Files | Where-Object { $_ -notmatch '^(README|docs/|.*\.md$)' }).Count -eq 0)) {
        return 'documentation'
    }

    if ($Subject -match '^(test|chore\(test\)):' -or
        ($Files | Where-Object { $_ -match '(^|/)(test|tests|fixtures)/|\.test\.|\.spec\.' }).Count -gt 0) {
        return 'test'
    }

    if ($Subject -match '^(build|ci|chore\(ci\)):' -or
        ($Files | Where-Object { $_ -match '^\.github/workflows/|package(-lock)?\.json$|pnpm-lock\.yaml$' }).Count -gt 0) {
        return 'build'
    }

    if ($Subject -match '^(chore: release|release:)') {
        return 'release'
    }

    return 'other'
}

function Get-Recommendation {
    param(
        [Parameter(Mandatory)][string]$Category,
        [Parameter(Mandatory)][bool]$EquivalentPresent
    )

    if ($EquivalentPresent) {
        return 'skip-equivalent'
    }

    switch ($Category) {
        'functional' { return 'apply' }
        'test' { return 'review' }
        'build' { return 'review' }
        'documentation' { return 'optional' }
        'release' { return 'skip-release' }
        default { return 'review' }
    }
}

function Test-EquivalentCommitPresent {
    param(
        [Parameter(Mandatory)][string]$Subject,
        [Parameter(Mandatory)][string]$Reference
    )

    $subjects = @(Get-GitLines log $Reference --format=%s)
    return $subjects -contains $Subject
}

function Get-UpstreamCommitInventory {
    param(
        [Parameter(Mandatory)][string]$BaseRef,
        [Parameter(Mandatory)][string]$UpstreamRef
    )

    $rows = @()
    $commits = @(Get-GitLines log --reverse --format=%H $BaseRef..$UpstreamRef)

    foreach ($sha in $commits) {
        $subject = (Get-GitLines show -s --format=%s $sha | Select-Object -First 1)
        $author = (Get-GitLines show -s --format='%an <%ae>' $sha | Select-Object -First 1)
        $date = (Get-GitLines show -s --format=%cI $sha | Select-Object -First 1)
        $files = @(Get-GitLines diff-tree --no-commit-id --name-only -r $sha)
        $category = Get-CommitCategory -Subject $subject -Files $files
        $equivalent = Test-EquivalentCommitPresent -Subject $subject -Reference $BaseRef
        $recommendation = Get-Recommendation -Category $category -EquivalentPresent $equivalent

        $rows += [pscustomobject]@{
            Sha = $sha
            ShortSha = $sha.Substring(0, 7)
            Subject = $subject
            Author = $author
            Date = $date
            Category = $category
            EquivalentPresent = $equivalent
            Recommendation = $recommendation
            Files = $files
        }
    }

    return $rows
}

function Show-CommitInventory {
    param([Parameter(Mandatory)][object[]]$Inventory)

    if ($Inventory.Count -eq 0) {
        Write-Host 'No upstream-only commits were found.' -ForegroundColor Green
        return
    }

    $Inventory |
        Select-Object ShortSha, Category, Recommendation, EquivalentPresent, Subject |
        Format-Table -AutoSize
}

function Write-InventoryReport {
    param(
        [Parameter(Mandatory)][object[]]$Inventory,
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$BaseRef,
        [Parameter(Mandatory)][string]$UpstreamRef
    )

    $lines = @(
        '# ChatGPT Exporter Upstream Assessment'
        ''
        "- Generated: $(Get-Date -Format o)"
        "- Base: `$BaseRef`"
        "- Upstream: `$UpstreamRef`"
        "- Upstream-only commits: $($Inventory.Count)"
        ''
        '| Commit | Category | Recommendation | Equivalent | Subject |'
        '|---|---|---|---:|---|'
    )

    foreach ($row in $Inventory) {
        $safeSubject = $row.Subject.Replace('|', '\|')
        $lines += "| `$($row.ShortSha)` | $($row.Category) | $($row.Recommendation) | $($row.EquivalentPresent) | $safeSubject |"
    }

    $lines += ''
    $lines += '## Detailed file impact'
    $lines += ''

    foreach ($row in $Inventory) {
        $lines += "### `$($row.ShortSha)` $($row.Subject)"
        $lines += ''
        $lines += "- Category: $($row.Category)"
        $lines += "- Recommendation: $($row.Recommendation)"
        $lines += "- Equivalent commit subject already present: $($row.EquivalentPresent)"
        $lines += '- Files:'
        foreach ($file in $row.Files) {
            $lines += "  - `$file`"
        }
        $lines += ''
    }

    Set-Content -LiteralPath $Path -Value ($lines -join "`n") -Encoding utf8
}

function Select-CommitsInteractively {
    param([Parameter(Mandatory)][object[]]$Inventory)

    $selected = @()

    foreach ($row in $Inventory) {
        if ($row.Recommendation -eq 'skip-equivalent' -or
            $row.Recommendation -eq 'skip-release') {
            Write-Host "Skipping $($row.ShortSha): $($row.Subject) [$($row.Recommendation)]"
            continue
        }

        $default = if ($row.Recommendation -eq 'apply') { 'Y' } else { 'N' }
        $answer = Read-Host "Apply $($row.ShortSha) [$($row.Category)] $($row.Subject)? [Y/N, default $default]"
        if ([string]::IsNullOrWhiteSpace($answer)) {
            $answer = $default
        }

        if ($answer -match '^[Yy]') {
            $selected += $row
        }
    }

    return $selected
}

function Resolve-PendingCherryPick {
    $gitDir = (& git rev-parse --git-dir).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not locate the Git metadata directory.'
    }

    $cherryPickHead = Join-Path $gitDir 'CHERRY_PICK_HEAD'
    if (-not (Test-Path -LiteralPath $cherryPickHead)) {
        return
    }

    $conflicts = @(& git diff --name-only --diff-filter=U)
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not inspect pending cherry-pick conflicts.'
    }

    if ($conflicts.Count -gt 0) {
        throw @"
A cherry-pick is currently conflicted.

Resolve the files, then run:
  git add .
  git cherry-pick --continue

Or abandon it:
  git cherry-pick --abort
"@
    }

    $staged = @(& git diff --cached --name-only)
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not inspect the pending cherry-pick index.'
    }

    if ($staged.Count -eq 0) {
        Write-Host 'Pending cherry-pick is empty; skipping it.'
        Invoke-Native git cherry-pick --skip
    }
}

function Apply-UpstreamCommits {
    param([Parameter(Mandatory)][object[]]$Selected)

    foreach ($row in $Selected) {
        if (Test-EquivalentCommitPresent -Subject $row.Subject -Reference 'HEAD') {
            Write-Host "Already represented: $($row.Subject)"
            continue
        }

        Write-Step "Applying $($row.ShortSha): $($row.Subject)"
        & git cherry-pick $row.Sha

        if ($LASTEXITCODE -eq 0) {
            continue
        }

        $conflicts = @(& git diff --name-only --diff-filter=U)
        $staged = @(& git diff --cached --name-only)

        if ($conflicts.Count -eq 0 -and $staged.Count -eq 0) {
            Write-Host 'Cherry-pick is empty; skipping.'
            Invoke-Native git cherry-pick --skip
            continue
        }

        Write-Host 'Conflicted files:' -ForegroundColor Yellow
        $conflicts | ForEach-Object { Write-Host "  $_" }

        throw @"
The cherry-pick stopped with conflicts.

Resolve them, then run:
  git add .
  git cherry-pick --continue

Rerun this tool afterwards; it will resume safely.
"@
    }
}

function Get-PackageVersion {
    param([Parameter(Mandatory)][string]$PackagePath)

    $package = Get-Content -LiteralPath $PackagePath -Raw | ConvertFrom-Json
    return [string]$package.version
}

function Invoke-Validation {
    if (-not $SkipLint) {
        Write-Step 'Running lint'
        & corepack pnpm run lint

        if ($LASTEXITCODE -ne 0 -and $AutoFixLint) {
            Write-Warning 'Lint failed. Running automatic lint repair.'
            Invoke-Native corepack pnpm run lint:fix
            Invoke-Native corepack pnpm run lint
        }
        elseif ($LASTEXITCODE -ne 0) {
            throw 'Lint failed. Rerun with -AutoFixLint to allow automatic formatting repair.'
        }
    }

    if (-not $SkipTests) {
        Write-Step 'Running tests'
        Invoke-Native corepack pnpm run test
    }

    if (-not $SkipBuild) {
        Write-Step 'Building userscript'
        Invoke-Native corepack pnpm run build

        $builtScript = Join-Path $RepoPath 'dist\chatgpt.user.js'
        if (-not (Test-Path -LiteralPath $builtScript)) {
            throw "Build completed but '$builtScript' was not produced."
        }

        $version = Get-PackageVersion -PackagePath (Join-Path $RepoPath 'package.json')
        $content = Get-Content -LiteralPath $builtScript -Raw

        if ($content -notmatch [regex]::Escape("// @version            $version")) {
            throw "Built userscript version does not match package version $version."
        }

        if ($content -notmatch '// @namespace\s+danveitch76') {
            throw 'Built userscript does not retain the danveitch76 namespace.'
        }
    }
}

Assert-Command git
Assert-Command node
Assert-Command corepack
if ($CreatePullRequest) {
    Assert-Command gh
}

Write-Step 'Preparing repository'

if (-not (Test-Path -LiteralPath $RepoPath)) {
    Invoke-Native git clone $ForkUrl $RepoPath
}

$RepoPath = (Resolve-Path -LiteralPath $RepoPath).Path
Set-Location -LiteralPath $RepoPath

if (-not (Test-Path -LiteralPath '.git')) {
    throw "'$RepoPath' is not a Git repository."
}

$dirty = @(& git status --porcelain)
if ($LASTEXITCODE -ne 0) {
    throw 'Could not inspect repository status.'
}
if ($dirty.Count -gt 0) {
    throw "The working tree is not clean.`n$($dirty -join "`n")"
}

Write-Step 'Configuring remotes'

$remotes = @(& git remote)
if ($LASTEXITCODE -ne 0) {
    throw 'Could not inspect Git remotes.'
}

if ($remotes -contains 'upstream') {
    Invoke-Native git remote set-url upstream $UpstreamUrl
}
else {
    Invoke-Native git remote add upstream $UpstreamUrl
}

Invoke-Native git fetch origin --prune
Invoke-Native git fetch upstream --prune

Write-Step 'Updating base branch'

Invoke-Native git checkout $BaseBranch
Invoke-Native git pull --ff-only origin $BaseBranch

$baseRef = $BaseBranch
$upstreamRef = "upstream/$BaseBranch"

Write-Step 'Assessing upstream divergence'

$inventory = @(Get-UpstreamCommitInventory -BaseRef $baseRef -UpstreamRef $upstreamRef)
Show-CommitInventory -Inventory $inventory

$reportPath = Join-Path $RepoPath 'upstream-assessment.md'
Write-InventoryReport `
    -Inventory $inventory `
    -Path $reportPath `
    -BaseRef $baseRef `
    -UpstreamRef $upstreamRef

Write-Host "`nAssessment report: $reportPath"

if (-not $Apply) {
    Write-Host "`nAnalysis complete. No repository changes were applied." -ForegroundColor Green
    exit 0
}

$selected = @()

if ($Interactive) {
    $selected = @(Select-CommitsInteractively -Inventory $inventory)
}
elseif ($ApplyRecommended) {
    $selected = @($inventory | Where-Object { $_.Recommendation -eq 'apply' })
}
else {
    throw 'Apply mode requires either -Interactive or -ApplyRecommended.'
}

if ($selected.Count -eq 0) {
    Write-Host 'No upstream commits were selected.' -ForegroundColor Yellow
}
else {
    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $branch = "$BranchPrefix-$timestamp"

    Write-Step "Creating branch $branch"
    Invoke-Native git checkout -b $branch

    Resolve-PendingCherryPick
    Apply-UpstreamCommits -Selected $selected
}

Write-Step 'Installing dependencies'
Invoke-Native corepack pnpm install --frozen-lockfile

Invoke-Validation

Write-Step 'Preparing commit'

Invoke-Native git add --all
$staged = @(& git diff --cached --name-only)
if ($LASTEXITCODE -ne 0) {
    throw 'Could not inspect staged changes.'
}

$currentBranch = (& git branch --show-current).Trim()

if ($staged.Count -gt 0) {
    $version = Get-PackageVersion -PackagePath (Join-Path $RepoPath 'package.json')
    Invoke-Native git commit -m "chore: maintain downstream fork at $version"
}
else {
    Write-Host 'No repository changes remain to commit.' -ForegroundColor Yellow
}

if ($Push) {
    Write-Step 'Pushing branch'
    Invoke-Native git push -u origin $currentBranch
}

if ($CreatePullRequest) {
    if (-not $Push) {
        throw '-CreatePullRequest requires -Push.'
    }

    $existing = @(
        & gh pr list `
            --repo danveitch76/chatgpt-exporter `
            --head $currentBranch `
            --base $BaseBranch `
            --state open `
            --json url `
            --jq '.[0].url'
    )

    if ($LASTEXITCODE -ne 0) {
        throw 'Could not inspect existing pull requests.'
    }

    $existingUrl = ($existing | Out-String).Trim()
    if ($existingUrl) {
        Write-Host "Pull request already exists: $existingUrl"
    }
    else {
        $appliedSummary = if ($selected.Count -gt 0) {
            ($selected | ForEach-Object { "- `$($_.ShortSha)` $($_.Subject)" }) -join "`n"
        }
        else {
            '- No upstream commits were required.'
        }

        $body = @"
## Summary

Maintains the downstream fork against the current upstream state.

## Applied upstream commits

$appliedSummary

## Validation

- dependency installation passed
- lint passed or was explicitly skipped
- tests passed or were explicitly skipped
- production build passed or was explicitly skipped

## Evidence

See `upstream-assessment.md` for classification and equivalence analysis.
"@

        Invoke-Native gh pr create `
            --repo danveitch76/chatgpt-exporter `
            --base $BaseBranch `
            --head $currentBranch `
            --title 'chore: maintain downstream fork against upstream' `
            --body $body
    }
}

Write-Host "`nCompleted successfully." -ForegroundColor Green
Write-Host "Repository: $RepoPath"
Write-Host "Branch:     $currentBranch"
Write-Host "Report:     $reportPath"
