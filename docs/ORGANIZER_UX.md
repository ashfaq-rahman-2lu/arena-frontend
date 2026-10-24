# Organizer workflow improvements — 2026-10-24

## Design and intentional behavior changes

Keep Arena's dark surfaces, lime accent, Inter typography, semantic controls, and responsive layouts. Reduce the tournament title/summary spacing and metric padding. Group name editing, participant additions, and match-stat management under the native keyboard-accessible Manage tournament disclosure. Sharing and public viewing remain directly available. Informational group-stage messaging uses a compact panel; actionable progression banners retain their actions.

Replace the arbitrary 50-fixture pages with stage/round navigation. A round includes all matching fixtures, across groups, and group and knockout rounds with the same number remain distinct. Open the first unfinished round initially (or the first round when all are finished); render fixture rows only for expanded rounds. Each heading reports played/total counts for the current filters. The round selector is stored in the URL. Team/status/stage changes reset the round selection. Old fixturesPage URLs are accepted but no longer paginate fixtures. History and preview pagination are unchanged.

The score dialog keeps its title and action footer visible while its fields scroll independently. This applies to manual entry, optional stats, extraction review, conflicts, and correction previews. Existing result validation, pending locks, revision checks, and confirmation workflows remain in place. The hidden scorecard file control is anchored to its upload area so focus/scroll cannot move the outer dialog.

## Verification

- RED: `npm test -- src/features/tournament-management/tournament-page.test.tsx` failed for the missing round selector and Manage tournament control. An initial Node 16 setup failure was corrected by using installed Node 24.21.0 and is not counted as red evidence.
- RED: `npm run test:browser -- e2e/organizer-layout.spec.ts --grep 'score saving'` reproduced the offscreen Save result control on mobile and after expanding desktop match stats.
- GREEN: all 70 unit/component tests passed, including stage/round separation, filter reset, management actions, and a complete 60-fixture round.
- Desktop/mobile browser checks verify round selection, Enter/Space accordion operation, the management disclosure, horizontal containment, and saving controls before/after optional-field scrolling. The score dialog is also checked with axe WCAG A/AA scans.
- Typecheck, lint, formatting, and production build passed. Production builds also ran as the browser suite's preview-server setup.
- Inspected mobile and desktop screenshots and the running localhost tournament, without submitting results or changing tournament data.

The isolated browser suite mocks API responses and runs without a backend checkout. The older backend-backed arena suite's expectations were updated for round rendering and the management disclosure; that suite was not rerun because its dedicated seeded fixture was not started. No deployment, database migration, account update, or persistent process change was performed. Temporary preview servers were started and stopped by Playwright.

## Remaining recommendations completed

The second phase extends the earlier uncommitted compact-header, round-navigation, and fixed-footer implementation. It preserves those changes and does not overwrite unrelated user edits.

- A prominent Enter result action opens the first unplayed fixture in the current team/stage/round view. All matches, To play, and Played shortcuts report counts for the selected team/stage and reset the round filter when selected. Fixture result actions retain visible labels on phones, and key controls use at least 44px targets.
- Tournament navigation stays at the viewport top when scrolling. On phones it prioritizes Fixtures, Standings, and Knockout when applicable. More exposes Overview, Teams, Team stats, and Revision history when available. Tab arrows/Home/End, keyboard activation, Escape dismissal, selected states, and focus restoration are supported.
- Standings distinguish current provisional qualification positions from confirmed qualification. A dashed cutoff and text label identify the last advancing place. The table guide explains the score abbreviations and tie-break order. Phones initially show rank, team, played, score difference, and points; Show full statistics exposes all other columns with local horizontal scrolling. Desktop shows all columns. Table headings, numbers, and secondary labels have improved readability/contrast.
- Scorecard import starts collapsed. Manual scores stay first, and Cancel/Save remain visible. Save & next match appears when another unplayed fixture exists in the current view. It advances only after a successful response and initializes the next draft from returned matches/revisions; failures retain the current draft, pending requests block duplicate submission, and correction confirmations retain the selected save intent.

### Second-phase verification

The focused test command (`npm test -- src/features/tournament-management/tournament-page.test.tsx src/features/score-editing/match-editor.test.tsx`) first failed for five missing behaviors: result entry/status shortcuts, qualification guidance, save-and-next integration, collapsed upload, and failure-safe advancement. Those focused cases now pass, including returned revision handling, fresh drafts/focus, filter scope, and duplicate-submit protection.

The navigation browser test first failed for missing Tournament navigation. Its harness initially needed complete typed impact fixtures before it could run; those setup failures are not red evidence. A later short desktop fixture needed its second round expanded to allow scrolling far enough to exercise the sticky position.

All 77 unit/component tests pass. Twelve isolated browser cases passed across desktop and mobile (`npm run test:browser -- e2e/organizer-layout.spec.ts e2e/extracted-stats.spec.ts`), covering sticky navigation, More/Escape, keyboard round controls, visible save actions, optional stats and scorecard upload, all extracted stats, CODM manual-only entry, qualification/cutoff guidance, compact/full table columns, text zoom, long names, overflow, and axe WCAG A/AA scans of the score and standings views. Typecheck, lint, formatting, and production build pass. The older backend-backed suite has been adapted for the mobile More navigation and collapsed upload, but was not executed without its dedicated seeded backend fixture.

No real results, account settings, database data, or deployments were changed. The existing local Vite process picked up source edits; temporary Playwright preview servers were started and stopped automatically.

## Title actions menu

The follow-up menu change replaces the text Manage tournament disclosure with a three-dot button on the right of the tournament name. It groups Rename, Add teams, conditional stats enable/archive, Share tournament, and the owner's Public page link. Enter result remains directly available. Public viewers retain sharing without owner-only actions. Existing participant-addition and stats-archive conditions and confirmation workflows are unchanged.

The disclosure uses a named native button with expanded/control relationships and a grouped list of ordinary buttons/links. Tab reaches the actions; Escape restores focus to the trigger; outside pointer clicks dismiss it. Dialogs opened from its actions retain the menu until the dialog is dismissed, so Escape cannot hide an active form or bypass its unsaved-draft guard. The popover aligns to the title's right edge and stays horizontally contained on phones with long names.

