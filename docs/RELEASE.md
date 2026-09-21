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
2. Allow Release Please to prepare the version and changelog metadata on `master`. If no Release Please workflow run is created, prepare the same metadata in a controlled release pull request and record the automation limitation; do not invent CI evidence.
3. Update `README.md` to the target downstream version and review the generated changelog entry.
4. Run the production build and include `dist/chatgpt.user.js` in the final release commit.
5. Keep release packaging/documentation together in a final commit using the convention:

   ```text
   build: release userscript X.Y.Z
   ```

6. Run all quality gates and confirm the generated userscript is byte-for-byte reproducible.
7. Install the userscript from that exact final release tree and complete the live smoke tests before publication.
8. Before creating the tag, fail if the same tag already exists locally or on `origin`; inherited/upstream-derived tags must not be silently reused. Then create the annotated `userscript-vX.Y.Z` tag on that exact final release commit.
9. Push the tag only after the commit is present on `master`.
10. The tag workflow re-runs the release validation and, only if every check succeeds, creates the GitHub Release object for that tag.
11. Complete the post-release publication checks.

If release packaging is accidentally split across adjacent build/documentation commits before publication, squash them before tagging rather than accepting a split release boundary.

## Quality gates

```powershell
corepack prepare pnpm@8.14.1 --activate
pnpm --version
pnpm install --frozen-lockfile
pnpm run lint
pnpm run test
pnpm run build
git diff --exit-code -- dist/chatgpt.user.js
git status --short
```

Verify metadata:

```powershell
Select-String -Path .\dist\chatgpt.user.js -Pattern '@namespace|@version'
```

Expected namespace: `danveitch76`. The update and download URLs must both resolve to the maintained downstream `master/dist/chatgpt.user.js` raw file.

Before tagging, confirm the tag name is unused locally and remotely:

```powershell
$tag = "userscript-vX.Y.Z"
if (git tag -l $tag) { throw "Tag already exists locally: $tag" }
if (git ls-remote --exit-code --tags origin "refs/tags/$tag" 2>$null) { throw "Tag already exists on origin: $tag" }
```

Then confirm the working tree is clean and the target version is identical in:

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

## Live smoke-test gate

Before tagging, install the userscript from the exact final release tree and smoke-test the capabilities affected by the release plus the core regression paths. For userscript 2.35.1 this includes:

- single-conversation export;
- Export All with **JSON (ZIP)**;
- Project and Chat inventory exports;
- File Discovery;
- Bulk Rename against a disposable/test conversation, including preview and confirmed rename;
- Bulk Project Management against disposable/non-critical records, including a mixed move/rename batch, idempotent rerun and stale-state rejection;
- source selection/filtering;
- collapsed-sidebar behaviour;
- Tampermonkey installation from the downstream GitHub raw userscript and update metadata visibility. 

For 2.35.1, also verify that an installed downstream script can discover a later test version through Tampermonkey's update mechanism before treating auto-update as validated.

For changes to multi-conversation selection, also verify the default selection size and at least one non-default value plus resume selection behaviour.

## Post-release checks

1. Confirm the annotated tag resolves to the intended final release commit.
2. Confirm the GitHub Release exists for that exact tag and the release badge resolves correctly.
3. Inspect raw userscript metadata and confirm the published version/namespace.
4. Install or update from the published userscript and perform a minimal launch/export sanity check.
5. Record any missing workflow/CI execution explicitly rather than treating absence of a status as success.

## Recovery rule

If an incorrect tag is discovered before broader publication, delete and recreate the tag against the correct final release commit, then verify the peeled remote target with:

```powershell
git ls-remote --tags origin "userscript-vX.Y.Z*"
```

Avoid rewriting already-published history unless there is a deliberate, reviewed reason to do so and a backup ref has been created first.
