# Menu styling repair: 3 October 2026

Tracking: [issue #109](https://github.com/danveitch76/chatgpt-exporter/issues/109), [draft pull request #110](https://github.com/danveitch76/chatgpt-exporter/pull/110).

## Live feedback

Dan reported that the 2.35.2 candidate appeared but rejected its presentation. The supplied screenshot showed the launcher over the chat list and popup entries drawn over the underlying conversation titles. The private screenshot is not included in the repository.

This confirms the candidate executes and exposes its menu in that account. It does not confirm backend export success. The screenshot cannot identify the exact new sidebar elements.

## Superseding candidate: 2.35.3

- Give the popup its own opaque background, stacking, grid and item/icon layout.
- Remove generic host menu-item classes and reliance on ChatGPT's layout utilities for this menu.
- Detect the page theme using its colour scheme, recognised theme markers or background, rather than relying solely on `.dark`.
- When the original profile anchor is unavailable, use a visible non-scrolling left-hand navigation region if one can be recognised from semantic elements and geometry.
- Reject short header bars and overflowing navigation lists as mounting slots.
- Place the launcher at the bottom right when no supported mounting slot is available.
- Preserve the same menu instance, features, original-anchor placement and supported shared-page placement.

Sidebar recognition remains a compatibility heuristic. It has not been validated against the actual new element structure in Dan's account. No guessed replacement profile identifier was introduced.

## Validation

Lint, TypeScript compilation and all thirteen regression fixtures passed. As in the 2.35.2 validation, the fixtures were run through `node --import tsx` because the standard launcher cannot create its communication socket in this environment.

Two production builds were byte-identical. Distribution SHA-256: `4d8542ca0d09d9cfa39a6aa2078ffc1352ce97d9c3111e33102452b86dcce34c`.

A headless Chromium browser was subsequently made available through isolated testing tools, without adding dependencies to the exporter package. The rebuilt distribution was executed on synthetic local pages with no ChatGPT utility stylesheet or `.dark` class. Requests were intercepted locally; no authenticated account or private conversation data was used.

Browser checks passed for:

- opaque dark and light popup backgrounds;
- two-column grid and aligned menu items/icons;
- all ten existing menu entries;
- placement in a recognised sidebar lacking the original profile identifier;
- collapsed-sidebar handling;
- removal of the sidebar and relocation of one menu to the right-hand fallback;
- Settings dialog opening;
- popup containment at desktop and mobile widths;
- no browser script errors during the desktop interaction checks.

The four rendered fixture screenshots were visually inspected. These are browser-fixture results, not live ChatGPT-account results.

## Reproduce the optional browser check

The browser check is separate from the standard fixture suite. It requires an independently available Playwright installation and Chromium executable; neither is a new exporter dependency.

```sh
node scripts/validation/Validate-MenuCompatibility.browser.mjs \
  --browser-executable=/path/to/chromium \
  --playwright-module=/path/to/playwright/index.js \
  --screenshots-dir=/path/to/temporary/screenshots
```

Build `dist/chatgpt.user.js` first. The script loads local installed exporter dependencies, substitutes local browser-storage functions and intercepts requests to a synthetic fixture host. It writes synthetic screenshots only.

## Header clearance follow-up: 2.35.4

Dan subsequently approved the launcher position and requested a small downward move because it obscured the Project title. The launcher now moves down 48 pixels when its mounting position is within the top 48 pixels of the viewport. Its horizontal position is preserved. Existing lower sidebar positions and the floating fallback retain their positions.

The offset is subtracted when measuring the original mounting position so periodic scans cannot alternate the offset. Regression fixtures verify this remains stable across repeated scans. The browser fixture also verifies clearance below a synthetic title row and stability after a subsequent scan. The rendered header-clearance screenshot was visually inspected.

Lint, TypeScript compilation, all thirteen fixtures and the expanded browser compatibility check passed. Two production builds were byte-identical. Distribution SHA-256: `6fe7c2a24da85911eb474eec8567b40d4ae9109fc1300663fcff823f798b8ed0`.

## Authorised main-channel deployment

On 3 October 2026, Dan supplied further screenshots showing the lowered launcher clearing the title and the opaque menu displaying correctly, including placement on the home page. These screenshots were reviewed privately and are not included in the repository.

Dan then explicitly instructed: "Let's make it live." The repair is promoted to the main install/update channel at version 2.35.4 under that instruction. This authorisation permits deployment before the remaining live export smoke test; it is not evidence that such a test passed.

The distribution remains byte-identical to the previously tested 2.35.4 build. GitHub Actions still reports zero workflow runs. Release-tag and GitHub Release creation remain pending. Promotion to `master` must be verified independently by reading the main userscript metadata and comparing its blob with the tested distribution.

## Outstanding verification

Perform one small read-only conversation export and check identity, message order and content. The remaining release-guide account checks and restoration of workflow execution are still outstanding. Keep #109 open for that verification and #98 open for the automation incident. Do not claim backend export success or a complete tagged release from menu screenshots alone.