RED: the focused tournament-page suite failed for the missing Tournament actions button before implementation (two expected failures). GREEN: its 11 cases pass, and all 78 unit/component tests pass. All 10 organizer browser cases pass across desktop/mobile, including the grouped actions, containment, keyboard dismissal, nested-dialog behavior, and axe scan. Typecheck, lint, formatting, and the browser suite's production build pass. Both viewport screenshots and the running localhost tournament were inspected. The older backend-backed browser suite was updated for the new trigger and Public page location but was not executed without its seeded fixture.

This phase created `src/features/tournament-management/tournament-actions.tsx` and modified the tournament page, its tests, stylesheet, organizer browser tests, legacy arena browser tests, and this document. Earlier UI changes were preserved; no unrelated user changes, real tournament data, backend files, or deployments were changed. The local preview was left with its menu open for inspection.

## Standings-first header and team-based result entry

This phase replaces the earlier direct first-unplayed Enter result shortcut with a team-based picker. Started League and Group + knockout pages initially show Standings; knockout-only pages show Knockout, and drafts retain Overview. Explicit tab URLs and deliberate navigation take priority. The same compact header applies to owner and public pages, with owner-only result entry.

The header now shows a two-line tournament name, information, plus, vertical action dots, and played/total matches with a rounded percentage (including 0/0 matches (0%)). It removes the redundant My tournaments link, large metric/progress panels, and descriptive banners. The information dialog retains the complete name, public ID, game, format, teams/groups, qualifiers, legs, point rules, stage/status explanation, stats availability, viewing mode, and champion when present. Existing setup and progression actions remain compact buttons beside the summary, with permissions unchanged. Icons have 44px targets and hover/focus tooltips with Escape dismissal.

The picker sorts entrants alphabetically and prevents identical teams. It lists all scheduled fixtures in either direction, independently of fixture-tab filters, pending before saved; each choice identifies its actual orientation, group/stage, round, leg, and saved score. Selecting an existing fixture explicitly opens Make the result official. Cancellation retains the pair and returns focus to that fixture. Successful normal saving closes the flow and returns focus to plus. Save & next match stays within the selected pair and uses returned tournament and match revisions. Direct fixture-row entry retains filter-based advancement. The editor's optional onCompleted callback distinguishes successful completion from cancellation without changing existing callers; validation, extraction, failed drafts, stale writes, correction confirmations, and submission locks remain in place.

RED: `npm test -- src/features/tournament-management/standings-first.test.tsx` produced 10 expected failures and one pass before implementation. The focused green run exposed a returned-revision handoff issue, fixed by retaining the server's returned tournament for the next editor. A mobile first-viewport browser test failed before compact styling because the title controls were not inline. Screenshot review also identified tooltip clipping at 200% text zoom, covered by a browser containment assertion that failed with a negative tooltip x-coordinate before the fix. A parallel unit run timed out on the lazy-loaded picker; the test now explicitly allows up to five seconds for that asynchronous first import, retaining all behavior assertions.

GREEN: all 89 unit/component tests pass. All 24 affected isolated desktop/mobile browser cases pass across standings-first, organizer-layout, and extracted-stats suites. They cover reverse legs, saved edits, same-team prevention, empty/changed pairs, cancellation, failed saves, pair-scoped advancement, returned revisions, focus restoration, menu dismissal, long names, 200% text zoom, and hover/focus tooltips. Standings headings and the first row are fully visible without scrolling at 375×812 and 1440×900. Mobile/desktop standings, zoom, and picker screenshots were inspected. Typecheck, lint, formatting, and production build pass. The legacy seeded-backend browser suite was adapted for the public refresh note moving into information; it was not run without its dedicated backend fixture.

Current-phase authored changes (earlier uncommitted UI work is preserved):

- `src/features/tournament-management/result-entry-model.ts` — created typed team-pair filtering and pending-first ordering across both fixture directions.
- `src/features/tournament-management/result-entry.tsx` — created the team/fixture picker, retained selections and focus, pair-scoped next flow, and returned-revision handoff.
- `src/features/tournament-management/tournament-header.tsx` — created the shared compact header, progress summary, information dialog, and accessible icon actions/tooltips.
- `src/features/tournament-management/standings-first.test.tsx` — created behavior coverage for default views, summary/information, picker states, successful/failed saves, cancellation, orientation, and returned revisions.
- `src/features/tournament-management/tournament-page.tsx` — integrated defaults, compact header/actions, lazy result picker, and plus-focus restoration; removed redundant header panels and banners.
- `src/features/tournament-management/tournament-page.test.tsx` — made overview keyboard tests explicit and retained direct-row filter-scoped save tests under the new picker behavior.
- `src/features/tournament-management/tournament-actions.tsx` — changed the title menu icon to vertical dots; preserved menu behavior and permissions.
- `src/features/score-editing/match-editor.tsx` — added an optional backward-compatible successful-completion callback.
- `src/styles.css` — styled compact header, bounded tooltips, information rows and fixture choices; removed obsolete large header/stat/banner rules.
- `e2e/standings-first.spec.ts` — created isolated desktop/mobile coverage with typed save/revision validation and screenshot artifacts.
- `e2e/organizer-layout.spec.ts` — gave the sticky-navigation case enough fixtures to exercise real scrolling after header compaction.
- `e2e/arena.spec.ts` — adapted the public refresh-note assertion to the information dialog.
- `docs/ORGANIZER_UX.md` — recorded intentional behavior changes, verification and complete authored/generated inventory.

No backend endpoints, database data, migrations, generated contracts, dependencies, configuration, environment files, deployments, or account settings changed. No authored files were deleted or renamed. Earlier fixture-rounds, standings-table, tournament-navigation, shared Modal, match-editor tests, and extracted-stats browser work were preserved without further edits this phase. Temporary isolated Playwright preview servers were started and stopped; the existing local Vite process picked up source changes.

## Simplified tabs and group headers

Overview is removed from owner/public pages, desktop tabs, and mobile More. Standings is now the first/default tab for League and Group + knockout, including drafts; knockout-only tournaments put Knockout first/default. Legacy tab=overview links replace the history entry with that format's default and preserve other query parameters. Other explicit tab choices remain unchanged. Drafts retain Edit setup and Review & start; empty draft tables explain that standings appear when play starts. The deleted Overview's duplicate rules remain in Tournament information.

