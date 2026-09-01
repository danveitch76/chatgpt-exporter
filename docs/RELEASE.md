# Release Process

## Authoritative release model

A published userscript release is one final, validated repository commit plus one matching annotated tag.

The release tag must point to the commit that contains the complete release state, including:

- `package.json` version;
- `.release-please-manifest.json` version;
- generated `dist/chatgpt.user.js` metadata and content;
- `README.md` current downstream version;
- `CHANGELOG.md` release entry.

Tags use:

```text
userscript-vX.Y.Z
```

Do not tag a version-bump-only commit, an implementation commit, or a commit that is followed by an automated build commit. The tagged commit must already contain the generated userscript and release documentation.

Use downstream tags in downstream changelog comparison links.

## Release sequence

1. Complete implementation and regression tests.
2. Allow Release Please to prepare the version and changelog metadata on `master`.
3. Update `README.md` to the target downstream version and review the generated changelog entry.
4. Run the production build and include `dist/chatgpt.user.js` in the final release commit.
5. Keep release packaging/documentation together in a final commit using the convention:

   ```text
   release: userscript X.Y.Z
   ```

6. Run all quality gates and confirm the build does not leave an uncommitted generated-userscript diff.
7. Create the annotated `userscript-vX.Y.Z` tag on that exact final release commit.
8. Push the tag only after the commit is present on `master`.
9. The tag workflow re-runs the release validation and, only if every check succeeds, creates the GitHub Release object for that tag.
10. Complete the live userscript smoke tests.

If release packaging is accidentally split across adjacent build/documentation commits before publication, squash them before tagging rather than accepting a split release boundary.

## Quality gates

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm run lint
corepack pnpm run test
corepack pnpm run build
git diff --exit-code -- dist/chatgpt.user.js
```

Verify metadata:

```powershell
Select-String -Path .\dist\chatgpt.user.js -Pattern '@namespace|@version'
```

Expected namespace: `danveitch76`.

Before tagging, also confirm the target version is identical in:

- `package.json`;
- `.release-please-manifest.json`;
- `dist/chatgpt.user.js`;
- the README current downstream version;
- the top matching `CHANGELOG.md` entry.

## Changelog policy

- Record only releases committed and published from the repository.
- Intermediate local builds may be noted but must not be presented as published releases.
- Attribute imported upstream changes.
- Separate downstream features from upstream compatibility work.
- Compare each release against the previous published downstream tag.
- Regression tests for a release should appear before its release boundary in repository history where practical.

## Automation

Release Please runs on `master` and uses component name `userscript`. It prepares release metadata but is configured with `skip-github-release` so it cannot independently create the GitHub release/tag before generated artefacts and documentation are aligned.

The normal `Check` workflow runs lint, tests and a production build, then fails if the build changes `dist/chatgpt.user.js`. This prevents source changes from landing without the corresponding generated userscript.

The `Release Validation` workflow runs only for `userscript-v*` tag pushes. It never commits or pushes repository content. It verifies lint, tests, build reproducibility, tag/package/manifest/userscript version equality, namespace, README version and changelog presence. Only after all of those checks pass does it create the GitHub Release object for the existing validated tag. The release step is idempotent and does nothing if the GitHub Release already exists.

## Post-release checks

1. Confirm the tag resolves to the intended final release commit.
2. Confirm the GitHub Release exists for that exact tag and the release badge resolves correctly.
3. Inspect raw userscript metadata.
4. Install or update in Tampermonkey.
5. Smoke-test single export, Export All with **JSON (ZIP)**, File Discovery, source export and collapsed-sidebar behaviour.
6. For changes to multi-conversation selection, verify the default selection size and at least one non-default value plus resume selection behaviour.

## Recovery rule

If an incorrect tag is discovered before broader publication, delete and recreate the tag against the correct final release commit, then verify the peeled remote target with:

```powershell
git ls-remote --tags origin "userscript-vX.Y.Z*"
```

Avoid rewriting already-published history unless there is a deliberate, reviewed reason to do so and a backup ref has been created first.
