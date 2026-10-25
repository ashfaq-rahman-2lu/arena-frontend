# Seven tournament UX improvements

Implemented on 25 October 2026. Both repositories had clean tracked/untracked working trees at the start. All source changes below belong to this task; there were no pre-existing user edits to preserve. No source files were deleted or renamed.

## Behavior and validation

- Lookup accepts IDs and shared links, validates inline, and supports correction on public error pages. Unknown/invalid IDs no longer offer a futile retry of the same value.
- Optional stats are collapsed for quick entry and automatically open for recorded/imported values. Collapsing preserves values and saves them normally.
- The admin Knockout section exposes group matches and qualification-cutoff ties with appropriate next actions; advancement remains an explicit confirmation.
- Team names link to fixtures, reset unrelated filters, and focus/scroll to the destination. Team and tournament counts are labeled separately.
- Public pages show their last successful refresh time and interval and retain data during refresh failures, with manual recovery.

Test-first evidence: the focused Home, tournament-experience, and match-editor run initially reported 16 expected failures and 26 passes. Lookup recovery was also checked with a corrected initial-error harness (expected missing-form failure), and destination focus and removal of futile 404 retries each had focused failing/passing runs. The focused suite subsequently passed all 42 tests. Existing expanded-stat and unlabeled-total assertions were intentionally updated to the new behavior.

Final verification: `npm test` (131 tests), `npm run typecheck`, `npm run lint`, `npm run format:check`, and the production build invoked by the browser runner. The affected browser command is `npm run test:browser -- e2e/organizer-layout.spec.ts e2e/extracted-stats.spec.ts e2e/tournament-experience.spec.ts`: all 24 desktop/mobile checks passed, including accessibility checks, screenshot import, zoom, long names, fixed save controls, and overflow checks. The first sandboxed browser attempt could not bind local port 5174; the permitted local-preview run succeeded. Two old browser layout assertions initially needed the new disclosure opened; the final run passed.

Live signed-in and signed-out views were inspected. Mobile quick-score and public-page screenshots and the desktop public-page screenshot were visually checked. Browser tests intercepted API traffic with test fixtures and did not use a real test/development database.

## Complete source and documentation change list

- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/README.md` — Modified: documents lookup/link parsing, error recovery, stats disclosure, fixture navigation/counts, refresh feedback, and qualification guidance.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/e2e/organizer-layout.spec.ts` — Modified: expands optional stats before existing scrolling/alignment checks; expects explicitly labeled tournament totals.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/e2e/tournament-experience.spec.ts` — Created: desktop/mobile tests for editable lookup recovery, full links, inline validation, team fixtures/counts, refresh failure/retry, qualification shortcuts, and keyboard stats disclosure; captures screenshots and runs accessibility checks.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/features/score-editing/match-editor.tsx` — Modified: accessible optional-stat disclosure; starts collapsed without recorded values, opens for stored/imported stats (including zero), preserves drafts while collapsed.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/features/score-editing/match-editor.test.tsx` — Modified: replaces the always-expanded expectation with disclosure behavior; checks automatic opening for recorded zero values and saving stats after collapse; existing OCR tests verify imported stats remain visible.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/features/tournament-management/standings-table.tsx` — Modified: team names link to their complete fixture list and request destination focus.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/features/tournament-management/tournament-page.tsx` — Modified: mounts editable public error recovery, removes futile retries for public 400/404 responses, restores the error-page skip-link target, adds refresh feedback, scoped fixture progress, admin qualification guidance, and team links with destination focus/scrolling.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/features/tournament-management/tournament-page.test.tsx` — Modified: updates global-progress expectations to the new explicit Tournament label.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/features/tournament-management/tournament-experience.test.tsx` — Created: integration/component coverage for editable recovery, team navigation/filter resets/focus, separate totals, group blockers/ties, explicit qualifier review, and retained public data during refresh failures.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/features/tournament-management/fixture-navigation.ts` — Created: builds a team-specific fixture query while clearing unrelated filters.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/features/tournament-management/fixture-progress.tsx` — Created: displays selected-team and tournament played/total counts independently of status and round filters.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/features/tournament-management/qualification-progress.tsx` — Created: lists remaining group matches and qualification-cutoff ties; routes admins to unfinished fixtures, tie resolution, start review, or existing qualifier confirmation.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/features/public-viewing/tournament-lookup.tsx` — Created: shared labeled lookup form; parses 8–10 character IDs and HTTP(S) tournament links, normalizes case, validates inline, and always navigates locally.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/features/public-viewing/refresh-status.tsx` — Created: displays last successful local time/time zone, refresh interval, pending/failure feedback, and manual retry.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/pages/Home.tsx` — Modified: uses the shared lookup form instead of treating every pasted value as an ID.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/pages/Home.test.tsx` — Created: ID/link normalization and inline rejection coverage for malformed values and unsupported URLs.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/src/styles.css` — Modified: styles lookup recovery, qualification guidance, linked names, public refresh feedback, scoped progress, and the stats disclosure using existing tokens; offsets destination scrolling below sticky navigation.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/docs/UX_IMPROVEMENTS.md` — Created: implementation, validation, full source-change list, generated artifact inventory, and non-file change record.