Group headings now pair the group name with a compact Top N badge using the configured qualification count. The explanation panel and visible Qualification cutoff label are removed. Existing qualification row accents, dashed border, and screen-reader position descriptions remain. The badge explains advancement and provisional/confirmed status on hover, focus, or touch; Escape dismisses it. Its accessible name includes the visible count. The mobile full/key-statistics toggle is an icon at the header's right edge with a 44px target, pressed state, and named tooltip. Desktop still shows every column without that toggle. League headers receive the same mobile control. The visual design retains Arena's existing dark/lime tokens and typography; headings wrap for long names.

RED: the focused standings-first and tournament-page suites failed on eight missing behaviors before implementation; the new standings-table suite separately failed both icon/tooltip and confirmed multi-group badge tests. Commands: npm test -- src/features/tournament-management/standings-first.test.tsx src/features/tournament-management/tournament-page.test.tsx; npm test -- src/features/tournament-management/standings-table.test.tsx. Screenshot inspection then exposed a long-name/200%-zoom tooltip below the viewport. An added mobile browser assertion reproduced it (bottom 1169px versus an 812px viewport). Tooltip positioning now measures the trigger and flips above it when necessary, clamps horizontally, and updates on scrolling/resizing/content resize with listener cleanup.

GREEN: all 93 unit/component tests across 19 files pass. All 22 affected desktop/mobile browser cases pass across standings-first and organizer-layout, including first-row visibility at 375×812 and 1440×900, legacy URLs, keyboard operation, picker/save regressions, menu dismissal, accessibility scans, long names, and text zoom. Typecheck, lint, formatting, and production build pass. An initial browser startup was blocked by a test-helper TypeScript return mismatch, which was corrected before the successful build. Screenshots of both layouts and the zoomed tooltip were inspected. An additional focused desktop/mobile run passed both cases with explicit hover/touch activation; the final Playwright report contains that focused run. The seeded-backend legacy suite was not run; isolated browser tests use mocked API state without a backend checkout.

This phase modifies earlier uncommitted UI work without overwriting unrelated changes. Current-phase authored inventory:

- src/features/tournament-management/tournament-page.tsx — removes Overview content; resolves format defaults and legacy URLs; adds the empty-draft message while retaining setup actions.
- src/features/tournament-management/tournament-navigation.tsx — removes Overview and orders Standings/Knockout first on desktop/mobile.
- src/features/tournament-management/standings-table.tsx — replaces guidance/cutoff copy with qualification badges, accessible viewport-aware tooltips, and the mobile statistics icon; retains row semantics and accents.
- src/styles.css — styles the compact standings heading/badge/icon/tooltips; removes obsolete qualification guidance/cutoff-label/Overview-grid styles; permits tooltip overflow from the panel.
- src/features/tournament-management/standings-first.test.tsx — updates defaults/tab ordering and adds history-replacement/filter-preservation and draft-empty-state coverage.
- src/features/tournament-management/tournament-page.test.tsx — updates keyboard tab navigation and qualification expectations.
- src/features/tournament-management/standings-table.test.tsx — new focused icon/focus/keyboard/pressed-state and confirmed multi-group badge tests.
- e2e/organizer-layout.spec.ts — updates compact standings assertions and verifies icon placement, touch/hover/focus tooltips, keyboard toggling, dismissal, and accessibility.
- e2e/standings-first.spec.ts — verifies first-tab order, missing Overview, compatible URLs/mobile More, long group names, and zoomed tooltip containment; writes new zoom screenshots.
- docs/ORGANIZER_UX.md — records this phase's intentional changes, verification, and generated inventory.

No authored files were deleted or renamed. Earlier score-editor, result-picker, title-menu, fixture-round, shared-Modal, extraction, and backend work was left intact. No API contracts, dependencies, configuration, environment files, database data, account settings, or deployments changed. Playwright started/stopped temporary preview servers; the existing local Vite process picked up source edits. No real tournament writes were submitted.

## Reduced group-header height

Reduced the standings header's vertical padding to 8px on desktop/mobile, giving ordinary single-line group headers a 61px height instead of 87px desktop/83px mobile. Badge and statistics controls retain their 44px touch targets, long names still wrap, and other panel headers keep their spacing. This phase modifies only src/styles.css, e2e/organizer-layout.spec.ts, and this document; earlier uncommitted changes are preserved. No authored files were created, deleted, or renamed.

RED: the isolated mobile standings browser case failed its new compact-header acceptance check with an 83px height (maximum 64px). GREEN: six affected desktop/mobile browser cases pass, covering the reduced height, keyboard/touch controls, first-row visibility, long names, and 200% text zoom. All 93 unit/component tests, typecheck, lint, formatting, and production build pass. Desktop/mobile screenshots were inspected. Playwright regenerated the two qualification-standings, two standings-first, two compact-zoom, and two standings-header-zoom screenshots already listed below; reports, TypeScript/Vitest caches and production assets were regenerated. Its temporary preview server stopped after the run. No backend, API, configuration, environment, dependency, database, deployment, or real tournament data changes were made.

## Compact fixtures and mirrored result editor

Fixtures now replace the large matchup heading and status shortcuts with a whole-tournament played/total matches played summary. Existing team/status/stage/round dropdowns remain, and the redundant fixtures/play-order line is removed. Expand all/Collapse all operates on displayed rounds, while individual keyboard-accessible round controls remain. Initial expansion still chooses the first unfinished round; filter changes remount that expansion state and selected-round URL changes reset it. Ordinary round headers use 44px minimum height and 6px vertical padding, with wrapping when necessary. Visible fixture actions read Add or Edit; their accessible names retain teams and round.

The result editor now presents names, compact scores and a centered colon in one mirrored row. Large team badges and duplicate visible score labels are removed; hidden native labels, input IDs, error announcements and invalid/described-by relationships preserve validation and focus behavior. Swap results is centered below the colon. At enlarged text sizes in a narrow container, names move above the paired inputs so long names do not force the input row itself to become excessively tall. Complete names remain visible through wrapping and the body remains independently scrollable above the fixed save footer.

