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

## Outstanding gate

Install 2.35.3, reload ChatGPT and confirm the actual menu appearance and placement. Follow the release-guide checks and perform one small read-only export. Keep the pull request draft and #109 open until live validation is sufficient. No release or merge is claimed.
