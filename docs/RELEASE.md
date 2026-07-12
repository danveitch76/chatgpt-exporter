# Release Process

## Version and tag model

Keep the same semantic version in:

- `package.json`;
- `.release-please-manifest.json`;
- `dist/chatgpt.user.js`;
- `CHANGELOG.md`;
- the GitHub release tag.

Tags use:

```text
userscript-vX.Y.Z
```

Use downstream tags in downstream changelog comparison links.

## Quality gates

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run lint
corepack pnpm run test
corepack pnpm run build
```

Verify metadata:

```powershell
Select-String -Path .\dist\chatgpt.user.js -Pattern '@namespace|@version'
```

Expected namespace: `danveitch76`.

## Changelog policy

- Record only releases committed and published from the repository.
- Intermediate local builds may be noted but must not be presented as published releases.
- Attribute imported upstream changes.
- Separate downstream features from upstream compatibility work.
- Compare each release against the previous published downstream tag.

## Automation

Release Please runs on `master` and uses component name `userscript`. The release build workflow runs when the commit message contains `chore: release`.

## Post-release checks

1. Confirm the release and tag.
2. Confirm the release badge.
3. Inspect raw userscript metadata.
4. Install or update in Tampermonkey.
5. Smoke-test single export, Export All with **JSON (ZIP)**, File Discovery, source export and collapsed-sidebar behaviour.