Import scorecard and Read scorecard are adjacent icon buttons directly below the scores. Import opens the existing native chooser; Read is disabled until a valid image exists and while reading/saving. The existing filename, image preview, file rules, replacement/abort handling, extraction errors, mapping, warning/review tables, draft protection and request identity logic are retained. The old disclosure, explanatory upload copy and dashed upload drop area are removed. Stats-enabled tournaments always show all optional stat inputs as compact home value / central stat name and unit / away value rows; repeated team labels and fieldset cards are removed. Inputs retain accessible team/stat names, validation and touched-field protection. The existing manual-only CODM behavior, knockout decisions, correction confirmations, failed drafts, stale-write reconciliation, duplicate-submit guards and both save-next scopes remain.

RED: npm test -- src/features/tournament-management/fixture-rounds.test.tsx src/features/tournament-management/tournament-page.test.tsx src/features/score-editing/match-editor.test.tsx produced four expected missing-behavior failures and 33 passes before implementation. GREEN: the same focused command passed all 37 cases after implementation. Additional empty-round and filter-reset regressions were added. All 97 unit/component tests pass. All 28 affected isolated desktop/mobile browser cases pass across organizer-layout, standings-first and extracted-stats. They exercise the native file chooser, preview retention, all extracted stats, CODM, global/individual round expansion, reduced heading height, unequal team-name alignment, compact stats, centered swap, adjacent import actions, zoom/input visibility, accessible controls and existing saving/menu flows. The final focused desktop/mobile round-navigation rerun also passes; its two cases are the last retained Playwright report. Typecheck, lint, formatting and production build pass. Mobile/desktop screenshots at 375×812 and 1440×900 and enlarged-text editor screenshots were inspected. The legacy seeded-backend arena suite was adapted for direct upload but was not run without its dedicated fixture.

Current-phase authored changes (earlier uncommitted UI work is preserved):

- src/features/tournament-management/fixture-rounds.tsx — controlled individual/global round expansion with selected-round reset; removes redundant fixture copy.
- src/features/tournament-management/fixture-rounds.test.tsx — new expansion, selected-round and empty-round behavior coverage.
- src/features/tournament-management/tournament-page.tsx — replaces fixture toolbar copy/shortcuts with global progress and short Add labels; preserves filters and accessible action names.
- src/features/tournament-management/tournament-page.test.tsx — tests global progress, dropdown filtering, Add wording and expansion reset after filter changes.
- src/features/score-editing/match-editor.tsx — mirrored scores with hidden labels/errors, centered swap, direct import/read controls with retained preview, and always-visible compact stats.
- src/features/score-editing/match-editor.test.tsx — tests direct file choosing, disabled/enabled Read, retained image preview and immediately editable stats; removes obsolete disclosure interactions.
- src/styles.css — compact fixture/round layout, mirrored score grid and enlarged-text fallback, centered swap, upload action row, compact stat rows; removes obsolete shortcuts, upload drop/disclosure and stacked-score/card styles.
- e2e/organizer-layout.spec.ts — exercises real file choosing, round actions/height, unequal-name score and stat geometry, fixed save controls, zoom containment and screenshots.
- e2e/extracted-stats.spec.ts — uses the directly available upload input in extraction regressions.
- e2e/arena.spec.ts — updates legacy upload flow for removal of the import disclosure.
- docs/ORGANIZER_UX.md — documents intentional behavior changes, red/green evidence and authored/generated inventory.

No authored files were deleted or renamed. No backend source/endpoints, database data/migrations, generated contracts, dependencies, configuration, environment, accounts or deployments changed. Only mocked test results were saved. Existing local Vite source watching remains; Playwright started and stopped temporary preview servers. The build/test commands regenerated the outputs, caches, reports and earlier screenshot paths listed below; four new mirrored-editor screenshot paths and two test logs are added to that inventory.

## Remove duplicate extraction review

Removed the Suggested scores filled message, the separate Extracted match stats table and the obsolete Stats are shown for review only disclaimer. Imported values still populate the editable score/stat fields with the existing touched-field protections. The image preview, extraction errors, warnings, unmatched-side mapping and confirmation/save flows remain. A clean matched extraction no longer renders an empty review panel; only warnings or unresolved mapping render that panel. The unused extracted-stats component and its table-specific CSS were deleted.

RED: npm test -- src/features/score-editing/match-editor.test.tsx produced two expected failures and 23 passes for the removed summary/table before implementation. GREEN: all 25 editor tests and all 97 unit/component tests pass. The four isolated desktop/mobile extraction/CODM browser cases pass, verifying every imported editable stat, swapping, absence of the duplicate copy/table, no overflow and accessibility scans. Typecheck, lint, formatting and production build pass. Desktop/mobile extraction screenshots were inspected. The legacy seeded-backend browser expectation now waits for the extraction response/read completion rather than the removed copy; that suite was not run without its dedicated backend fixture.

Current-phase authored changes:

- src/features/score-editing/match-editor.tsx — removes duplicate extraction presentation and hides the empty review wrapper while preserving warnings and mapping.
- src/features/score-editing/extracted-stats.tsx — deleted unused extracted-stat review table component.
- src/features/score-editing/match-editor.test.tsx — tests imported editable stats, swapping/touched replacement behavior and absence of removed presentation; replaces waits for deleted copy with actual field state.
- src/styles.css — removes unused extracted-stat table styles.
- e2e/extracted-stats.spec.ts — verifies all values directly in enabled editable stats instead of a duplicate table; retains score swapping, accessibility and screenshots.
- e2e/arena.spec.ts — waits for extraction HTTP completion and the re-enabled Read control instead of removed success text.
- docs/ORGANIZER_UX.md — records this phase and generated inventory.

Earlier uncommitted work is preserved. No other authored files were created/deleted/renamed. No backend, API contract, configuration, environment, dependency, database, account or deployment changes were made. No real result writes were submitted. Temporary Playwright preview servers stopped after verification. Build outputs, caches, reports and the six existing tournament-swap desktop/mobile controls/stats/CODM screenshot paths were regenerated; the failing unit-test log is listed below.

## Authored file changes

All paths below are relative to the independently deployable frontend repository, `/Users/macbook/study_materials/pfffffs/projects/Tournament/frontend`. The first phase started from a clean working tree; the second phase continues the same UI work. No unrelated user changes were overwritten. The original fixture-rounds and shared Modal changes were retained without further edits in phase two.

