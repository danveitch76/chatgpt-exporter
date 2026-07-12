# Maintain ChatGPT Exporter

`Maintain-ChatGPT-Exporter.ps1` is a PowerShell 7 maintenance tool for operating [`danveitch76/chatgpt-exporter`](https://github.com/danveitch76/chatgpt-exporter) as a governed downstream fork of [`pionxzh/chatgpt-exporter`](https://github.com/pionxzh/chatgpt-exporter).

It analyses upstream divergence, classifies upstream-only commits, detects changes that are already represented in the downstream history, optionally applies selected commits, validates the repository, rebuilds the userscript, commits the result, pushes a maintenance branch and opens a pull request.

The default operating mode is assessment only. No upstream commits are applied unless `-Apply` is supplied.

---

## Purpose

The downstream repository has materially diverged from upstream. It contains Dan-specific functionality, including File Discovery, asset classification, validation evidence and file-resolution work. A blind fork synchronisation or full upstream merge would therefore be unsafe.

This tool provides a controlled workflow:

1. inspect upstream-only commits;
2. classify each commit;
3. detect equivalent downstream commits;
4. recommend an action;
5. allow explicit selection;
6. apply selected commits;
7. run repository quality gates;
8. rebuild and verify the userscript;
9. commit and optionally create a pull request.

The tool treats upstream as a source of candidate changes, not as an authority that must automatically overwrite the downstream product.

---

## Scope

The script currently supports:

- cloning the downstream repository when no local clone exists;
- configuring or correcting the `upstream` Git remote;
- fetching downstream and upstream branches;
- updating the downstream base branch using a fast-forward-only pull;
- identifying commits present in upstream but absent from the downstream base branch;
- classifying upstream commits by subject and changed files;
- identifying equivalent downstream commits by exact commit subject;
- generating a Markdown assessment report;
- interactive or recommendation-based commit selection;
- timestamped maintenance branch creation;
- cherry-picking selected commits;
- handling empty cherry-picks;
- stopping safely on merge conflicts;
- installing dependencies through Corepack and pnpm;
- linting, testing and building;
- optional automatic lint repair;
- verifying userscript version and namespace metadata;
- committing all staged changes;
- pushing the branch;
- opening or reusing a GitHub pull request.

It does not automatically resolve semantic conflicts or decide whether an upstream architectural change is appropriate for the downstream product.

---

## Requirements

### Required

| Dependency | Minimum expectation | Check |
|---|---:|---|
| PowerShell | 7.0 or later | `$PSVersionTable.PSVersion` |
| Git | Current supported release | `git --version` |
| Node.js | Compatible with the repository | `node --version` |
| Corepack | Available with Node.js | `corepack --version` |
| pnpm | Supplied through Corepack | `corepack pnpm --version` |

### Required only for pull-request creation

| Dependency | Purpose | Check |
|---|---|---|
| GitHub command-line tooling | Creates and queries pull requests | `gh --version` |
| Authenticated GitHub session | Push and pull-request access | `gh auth status` |

Example prerequisite check:

```powershell
$PSVersionTable.PSVersion
git --version
node --version
corepack --version
corepack pnpm --version
gh --version
gh auth status
```

The script does not run `corepack enable`; this avoids requiring administrator rights to write shims under `C:\Program Files\nodejs`.

---

## Installation

Place the script somewhere outside the repository, for example:

```text
C:\Scripts\Maintain-ChatGPT-Exporter.ps1
```

Temporary execution-policy bypass:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

The script can then be invoked directly:

```powershell
C:\Scripts\Maintain-ChatGPT-Exporter.ps1
```

---

## Default repositories and branches

| Setting | Default |
|---|---|
| Downstream repository | `https://github.com/danveitch76/chatgpt-exporter.git` |
| Upstream repository | `https://github.com/pionxzh/chatgpt-exporter.git` |
| Base branch | `master` |
| Maintenance branch prefix | `maintenance/upstream-sync` |
| Default local path | `.\chatgpt-exporter` beneath the current directory |

These values can be overridden through parameters.

---

## Operating modes

### Assessment-only mode

Assessment-only mode is the default.

```powershell
.\Maintain-ChatGPT-Exporter.ps1 `
    -RepoPath C:\GitHub\chatgpt-exporter
```

The script:

1. checks prerequisites;
2. verifies that the working tree is clean;
3. configures remotes;
4. fetches both repositories;
5. updates the downstream base branch;
6. analyses upstream-only commits;
7. displays the classification table;
8. writes `upstream-assessment.md`;
9. exits without applying commits.

No maintenance branch is created in this mode.

> **Important:** `upstream-assessment.md` is written into the repository root. It will leave the working tree unclean unless the file is removed, committed or excluded. Remove it before the next run when it is intended only as temporary evidence:
>
> ```powershell
> Remove-Item C:\GitHub\chatgpt-exporter\upstream-assessment.md
> ```

---

### Interactive apply mode

Interactive mode asks whether each eligible upstream commit should be applied.

```powershell
.\Maintain-ChatGPT-Exporter.ps1 `
    -RepoPath C:\GitHub\chatgpt-exporter `
    -Apply `
    -Interactive `
    -AutoFixLint `
    -Push `
    -CreatePullRequest
```

Default answers are:

- `Y` for commits recommended as `apply`;
- `N` for commits recommended as `review` or `optional`;
- no prompt for `skip-equivalent` or `skip-release`.

---

### Apply recommended commits

This mode applies all commits classified as functional and recommended as `apply`.

```powershell
.\Maintain-ChatGPT-Exporter.ps1 `
    -RepoPath C:\GitHub\chatgpt-exporter `
    -Apply `
    -ApplyRecommended `
    -AutoFixLint `
    -Push `
    -CreatePullRequest
```

This is non-interactive, but it is not a full upstream merge. Build, test, documentation and release commits are not automatically selected unless their classification changes to `functional`.

---

## Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `-RepoPath` | String | `.\chatgpt-exporter` | Existing clone or destination for a new clone. |
| `-ForkUrl` | String | Dan's repository | Downstream repository clone URL. |
| `-UpstreamUrl` | String | Pionxzh repository | Upstream repository clone URL. |
| `-BaseBranch` | String | `master` | Downstream and upstream branch used for comparison. |
| `-BranchPrefix` | String | `maintenance/upstream-sync` | Prefix for timestamped maintenance branches. |
| `-Apply` | Switch | Off | Enables commit application and validation workflow. |
| `-Interactive` | Switch | Off | Prompts for each eligible upstream commit. Requires `-Apply`. |
| `-ApplyRecommended` | Switch | Off | Automatically applies commits recommended as `apply`. Requires `-Apply`. |
| `-Push` | Switch | Off | Pushes the current maintenance branch to `origin`. |
| `-CreatePullRequest` | Switch | Off | Creates or identifies a pull request. Requires `-Push` and GitHub command-line tooling. |
| `-AutoFixLint` | Switch | Off | Runs `pnpm run lint:fix` if the initial lint run fails. |
| `-SkipBuild` | Switch | Off | Skips the production build and userscript verification. |
| `-SkipTests` | Switch | Off | Skips repository tests. |
| `-SkipLint` | Switch | Off | Skips lint validation. |

### Parameter rules

- `-Apply` requires either `-Interactive` or `-ApplyRecommended`.
- `-CreatePullRequest` requires `-Push`.
- The working tree must be clean when the script starts.
- `-SkipLint`, `-SkipTests` and `-SkipBuild` weaken the validation gate and should be used only for diagnostic runs.

---

## Commit classification

Each upstream-only commit is assigned a category using its subject and changed files.

### Functional

Matched by subjects beginning with:

```text
fix:
fix(scope):
feat:
feat(scope):
```

Recommendation: `apply`, unless an equivalent downstream commit subject already exists.

### Documentation

Matched by:

```text
docs:
chore(docs):
```

or when all changed files appear to be Markdown, README or documentation content.

Recommendation: `optional`.

### Test

Matched by:

```text
test:
chore(test):
```

or when changed paths indicate tests, fixtures, specifications or test files.

Recommendation: `review`.

### Build

Matched by:

```text
build:
ci:
chore(ci):
```

or when the commit changes workflows, package manifests or lockfiles.

Recommendation: `review`.

### Release

Matched by:

```text
chore: release
release:
```

Recommendation: `skip-release`.

Release commits from upstream generally contain upstream versioning, release notes or generated output that should not overwrite the downstream release identity.

### Other

Anything that does not match the rules above.

Recommendation: `review`.

---

## Recommendation values

| Recommendation | Meaning |
|---|---|
| `apply` | Functional upstream change not detected downstream. |
| `review` | Potentially useful, but requires human judgement. |
| `optional` | Documentation-only change; normally not required. |
| `skip-equivalent` | An exact matching commit subject already exists downstream. |
| `skip-release` | Upstream release commit should not normally be imported. |

---

## Equivalent-commit detection

The script checks whether the exact upstream commit subject already appears in the downstream branch history.

Example:

```text
fix: export answer source lists
```

If the downstream fork has the same subject under a different commit identifier, the script marks the upstream commit as:

```text
skip-equivalent
```

This solves the common case where a change was cherry-picked earlier and therefore has a different commit identifier.

### Limitation

Subject matching is useful but not definitive.

It can produce:

- a false positive when two different changes use the same subject;
- a false negative when equivalent code was committed under a different subject;
- no evidence that the downstream implementation is semantically identical.

For important changes, review the source diff before accepting the recommendation.

---

## Assessment report

The tool writes:

```text
upstream-assessment.md
```

The report contains:

- generation timestamp;
- downstream base reference;
- upstream reference;
- total upstream-only commits;
- commit identifier;
- category;
- recommendation;
- equivalent-subject result;
- commit subject;
- changed-file list for every upstream-only commit.

Example table:

```markdown
| Commit | Category | Recommendation | Equivalent | Subject |
|---|---|---|---:|---|
| `f5ef7fe` | functional | skip-equivalent | True | fix: retire access to __NEXT_DATA__ and __remixContext |
| `6b68edb` | build | review | False | chore: ci build |
```

The report is also included in the eventual commit because the script stages all repository changes.

---

## Branch strategy

When one or more commits are selected, the script creates a branch using:

```text
<BranchPrefix>-<yyyyMMdd-HHmmss>
```

Example:

```text
maintenance/upstream-sync-20260712-183000
```

The timestamp prevents collisions between maintenance runs and preserves an auditable history.

If no commits are selected, no new maintenance branch is created. The script remains on the base branch and still proceeds through dependency installation, validation and staging.

> **Risk:** Because the assessment report is generated before selection, a run with `-Apply` but no selected commits can stage and commit `upstream-assessment.md` on the base branch. Do not use apply mode when no changes are intended. Review the current branch before allowing the commit step:
>
> ```powershell
> git branch --show-current
> git status
> ```

---

## Upstream commit application

Selected commits are applied with:

```powershell
git cherry-pick <commit>
```

Before applying a selected commit, the tool rechecks whether the commit subject already exists in `HEAD`.

### Empty cherry-pick

When a cherry-pick produces no conflicts and no staged changes, the tool treats it as an equivalent or already-applied patch and runs:

```powershell
git cherry-pick --skip
```

### Conflict

When files conflict, the tool:

1. leaves the cherry-pick in progress;
2. lists conflicted paths;
3. stops immediately;
4. does not guess the resolution.

Resolve manually:

```powershell
git status
# Edit conflicted files.
git add .
git cherry-pick --continue
```

Then rerun the maintainer. Already represented commit subjects will be skipped.

Abandon the operation:

```powershell
git cherry-pick --abort
```

---

## Dependency installation

The script runs:

```powershell
corepack pnpm install --frozen-lockfile
```

`--frozen-lockfile` means the installation fails if `package.json` and `pnpm-lock.yaml` are inconsistent. This prevents an unreviewed dependency-resolution change from being introduced during an upstream maintenance run.

The repository's own `prepare` lifecycle script may also run, including Husky configuration.

---

## Validation pipeline

Unless explicitly skipped, the tool runs the following sequence.

### Lint

```powershell
corepack pnpm run lint
```

With `-AutoFixLint`, a failed lint run triggers:

```powershell
corepack pnpm run lint:fix
corepack pnpm run lint
```

Automatic lint repair can modify files unrelated to the selected upstream commit. Review the resulting diff before merging.

### Tests

```powershell
corepack pnpm run test
```

The exact tests are controlled by the downstream `package.json`.

### Build

```powershell
corepack pnpm run build
```

The build must produce:

```text
dist/chatgpt.user.js
```

### Built userscript verification

The script validates that:

- the userscript version matches `package.json`;
- the namespace remains `danveitch76`.

The expected metadata is equivalent to:

```javascript
// @namespace          danveitch76
// @version            <package.json version>
```

This protects the downstream identity and detects stale generated output.

---

## Commit behaviour

After successful validation, the tool stages everything:

```powershell
git add --all
```

If changes exist, it commits with:

```text
chore: maintain downstream fork at <version>
```

This includes:

- selected upstream changes;
- generated assessment report;
- automatic lint repairs;
- rebuilt distribution output;
- any other tracked or untracked changes produced during the run.

Review the staged set before using the tool in an unattended environment.

---

## Push and pull request

With `-Push`:

```powershell
git push -u origin <current-branch>
```

With `-CreatePullRequest`, the tool first searches for an existing open pull request from the current branch to the base branch.

When none exists, it creates one with:

```text
Title: chore: maintain downstream fork against upstream
```

The body includes:

- selected upstream commits;
- validation summary;
- reference to `upstream-assessment.md`.

---

## Recommended routine

### 1. Analyse first

```powershell
cd C:\Scripts

.\Maintain-ChatGPT-Exporter.ps1 `
    -RepoPath C:\GitHub\chatgpt-exporter
```

Review:

```text
C:\GitHub\chatgpt-exporter\upstream-assessment.md
```

Then remove the temporary report before the apply run:

```powershell
Remove-Item C:\GitHub\chatgpt-exporter\upstream-assessment.md
```

### 2. Apply interactively

```powershell
.\Maintain-ChatGPT-Exporter.ps1 `
    -RepoPath C:\GitHub\chatgpt-exporter `
    -Apply `
    -Interactive `
    -AutoFixLint `
    -Push `
    -CreatePullRequest
```

### 3. Review the pull request

Check:

- selected upstream commits;
- source changes;
- downstream-specific functionality;
- generated userscript;
- workflow checks;
- version metadata;
- assessment report.

### 4. Merge

Merge only after all checks pass and any conflict resolution is validated.

### 5. Refresh the local base branch

```powershell
cd C:\GitHub\chatgpt-exporter
git checkout master
git pull --ff-only origin master
git fetch upstream --prune
```

---

## Common commands

### Analyse using defaults

```powershell
.\Maintain-ChatGPT-Exporter.ps1
```

### Analyse an existing clone

```powershell
.\Maintain-ChatGPT-Exporter.ps1 `
    -RepoPath C:\temp\chatgpt-exporter
```

### Interactive full workflow

```powershell
.\Maintain-ChatGPT-Exporter.ps1 `
    -RepoPath C:\temp\chatgpt-exporter `
    -Apply `
    -Interactive `
    -AutoFixLint `
    -Push `
    -CreatePullRequest
```

### Apply recommended functional changes

```powershell
.\Maintain-ChatGPT-Exporter.ps1 `
    -RepoPath C:\temp\chatgpt-exporter `
    -Apply `
    -ApplyRecommended `
    -AutoFixLint `
    -Push `
    -CreatePullRequest
```

### Diagnostic run without build

```powershell
.\Maintain-ChatGPT-Exporter.ps1 `
    -RepoPath C:\temp\chatgpt-exporter `
    -Apply `
    -Interactive `
    -SkipBuild
```

### Use alternative branches

```powershell
.\Maintain-ChatGPT-Exporter.ps1 `
    -RepoPath C:\temp\chatgpt-exporter `
    -BaseBranch main `
    -BranchPrefix maintenance/vendor-sync `
    -Apply `
    -Interactive
```

---

## Troubleshooting

### Working tree is not clean

Error:

```text
The working tree is not clean.
```

Inspect:

```powershell
git -C C:\GitHub\chatgpt-exporter status
```

Then commit, stash or discard the changes.

Temporary assessment report only:

```powershell
Remove-Item C:\GitHub\chatgpt-exporter\upstream-assessment.md
```

Stash:

```powershell
git -C C:\GitHub\chatgpt-exporter stash push --include-untracked
```

---

### Corepack or pnpm is unavailable

Check:

```powershell
corepack --version
corepack pnpm --version
```

Do not assume `corepack enable` is required. On Windows, enabling global shims can require administrator rights.

---

### Frozen lockfile failure

Error from:

```text
pnpm install --frozen-lockfile
```

This means the dependency manifest and lockfile disagree.

Do not bypass it during upstream maintenance without understanding why. Resolve the dependency change separately and commit the corrected lockfile through a dedicated change.

---

### Lint failure

Run:

```powershell
corepack pnpm run lint
```

Automatic repair:

```powershell
corepack pnpm run lint:fix
corepack pnpm run lint
```

Or rerun the maintainer with:

```powershell
-AutoFixLint
```

Review all formatting changes before merging.

---

### Test failure

Run directly:

```powershell
corepack pnpm run test
```

The maintainer deliberately stops. Do not use `-SkipTests` to merge an unexplained failure.

---

### Build verification failure

Possible causes:

- `package.json` version was changed without rebuilding;
- the build produced a stale userscript;
- downstream namespace metadata was overwritten;
- `dist/chatgpt.user.js` was not generated.

Run:

```powershell
corepack pnpm run build
Select-String `
    -Path .\dist\chatgpt.user.js `
    -Pattern '@namespace|@version'
```

---

### Cherry-pick conflict

Inspect:

```powershell
git status
git diff --name-only --diff-filter=U
```

Resolve each file, then:

```powershell
git add .
git cherry-pick --continue
```

Abort:

```powershell
git cherry-pick --abort
```

---

### Empty cherry-pick

When Git reports that a cherry-pick is empty:

```powershell
git cherry-pick --skip
```

The maintainer normally handles this automatically.

---

### Pull-request creation fails

Check authentication:

```powershell
gh auth status
```

Check branch push:

```powershell
git branch --show-current
git status
git push
```

Create manually:

```powershell
gh pr create `
    --repo danveitch76/chatgpt-exporter `
    --base master `
    --head <branch-name>
```

---

## Safety controls

The maintainer deliberately enforces several controls:

- clean working tree before execution;
- fast-forward-only update of the downstream base branch;
- no automatic upstream merge;
- no automatic semantic conflict resolution;
- frozen dependency lockfile;
- quality gates before commit;
- built userscript metadata verification;
- explicit push and pull-request switches;
- timestamped branches;
- default assessment-only mode.

These controls reduce accidental damage, but they do not eliminate the need for code review.

---

## Known limitations

### Exact subject matching

Equivalent commits are detected using exact commit subjects, not patch identity. The result is advisory.

### Heuristic classification

Commit classification is based on conventional subjects and file paths. Poorly named or mixed-purpose commits may be misclassified.

### Assessment report dirties the repository

Assessment-only mode writes `upstream-assessment.md` into the repository and then exits. Remove or commit the file before another run.

### No branch when nothing is selected

In apply mode, a branch is created only when one or more commits are selected. With no selected commits, later generated files can be staged on the base branch. Confirm the branch before committing.

### All changes are staged

The tool uses `git add --all`. Automatic lint repairs and generated files are included in the same commit.

### No version increment

The tool reads and validates the current package version. It does not calculate or apply semantic version increments.

### No release creation

The tool opens a pull request but does not tag a release, publish a userscript or create a GitHub release.

### No milestone or issue management

The tool does not update GitHub milestones, issues, labels or project boards.

### No semantic conflict policy

Conflicts require manual resolution. The tool does not know which downstream architecture must prevail.

### Windows-focused examples

The script itself is PowerShell 7 and should be portable, but the documented paths and operational testing are Windows-focused.

---

## Governance guidance

Use the following decision policy:

| Upstream change | Default action |
|---|---|
| Functional defect fix | Apply or port selectively |
| Compatibility fix for current ChatGPT behaviour | Apply after validation |
| Upstream release metadata | Do not import |
| Upstream branding | Do not import |
| Generic test improvement | Review and adopt where useful |
| Generic build improvement | Review separately |
| Documentation referring to upstream product | Usually do not import |
| Change overlapping File Discovery | Compare architecture before applying |
| Generated userscript only | Rebuild from downstream source instead |
| Dependency update | Handle as a separate controlled change |

Repository source remains authoritative. A generated userscript is an output, not the implementation baseline.

---

## Suggested future improvements

The present script is useful but should be treated as an initial governed maintainer rather than a complete release platform.

Priority improvements:

1. write assessment reports outside the repository by default;
2. always create a maintenance branch before generating files;
3. detect equivalent commits by patch identity as well as subject;
4. add `-WhatIf` behaviour to every write operation;
5. add a machine-readable assessment format;
6. add explicit commit selection by identifier;
7. separate lint-only changes into their own commit;
8. calculate the next semantic version;
9. update changelog and release manifest consistently;
10. create tags and GitHub releases after merge;
11. validate GitHub workflow results;
12. manage milestone and issue status;
13. add automated tests for the PowerShell maintainer itself.

---

## Licence and attribution

The maintainer script is designed for Dan's downstream ChatGPT Exporter repository. The underlying ChatGPT Exporter project remains subject to its repository licence and upstream attribution requirements.

Review the downstream and upstream `LICENSE` files before redistribution or publication.