## Generated and temporary files

Builds refreshed the ignored production output below, replacing previous generated bundles. TypeScript, Vitest, and Playwright also refreshed their normal ignored metadata/report files. These are verification artifacts, not source or dependency changes.

- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/_routes.json` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/Home-B6Stc06n.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/auth-page-ErFWid3p.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/dashboard-page-kmBBchPG.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/index-B-8t24b4.css` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/index-DNCMKKQ7.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/match-editor-Bv9y_190.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/pagination-CFNYhyZu.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/public-page-DEE41AEo.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/result-entry-CRGVIBtn.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/scan-line-Dkcwvx65.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/setup-draft-CE8SxYs_.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/setup-page-JgqlY0sy.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/swords-yBngjR9T.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/tournament-lookup-BNFiq0US.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/tournament-page-B__Vpids.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/useMutation-y3C7ywCV.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/assets/users-CHqmqWo-.js` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/dist/index.html` — Rebuilt production output.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/test-results/.last-run.json` — Regenerated verification metadata/report.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/playwright-report/index.html` — Regenerated verification metadata/report.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json` — Regenerated verification metadata/report.
- `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend/tsconfig.tsbuildinfo` — refreshed TypeScript incremental build metadata.

Screenshots generated/refreshed by the affected desktop/mobile browser checks:

- `/private/tmp/arena-desktop-compact-fixtures.png` — browser verification screenshot.
- `/private/tmp/arena-desktop-mirrored-editor-zoom.png` — browser verification screenshot.
- `/private/tmp/arena-desktop-mirrored-editor.png` — browser verification screenshot.
- `/private/tmp/arena-desktop-public-experience.png` — browser verification screenshot.
- `/private/tmp/arena-desktop-qualification-standings.png` — browser verification screenshot.
- `/private/tmp/arena-desktop-quick-score.png` — browser verification screenshot.
- `/private/tmp/arena-desktop-score-controls.png` — browser verification screenshot.
- `/private/tmp/arena-desktop-sticky-navigation.png` — browser verification screenshot.
- `/private/tmp/arena-desktop-title-menu.png` — browser verification screenshot.
- `/private/tmp/arena-mobile-compact-fixtures.png` — browser verification screenshot.
- `/private/tmp/arena-mobile-mirrored-editor-zoom.png` — browser verification screenshot.
- `/private/tmp/arena-mobile-mirrored-editor.png` — browser verification screenshot.
- `/private/tmp/arena-mobile-public-experience.png` — browser verification screenshot.
- `/private/tmp/arena-mobile-qualification-standings.png` — browser verification screenshot.
- `/private/tmp/arena-mobile-quick-score.png` — browser verification screenshot.
- `/private/tmp/arena-mobile-score-controls.png` — browser verification screenshot.
- `/private/tmp/arena-mobile-sticky-navigation.png` — browser verification screenshot.
- `/private/tmp/arena-mobile-title-menu.png` — browser verification screenshot.
- `/private/tmp/tournament-swap/desktop-codm.png` — browser verification screenshot.
- `/private/tmp/tournament-swap/desktop-controls.png` — browser verification screenshot.
- `/private/tmp/tournament-swap/desktop-stats.png` — browser verification screenshot.
- `/private/tmp/tournament-swap/mobile-codm.png` — browser verification screenshot.
- `/private/tmp/tournament-swap/mobile-controls.png` — browser verification screenshot.
- `/private/tmp/tournament-swap/mobile-stats.png` — browser verification screenshot.

Temporary command logs and intermediate files:

- `/private/tmp/arena-ux-browser.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-ux-format.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-ux-green.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-ux-lint.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-ux-red.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-ux-suite.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-ux-types.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-recovery-red.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-team-focus-green.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-team-focus-red.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-lookup-retry-green.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-lookup-retry-red.log` — local check output, including expected red runs where indicated in the filename.
- `/private/tmp/arena-tournament-page-with-recovery.tsx` — temporary source snapshot created for the focused recovery red/green check, then removed.

Playwright replaced transient failed-run traces/screenshots/error-context artifacts under `test-results/` when the final passing run regenerated that directory. The final retained generated files are listed above.

## Non-file changes and limits

- Started and stopped only the browser runner’s temporary local frontend preview on port 5174. The existing frontend/backend servers were not restarted; the development frontend picked up source changes through hot reload.
- Navigated the existing admin and signed-out public tabs and opened/closed the result editor; no match results, tournament settings, qualification, accounts, or database records were saved or changed.
- No environment/configuration files, generated API contracts, package files, lockfiles, dependencies, backend source, migrations, external applications, or deployments changed.
- No commits or pull requests were created. This work covers frontend UX and mocked browser/component regression tests; it does not re-test backend persistence/authorization workflows.