- `src/features/tournament-management/fixture-rounds.tsx` — new typed stage/round grouping, URL-driven selector, accessible collapsible round sections, completion counts, and deferred fixture rendering.
- `src/features/tournament-management/tournament-page.tsx` — integrates round navigation and the compact header, adds result-entry and fixture status shortcuts, uses the new standings/navigation components, and advances to returned unplayed fixtures after save.
- `src/features/tournament-management/tournament-page.test.tsx` — tests round/stage separation, filter reset, management actions, large rounds, entry/status shortcuts, qualification explanations, scoped advancement, returned revisions, and fresh-draft focus.
- `src/features/score-editing/match-editor.tsx` — persistent footer, collapsed optional scorecard import, numeric input mode, and failure-safe Save & next match with preserved correction intent; nested content was reindented.
- `src/shared/ui/primitives.tsx` — optional Modal className hook for feature-specific layout.
- `src/styles.css` — compact responsive header/metrics, management disclosure, sticky responsive navigation, readable standings with compact/full modes and qualification cutoff, status shortcuts, labeled touch targets, collapsed scorecard styling, and persistent score controls.
- `e2e/organizer-layout.spec.ts` — isolated desktop/mobile workflow, sticky navigation/More/Escape, compact/full standings and qualification guidance, keyboard, accessibility, overflow, long-name, and text-zoom browser checks; writes eight temporary screenshots.
- `e2e/arena.spec.ts` — updates legacy acceptance expectations for round rendering, management disclosure, mobile navigation/More, and collapsed upload.
- `src/features/tournament-management/standings-table.tsx` — new feature-owned standings presentation with provisional/confirmed guidance, cutoff labels, score definitions, and compact/full column control.
- `src/features/tournament-management/tournament-navigation.tsx` — new responsive sticky-navigation composition, breakpoint subscription, keyboard tabs, and mobile secondary-section disclosure.
- `src/features/score-editing/match-editor.test.tsx` — tests collapsed import, failed-save draft retention, successful advancement, pending lock, and duplicate-submit protection.
- `e2e/extracted-stats.spec.ts` — expands optional import before exercising the existing extraction workflow.
- `src/features/tournament-management/tournament-actions.tsx` — new title disclosure, expanded state, outside-click/Escape dismissal, dialog-aware focus handling, and grouped action container.
- `docs/ORGANIZER_UX.md` — design intent, changed contracts, verification evidence, limits, and complete change inventory.

## Generated files

Build/test commands regenerated these ignored outputs. The prior phase's generated files were replaced as needed. No dependency installation, configuration, environment, generated API contract, or backend source changes were made. Existing Vite dependency prebundles were not changed.

- `dist/_routes.json` — regenerated production build output.
- `dist/assets/Home-DNEGF_mC.js` — regenerated production build output.
- `dist/assets/auth-page-BuI16H5s.js` — regenerated production build output.
- `dist/assets/dashboard-page-_ELlujGs.js` — regenerated production build output.
- `dist/assets/index-Dh2lpRPi.js` — regenerated production build output.
- `dist/assets/index-FYw-Ijyi.css` — regenerated production build output.
- `dist/assets/match-editor-HCQV1vbG.js` — regenerated production build output.
- `dist/assets/pagination-DmyW7apa.js` — regenerated production build output.
- `dist/assets/public-page-1zyhQZj-.js` — regenerated production build output.
- `dist/assets/result-entry-B8h1vahJ.js` — regenerated production build output.
- `dist/assets/scan-line-x-ZtsCxZ.js` — regenerated production build output.
- `dist/assets/setup-draft-Cxo39GXD.js` — regenerated production build output.
- `dist/assets/setup-page-BbdRAGmv.js` — regenerated production build output.
- `dist/assets/swords-DV5D4WxV.js` — regenerated production build output.
- `dist/assets/tournament-page-BrABf9M0.js` — regenerated production build output.
- `dist/assets/useMutation-SUv4coNH.js` — regenerated production build output.
- `dist/assets/users-CAhnTzwP.js` — regenerated production build output.
- `dist/index.html` — regenerated production build output.
- `tsconfig.tsbuildinfo` — updated incremental TypeScript build metadata.
- `node_modules/.vite/vitest/da39a3ee5e6b4b0d3255bfef95601890afd80709/results.json` — updated Vitest result cache.
- `playwright-report/index.html` — regenerated browser test report.
- `test-results/.last-run.json` — updated browser run status.
- `/private/tmp/arena-ux-red.log` — focused failing-test output from phase two.
- `/private/tmp/arena-ux-focused.log` — focused regression-test output from phase two.
- `/private/tmp/arena-desktop-score-controls.png` — generated desktop score controls screenshot.
- `/private/tmp/arena-desktop-compact-fixtures.png` — generated desktop compact fixtures screenshot.
- `/private/tmp/arena-desktop-sticky-navigation.png` — generated desktop sticky navigation screenshot.
- `/private/tmp/arena-desktop-qualification-standings.png` — generated desktop qualification standings screenshot.
- `/private/tmp/tournament-swap/desktop-controls.png` — regenerated extraction/manual-entry regression screenshot.
- `/private/tmp/tournament-swap/desktop-stats.png` — regenerated extraction/manual-entry regression screenshot.
- `/private/tmp/tournament-swap/desktop-codm.png` — regenerated extraction/manual-entry regression screenshot.
- `/private/tmp/arena-mobile-score-controls.png` — generated mobile score controls screenshot.
- `/private/tmp/arena-mobile-compact-fixtures.png` — generated mobile compact fixtures screenshot.
- `/private/tmp/arena-mobile-sticky-navigation.png` — generated mobile sticky navigation screenshot.
- `/private/tmp/arena-mobile-qualification-standings.png` — generated mobile qualification standings screenshot.
- `/private/tmp/tournament-swap/mobile-controls.png` — regenerated extraction/manual-entry regression screenshot.
- `/private/tmp/tournament-swap/mobile-stats.png` — regenerated extraction/manual-entry regression screenshot.
- `/private/tmp/tournament-swap/mobile-codm.png` — regenerated extraction/manual-entry regression screenshot.


