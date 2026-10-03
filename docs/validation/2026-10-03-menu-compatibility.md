# Menu compatibility repair: 3 October 2026

Tracking: [issue #109](https://github.com/danveitch76/chatgpt-exporter/issues/109).

## Incident and evidence boundary

Dan confirmed that the Exporter menu is missing after a ChatGPT interface change. The baseline was `master` commit `52212ef`, version 2.35.1. The installed userscript version and changed page structure have not been inspected live.

The baseline menu required `[data-testid="accounts-profile-button"]`. Its Sentinel registration also used the literal `'selector'`, although polling partly compensated. These are verified code dependencies; the exact live cause is still unconfirmed.

## Candidate behaviour

Version 2.35.2 preserves the existing menu and its features. One menu instance relocates above a visible original profile anchor, into the supported shared-page anchor, or to a floating bottom-left position when those anchors are unavailable. A one-second check handles anchor appearance, disappearance, visibility changes and client-side route changes without recreating menu state.

The userscript match rules cover all paths on the two existing ChatGPT hosts. No backend endpoint, conversation transformation, export format, file resolver or bulk-operation implementation was changed. No new dependency, telemetry or external conversation processing was introduced.

## Automated validation

- Frozen-lockfile installation completed using the repository's declared pnpm 8.14.1.
- Lint passed.
- TypeScript compilation passed.
- All thirteen existing/new regression fixtures passed, including menu mounting, conversation discovery/filtering, inventory exports, file discovery/classification/resolution and bulk-management manifests.
- The standard `pnpm run test` launcher was blocked by `listen EPERM` when the `tsx` command tried to create a local communication socket. The same fixture files were executed successfully with `node --import tsx`, after a separate `tsc --noEmit`. The repository test scripts were not changed to mask this environment limitation.
- Production build passed. Distribution metadata matches version 2.35.2, namespace `danveitch76`, both host match rules and the existing downstream update URL.
- Two production builds were byte-identical. Distribution SHA-256: `04176066eb6f835dc75a72c41e177ace702e3c609f9ea2e0d6c56761c962b5cc`.

The menu fixture uses a simulated element tree. It covers absent/hidden/replaced anchors, late anchor arrival, repeated scans without duplication, sibling changes, removed menu recovery, shared-page placement, route changes and hidden duplicate profiles. It does not validate real rendering or browser extension execution.

## Outstanding live gate

A headless browser could not be installed in this environment: the browser download did not produce a valid archive. No real-browser or authenticated-account smoke test is claimed.

Install the candidate distribution in Tampermonkey and follow the 2.35.2 checks in [the release guide](../RELEASE.md). Confirm menu access in the changed account layout and a small read-only export with non-sensitive data. Record results before releasing or closing #109.

The candidate is not a published release. Restoring menu access alone does not prove backend export compatibility.
