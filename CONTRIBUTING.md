# Contributing

Contributions are welcome. This repository is a maintained downstream fork, so changes must preserve upstream exporter behaviour and downstream capabilities including File Discovery, Project/Chat inventory exports and Bulk Rename Conversations.

## Prerequisites

- PowerShell 7 for maintenance tooling
- Git
- Node.js 20 or later
- Corepack
- pnpm 8.14.1 through Corepack

```powershell
git --version
node --version
corepack --version
corepack prepare pnpm@8.14.1 --activate
pnpm --version
```

## Local setup

```powershell
git checkout master
git pull --ff-only
git checkout -b <type>/<short-description>
pnpm install --frozen-lockfile
pnpm dev
```

Use the browser popup to install the development userscript.

## Required validation

```powershell
pnpm run lint
pnpm run test
pnpm run build
```

The test command covers TypeScript compilation, conversation discovery and date filtering, title transformations, Project/Chat inventory export, extraction fixtures, archive-limit planning, generated and uploaded asset classification, failure recovery, file resolution and file-reference classification.

The build must produce `dist/chatgpt.user.js`. Its version must match `package.json`, and its namespace must remain `danveitch76`.

## Commit messages

The repository enforces Conventional Commits. Allowed types are:

`build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`.

Examples:

```text
feat: add upstream maintenance automation
fix: report the actual export selection total
docs: update file discovery capability boundary
test: add file resolver regression coverage
```

`maint:` is not accepted.

## Pull requests

A pull request should:

- explain the problem and intended outcome;
- identify downstream and upstream impact;
- list material assumptions;
- include validation evidence;
- preserve established downstream behaviour, including File Discovery, inventory exports, Bulk Rename and resolver behaviour, unless explicitly changed;
- include rebuilt distribution output when source changes affect it;
- update the changelog and relevant documentation.

Do not commit directly to `master`.

## Upstream changes

Do not merge upstream blindly. Run:

```powershell
.\scripts\maintainer\Maintain-ChatGPT-Exporter.ps1 `
    -RepoPath <repository-path>
```

Review the assessment before applying changes. See [the maintainer guide](./scripts/maintainer/README.md).

## Releases

For a release, align `package.json`, `.release-please-manifest.json`, `README.md`, `CHANGELOG.md` and `dist/chatgpt.user.js`; run all quality gates and live smoke tests on the exact final release tree; and use the `userscript-vX.Y.Z` tag convention.

See [docs/RELEASE.md](./docs/RELEASE.md).