- `/private/tmp/arena-menu-red.log` — focused missing-menu failure output.
- `/private/tmp/arena-desktop-title-menu.png` — desktop title-menu verification screenshot.
- `/private/tmp/arena-mobile-title-menu.png` — mobile title-menu verification screenshot.

- `/private/tmp/arena-standings-red.log` — generated standings-first verification artifact.
- `/private/tmp/arena-standings-focused.log` — generated standings-first verification artifact.
- `/private/tmp/arena-desktop-standings-first.png` — generated standings-first verification artifact.
- `/private/tmp/arena-desktop-compact-zoom.png` — generated standings-first verification artifact.
- `/private/tmp/arena-desktop-result-picker.png` — generated standings-first verification artifact.
- `/private/tmp/arena-mobile-standings-first.png` — generated standings-first verification artifact.
- `/private/tmp/arena-mobile-compact-zoom.png` — generated standings-first verification artifact.
- `/private/tmp/arena-mobile-result-picker.png` — generated standings-first verification artifact.

- `/private/tmp/arena-simplify-red.log` — generated simplified-tabs verification artifact.
- `/private/tmp/arena-simplify-table-red.log` — generated simplified-tabs verification artifact.
- `/private/tmp/arena-simplify-focused.log` — generated simplified-tabs verification artifact.
- `/private/tmp/arena-simplify-build-before.json` — generated simplified-tabs verification artifact.
- `/private/tmp/arena-simplify-build-intermediate.json` — generated simplified-tabs verification artifact.
- `/private/tmp/arena-desktop-standings-header-zoom.png` — generated simplified-tabs verification artifact.
- `/private/tmp/arena-mobile-standings-header-zoom.png` — generated simplified-tabs verification artifact.

- `/private/tmp/arena-compact-editor-red.log` — generated compact-editor verification artifact.
- `/private/tmp/arena-compact-editor-focused.log` — generated compact-editor verification artifact.
- `/private/tmp/arena-desktop-mirrored-editor.png` — generated compact-editor verification artifact.
- `/private/tmp/arena-desktop-mirrored-editor-zoom.png` — generated compact-editor verification artifact.
- `/private/tmp/arena-mobile-mirrored-editor.png` — generated compact-editor verification artifact.
- `/private/tmp/arena-mobile-mirrored-editor-zoom.png` — generated compact-editor verification artifact.

- `/private/tmp/arena-remove-extraction-review-red.log` — expected failing extraction-review regression output.

Earlier hashed build outputs replaced by the current build:

- `dist/assets/Home-DkbDUgwE.js` — replaced by the extraction-review removal build.
- `dist/assets/auth-page-BWAfTRGZ.js` — replaced by the extraction-review removal build.
- `dist/assets/dashboard-page-DJOC_i38.js` — replaced by the extraction-review removal build.
- `dist/assets/index-BgTSWPtq.js` — replaced by the extraction-review removal build.
- `dist/assets/index-CG7RbszJ.css` — replaced by the extraction-review removal build.
- `dist/assets/match-editor-CZR_afQH.js` — replaced by the extraction-review removal build.
- `dist/assets/pagination-C8dxBhFf.js` — replaced by the extraction-review removal build.
- `dist/assets/public-page-Bi5ABxFt.js` — replaced by the extraction-review removal build.
- `dist/assets/result-entry-d_qmxW4Q.js` — replaced by the extraction-review removal build.
- `dist/assets/scan-line-rwERseGO.js` — replaced by the extraction-review removal build.
- `dist/assets/setup-draft-CY7z4j4p.js` — replaced by the extraction-review removal build.
- `dist/assets/setup-page-DiSkXU6s.js` — replaced by the extraction-review removal build.
- `dist/assets/swords-HcbRb6DH.js` — replaced by the extraction-review removal build.
- `dist/assets/tournament-page-DzLnoDv1.js` — replaced by the extraction-review removal build.
- `dist/assets/useMutation-SAS9Rjyq.js` — replaced by the extraction-review removal build.
- `dist/assets/users-iHlkR0gv.js` — replaced by the extraction-review removal build.
- `dist/assets/Home-ar7m1c2Z.js` — replaced by the compact-editor production build.
- `dist/assets/auth-page-CAKQ2wpu.js` — replaced by the compact-editor production build.
- `dist/assets/dashboard-page-CimBTEKa.js` — replaced by the compact-editor production build.
- `dist/assets/index-BOb7OYle.css` — replaced by the compact-editor production build.
- `dist/assets/index-C7UnH1Qm.js` — replaced by the compact-editor production build.
- `dist/assets/match-editor-w_gBAeau.js` — replaced by the compact-editor production build.
- `dist/assets/pagination-CsDYWJWz.js` — replaced by the compact-editor production build.
- `dist/assets/public-page-DCWTzCEb.js` — replaced by the compact-editor production build.
- `dist/assets/result-entry-BNvIpC8R.js` — replaced by the compact-editor production build.
- `dist/assets/scan-line-B_QlaTKV.js` — replaced by the compact-editor production build.
- `dist/assets/setup-draft-Bhw7X0Ib.js` — replaced by the compact-editor production build.
- `dist/assets/setup-page-7MGCu3xN.js` — replaced by the compact-editor production build.
- `dist/assets/swords-go-T965J.js` — replaced by the compact-editor production build.
- `dist/assets/tournament-page-x8RlWZ-v.js` — replaced by the compact-editor production build.
- `dist/assets/useMutation-CLfTiVjo.js` — replaced by the compact-editor production build.
- `dist/assets/users-CFJGKKub.js` — replaced by the compact-editor production build.
- `dist/assets/Home-BISb-Mys.js` — replaced by the reduced-header production build.
- `dist/assets/auth-page-Cv9Wg5JF.js` — replaced by the reduced-header production build.
- `dist/assets/dashboard-page-BiQ6NmRl.js` — replaced by the reduced-header production build.
- `dist/assets/index-B-NpIQVv.css` — replaced by the reduced-header production build.
- `dist/assets/index-CfXDctbR.js` — replaced by the reduced-header production build.
- `dist/assets/match-editor-TkNZsRAY.js` — replaced by the reduced-header production build.
- `dist/assets/pagination-DomQhGDq.js` — replaced by the reduced-header production build.
- `dist/assets/public-page-DyNW3CKU.js` — replaced by the reduced-header production build.
- `dist/assets/result-entry-F5se0Cr5.js` — replaced by the reduced-header production build.
- `dist/assets/scan-line-BfZgbtY3.js` — replaced by the reduced-header production build.
- `dist/assets/setup-draft-Jace1Coc.js` — replaced by the reduced-header production build.
- `dist/assets/setup-page-BJbsRva6.js` — replaced by the reduced-header production build.
- `dist/assets/swords-DUUz6YoY.js` — replaced by the reduced-header production build.
- `dist/assets/tournament-page-CfPH3Alp.js` — replaced by the reduced-header production build.
- `dist/assets/useMutation-CRtMuVxH.js` — replaced by the reduced-header production build.
- `dist/assets/users-BmoVkM1z.js` — replaced by the reduced-header production build.
- `dist/assets/Home-CER9kRva.js` — replaced by the simplified-tabs production build.
- `dist/assets/auth-page-CnWfIbY3.js` — replaced by the simplified-tabs production build.
- `dist/assets/dashboard-page-DG9y7t_T.js` — replaced by the simplified-tabs production build.
- `dist/assets/index-CkUxWpMx.css` — replaced by the simplified-tabs production build.
- `dist/assets/index-JTKkhYMY.js` — replaced by the simplified-tabs production build.
- `dist/assets/match-editor-CJgLj5xn.js` — replaced by the simplified-tabs production build.
- `dist/assets/pagination-CFhcu9i5.js` — replaced by the simplified-tabs production build.
- `dist/assets/public-page-CfgsXwxk.js` — replaced by the simplified-tabs production build.
- `dist/assets/result-entry-CnhMbNK6.js` — replaced by the simplified-tabs production build.
- `dist/assets/scan-line-G4CsLbt3.js` — replaced by the simplified-tabs production build.
- `dist/assets/setup-draft-BtsffkyQ.js` — replaced by the simplified-tabs production build.
- `dist/assets/setup-page-D8XB58eN.js` — replaced by the simplified-tabs production build.
- `dist/assets/swords-B7fsbxHN.js` — replaced by the simplified-tabs production build.
- `dist/assets/tournament-page-DOVgvtEY.js` — replaced by the simplified-tabs production build.
- `dist/assets/useMutation-BydWrpsS.js` — replaced by the simplified-tabs production build.
- `dist/assets/users-Dww8lU7v.js` — replaced by the simplified-tabs production build.
- `dist/assets/Home-Ccqe7yV3.js` — replaced by the simplified-tabs production build.
- `dist/assets/auth-page-Be1VhKhk.js` — replaced by the simplified-tabs production build.
- `dist/assets/dashboard-page-u3KiS-2m.js` — replaced by the simplified-tabs production build.
- `dist/assets/index-UJ63eAn9.js` — replaced by the simplified-tabs production build.
- `dist/assets/index-UbAtpNZD.css` — replaced by the simplified-tabs production build.
- `dist/assets/match-editor-Bu3zqPUL.js` — replaced by the simplified-tabs production build.
- `dist/assets/pagination-TMMHw9t8.js` — replaced by the simplified-tabs production build.
- `dist/assets/public-page-DXJ91vYj.js` — replaced by the simplified-tabs production build.
- `dist/assets/result-entry-B0fBxyJ5.js` — replaced by the simplified-tabs production build.
- `dist/assets/scan-line-Bz1wgG1r.js` — replaced by the simplified-tabs production build.
- `dist/assets/setup-draft-DHcPyiIa.js` — replaced by the simplified-tabs production build.
- `dist/assets/setup-page-j8qgmRW4.js` — replaced by the simplified-tabs production build.
- `dist/assets/swords-DCu6Y7G4.js` — replaced by the simplified-tabs production build.
- `dist/assets/tournament-page-DbhD4m15.js` — replaced by the simplified-tabs production build.
- `dist/assets/useMutation-M5XinLoS.js` — replaced by the simplified-tabs production build.
- `dist/assets/users-De1xiC2L.js` — replaced by the simplified-tabs production build.
- `dist/assets/Home-8CNCCyJP.js` — replaced by the standings-first production build.
- `dist/assets/arrow-up-right-B779EfIB.js` — replaced by the standings-first production build.
- `dist/assets/auth-page-GEsgVDNK.js` — replaced by the standings-first production build.
- `dist/assets/dashboard-page-BrpUVWID.js` — replaced by the standings-first production build.
- `dist/assets/index-2EwAd8cD.js` — replaced by the standings-first production build.
- `dist/assets/index-BaDeLBAe.css` — replaced by the standings-first production build.
- `dist/assets/match-editor-C6i3BC2D.js` — replaced by the standings-first production build.
- `dist/assets/pagination-bUjyqPel.js` — replaced by the standings-first production build.
- `dist/assets/plus-9y75HLsl.js` — replaced by the standings-first production build.
- `dist/assets/public-page-R-DUha0H.js` — replaced by the standings-first production build.
- `dist/assets/scan-line-SMVjC8og.js` — replaced by the standings-first production build.
- `dist/assets/setup-draft-L1KDtVkd.js` — replaced by the standings-first production build.
- `dist/assets/setup-page-BwopnsYg.js` — replaced by the standings-first production build.
- `dist/assets/shield-check-OlM8oXdu.js` — replaced by the standings-first production build.
- `dist/assets/tournament-page-1ebVErK5.js` — replaced by the standings-first production build.
- `dist/assets/useMutation-C4NlpjyW.js` — replaced by the standings-first production build.
- `dist/assets/users-B0i7RQs5.js` — replaced by the standings-first production build.
- `dist/assets/` — removed automatically when regenerating `dist/`.
- `dist/assets/Home-CVVOAeMe.js` — removed automatically when regenerating `dist/`.
- `dist/assets/Home-DUVAKg0C.js` — removed automatically when regenerating `dist/`.
- `dist/assets/arrow-up-right-DI6L1u5L.js` — removed automatically when regenerating `dist/`.
- `dist/assets/arrow-up-right-gg4P6-L8.js` — removed automatically when regenerating `dist/`.
- `dist/assets/auth-page-3h2ia1qT.js` — removed automatically when regenerating `dist/`.
- `dist/assets/auth-page-BEQ573P1.js` — removed automatically when regenerating `dist/`.
- `dist/assets/dashboard-page-BPns7iDm.js` — removed automatically when regenerating `dist/`.
- `dist/assets/dashboard-page-D75cOstK.js` — removed automatically when regenerating `dist/`.
- `dist/assets/index-Btv2JdGx.js` — removed automatically when regenerating `dist/`.
- `dist/assets/index-C1Ldl13N.css` — removed automatically when regenerating `dist/`.
- `dist/assets/index-CWJygBdF.js` — removed automatically when regenerating `dist/`.
- `dist/assets/index-CmOxj6gX.css` — removed automatically when regenerating `dist/`.
- `dist/assets/match-editor-BmWF9fWw.js` — removed automatically when regenerating `dist/`.
- `dist/assets/match-editor-D8wOGtXI.js` — removed automatically when regenerating `dist/`.
- `dist/assets/pagination-DbaAGEQv.js` — removed automatically when regenerating `dist/`.
- `dist/assets/pagination-DgHxGi95.js` — removed automatically when regenerating `dist/`.
- `dist/assets/plus-Dh9H0eMX.js` — removed automatically when regenerating `dist/`.
- `dist/assets/plus-uDgVbT-l.js` — removed automatically when regenerating `dist/`.
- `dist/assets/public-page-BU8faZ0S.js` — removed automatically when regenerating `dist/`.
- `dist/assets/public-page-BjiSC91h.js` — removed automatically when regenerating `dist/`.
- `dist/assets/scan-line-QQToZrAe.js` — removed automatically when regenerating `dist/`.
- `dist/assets/scan-line-xa4hI_2i.js` — removed automatically when regenerating `dist/`.
- `dist/assets/setup-draft-B_Svit-9.js` — removed automatically when regenerating `dist/`.
- `dist/assets/setup-draft-Bk4y4PoH.js` — removed automatically when regenerating `dist/`.
- `dist/assets/setup-page-AZKCm6tL.js` — removed automatically when regenerating `dist/`.
- `dist/assets/setup-page-DcKijg9g.js` — removed automatically when regenerating `dist/`.
- `dist/assets/shield-check-Bcfqo1qO.js` — removed automatically when regenerating `dist/`.
- `dist/assets/shield-check-DbWtlQw3.js` — removed automatically when regenerating `dist/`.
- `dist/assets/tournament-page-BHIv0qD4.js` — removed automatically when regenerating `dist/`.
- `dist/assets/tournament-page-Ds5XS4tI.js` — removed automatically when regenerating `dist/`.
- `dist/assets/useMutation-DxFeHZrq.js` — removed automatically when regenerating `dist/`.
- `dist/assets/useMutation-QvlaQDoH.js` — removed automatically when regenerating `dist/`.
- `dist/assets/users-CHQ5IlXq.js` — removed automatically when regenerating `dist/`.
- `dist/assets/users-DUFxi5jo.js` — removed automatically when regenerating `dist/`.



Earlier failing browser runs created diagnostics that Playwright removed when replacing run results:

- `test-results/organizer-layout-score-sav-2ba5e-hile-optional-fields-scroll-desktop/test-failed-1.png` — temporary failure diagnostic, subsequently removed.
- `test-results/organizer-layout-score-sav-2ba5e-hile-optional-fields-scroll-desktop/error-context.md` — temporary failure diagnostic, subsequently removed.
- `test-results/organizer-layout-score-sav-2ba5e-hile-optional-fields-scroll-desktop/trace.zip` — temporary failure diagnostic, subsequently removed.
- `test-results/organizer-layout-score-sav-2ba5e-hile-optional-fields-scroll-mobile/test-failed-1.png` — temporary failure diagnostic, subsequently removed.
- `test-results/organizer-layout-score-sav-2ba5e-hile-optional-fields-scroll-mobile/error-context.md` — temporary failure diagnostic, subsequently removed.
- `test-results/organizer-layout-score-sav-2ba5e-hile-optional-fields-scroll-mobile/trace.zip` — temporary failure diagnostic, subsequently removed.
- `test-results/organizer-layout-tournamen-ce76e-ary-sections-work-on-phones-desktop/test-failed-1.png` — temporary failure diagnostic, subsequently removed.
- `test-results/organizer-layout-tournamen-ce76e-ary-sections-work-on-phones-desktop/error-context.md` — temporary failure diagnostic, subsequently removed.
- `test-results/organizer-layout-tournamen-ce76e-ary-sections-work-on-phones-desktop/trace.zip` — temporary failure diagnostic, subsequently removed.

- `test-results/standings-first-standings--2eece--with-inline-title-controls-mobile/test-failed-1.png` — temporary red-run diagnostic, removed by the successful browser run.
- `test-results/standings-first-standings--2eece--with-inline-title-controls-mobile/error-context.md` — temporary red-run diagnostic, removed by the successful browser run.
- `test-results/standings-first-standings--2eece--with-inline-title-controls-mobile/trace.zip` — temporary red-run diagnostic, removed by the successful browser run.
- `test-results/standings-first-informatio-18f9e-d-text-zoom-stay-accessible-mobile/test-failed-1.png` — temporary red-run diagnostic, removed by the successful browser run.
- `test-results/standings-first-informatio-18f9e-d-text-zoom-stay-accessible-mobile/error-context.md` — temporary red-run diagnostic, removed by the successful browser run.
- `test-results/standings-first-informatio-18f9e-d-text-zoom-stay-accessible-mobile/trace.zip` — temporary red-run diagnostic, removed by the successful browser run.

- `test-results/organizer-layout-standings-0d1b7-tion-explanations-available-mobile/test-failed-1.png` — generated by the compact-header red run and removed by the green run.
- `test-results/organizer-layout-standings-0d1b7-tion-explanations-available-mobile/error-context.md` — generated by the compact-header red run and removed by the green run.
- `test-results/organizer-layout-standings-0d1b7-tion-explanations-available-mobile/trace.zip` — generated by the compact-header red run and removed by the green run.

Successive builds also replaced intermediate hashed outputs under `dist/assets/`; the list above records final retained outputs and replacements from the previous phase. The extraction-review removal phase deletes src/features/score-editing/extracted-stats.tsx as listed above; no other authored files were deleted or renamed.
