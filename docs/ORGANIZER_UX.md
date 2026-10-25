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

## Team comparisons and compact action menu (earlier uncommitted work)

The frontend checkout was clean before this change. All files listed in this section belong to this task; earlier sections describe already committed work.

Team stats now starts with the first alphabetical team with recorded stats (or the first team when none have records). Team and Compare with selectors support ordered comparisons of any number of teams, prevent duplicates, and provide removable chips. Removing the primary team promotes the next selection; removing all teams shows a prompt. Initial and deliberate selections persist through tab changes and refreshes, and reset on a different tournament. One team uses Stat / Value, while every comparison uses Stat / team columns, including two-team comparisons. Thirteen canonical rows match values by stat key, preserving totals, average possession, percentages, zeros, missing-value dashes and recorded/played match coverage. The table scrolls locally with sticky stat names and wrapping headings. Loading, retryable errors, no teams, no recorded stats, and no selection have explicit states. Existing typed API calls and aggregation are unchanged.

The tournament action panel now fits its longest title (up to 280px and viewport width), with 6px padding, no row gaps or card borders, and consistent 14px/600 typography, 18px icons and 44px minimum targets. Edit, add, enable/archive, share and public-page actions retain their order, permissions and behavior. Public page is a native new-tab link with noopener/noreferrer and an accessible announcement. Nested dialog dismissal retains the open menu and restores the originating item; Escape then dismisses the menu and restores its trigger.

Authored inventory for this task:

- `src/features/tournament-management/team-stats-panel.tsx` — new feature-owned selector, chips, canonical stat table, formatting, retained selection and load/error/empty presentation.
- `src/features/tournament-management/team-stats-panel.test.tsx` — new behavior tests for initial/fallback selection, comparison layout, seven teams, duplicates, primary promotion, removal, owner/public permissions, tab retention, tournament reset, reordered/refreshed values, loading, retry and empty states.
- `src/features/tournament-management/tournament-page.tsx` — mounts the keyed comparison component across tabs, adds enable/archive icons, and makes Public page an accessible native new-tab link using ArrowUpRight.
- `src/features/tournament-management/tournament-page.test.tsx` — asserts new-tab target, security relationship and accessible link text.
- `src/features/tournament-management/tournament-tools.tsx` — adds Pencil/UserPlus icons to existing name/team actions.
- `src/styles.css` — compact consistent action rows; responsive selectors/chips, sticky stat cells, wrapping headings and local comparison scrolling.
- `e2e/team-stats.spec.ts` — new isolated desktop/mobile comparison, menu styling/icon geometry, nested-dialog focus, keyboard new-tab navigation, owner/public permissions, enable action, accessibility, overflow and enlarged-text checks; writes ten screenshots.
- `e2e/arena.spec.ts` — updates legacy acceptance navigation for standings-first tabs and follows the new public-page popup. This backend-seeded suite was updated but was not run in this isolated frontend verification.
- `docs/ORGANIZER_UX.md` — records behavior, validation, scope and complete authored/generated artifact inventory.

Verification: behavior tests first failed on missing selection/comparison/retry controls and new-tab attributes. All 104 unit/component tests, 3 tooling tests, typecheck, lint, formatting and production build pass. All 34 isolated desktop/mobile browser tests pass; the six new comparison/menu checks also pass after the final responsive width adjustment. The final 200% mobile check requires the sticky stat-name column to use less than 55% of the table viewport, leaving room for values. Screenshots use 375×812 mobile and 1440×900 desktop for comparisons, and include seven teams, long names and 200% text zoom. Tests use mocked API responses; no real tournament records were changed. Temporary production preview servers were started and stopped by Playwright. No backend, API, dependencies, configuration, environment, database or URL contracts changed.

## Compact comparisons and adaptive tabs (current change)

Design: retain Arena's dark olive palette and lime selection accents, with denser 13px table text, 12px panel padding, 8px/6px table cells and visible shared row dividers. Single-team headings now show the complete team name. Coverage appears inline as value · recorded/played, with full accessible descriptions. A compact Stats information hint replaces the guide paragraph. Selectors share a row when each has 9rem available; text zoom reflows them. Two short team columns fit beside stat names at 375px. More teams scroll locally, and the sticky stat column stays within 40% of the table viewport using container-relative sizing.

Selected-team chips are approximately 32px high. Their labels use the first word capped at eight Unicode code points, with an ellipsis whenever any name text is omitted. Names and removal are separate controls: the shortened name opens a full-name hint through hover, focus or touch, while Remove uses the complete accessible team name. Escape and outside interactions dismiss hints. IDs continue to distinguish equal shortened labels. The information control shares the compact selection row rather than adding a full extra toolbar row.

Navigation measures hidden noninteractive label spans and the available container through ResizeObserver, font readiness/loading and window resizing. It fits a prefix of complete tabs while reserving More only when necessary; the active section replaces the last fitting inactive section. More no longer repeats the active title and uses a compact chevron trigger with an intrinsic-width, viewport-capped menu. All tabs appear when they fit. Visible tab order, existing URLs, defaults, owner/public permissions and section availability remain unchanged. Menu items use radio selection semantics and support arrows, Home/End, Enter/Space, Tab, Escape and outside dismissal. Selecting a menu item waits for the route to activate before focusing its promoted tab. Resize focus follows the same section when possible, otherwise More/the active tab. At extreme text zoom a lone long active label wraps completely instead of clipping. Screenshot review also found the existing skip link used a fixed offscreen offset that leaked at enlarged text sizes; height-relative hiding now keeps it offscreen until focused, with a browser regression for both states.

Baseline: this task started with the prior comparison/menu work already uncommitted. Earlier changes in tournament-page.tsx, tournament-page.test.tsx, tournament-tools.tsx and e2e/arena.spec.ts were left untouched in this task. Existing uncommitted comparison files, styles and documentation were extended without reverting earlier work.

Authored files changed in this task:

- `src/features/tournament-management/team-stats-panel.tsx` — compact name hints and chip labels, accessible inline coverage, team-name headings and condensed information/selection controls.
- `src/features/tournament-management/team-stats-panel.test.tsx` — updated headings/coverage expectations; new duplicate-label, truncation, full-name hint, removal and information-hint tests.
- `src/features/tournament-management/tournament-navigation.tsx` — replaces breakpoint grouping with measured tab fitting, active promotion, compact overflow menu, responsive focus recovery and asynchronous route focus handling.
- `src/features/tournament-management/tournament-navigation.test.tsx` — new measured-layout behavior tests for fitting counts, resizing, promotion, keyboard/outside dismissal, delayed route activation and public knockout-only section availability.
- `src/styles.css` — compact chips/selectors/information row, full-width cell separators, inline coverage, local table scrolling, container-sized sticky column, matched tab measurement styles and compact overflow menu; removes superseded breakpoint tab styling and fixes enlarged-text skip-link hiding.
- `e2e/team-stats.spec.ts` — updates expected headings and menu semantics; adds two-team geometry/separator checks, chip/help accessibility and dynamic 320/375/480/640/900/1440px navigation plus 200% text zoom screenshots.
- `e2e/organizer-layout.spec.ts` — uses the new overflow menu-item semantics in existing mobile navigation coverage.
- `docs/ORGANIZER_UX.md` — records this phase's design, intentional behavior changes, baseline distinction, tests and full artifact inventory.

Executed red checks: team-stats-panel.test.tsx had three expected missing-behavior failures, and tournament-navigation.test.tsx had two expected adaptive-navigation failures before production implementation. The focused tests then passed. An additional browser red check reproduced the enlarged-text skip-link leak before the CSS fix. All 110 unit/component tests, all 38 isolated desktop/mobile browser tests, all 3 tooling tests, typecheck, lint, formatting and the production build pass. Screenshots were inspected for compact two-team and seven-team comparisons, horizontal scrolling, complete separators, active tab visibility, intermediate widths and 200% text zoom. The final browser checks also verify the hidden skip link stays outside the viewport until keyboard focus. Browser fixtures mock the API; no real tournament data was changed. Playwright starts/stops temporary production preview servers. No backend, API, generated contracts, dependencies, configuration, environment, database or URL contract changes were made.

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
- `dist/assets/Home-DtpnC2mA.js` — regenerated production build output.
- `dist/assets/auth-page-BvKnEpc3.js` — regenerated production build output.
- `dist/assets/dashboard-page-KL6jHE4h.js` — regenerated production build output.
- `dist/assets/index-CLKCju5F.css` — regenerated production build output.
- `dist/assets/index-LnQZprvH.js` — regenerated production build output.
- `dist/assets/match-editor-B7dOIo7w.js` — regenerated production build output.
- `dist/assets/pagination-acvrK-Cw.js` — regenerated production build output.
- `dist/assets/public-page-B6EL-KfQ.js` — regenerated production build output.
- `dist/assets/result-entry-J-dc7ds5.js` — regenerated production build output.
- `dist/assets/scan-line-ic6Fs0fS.js` — regenerated production build output.
- `dist/assets/setup-draft-Cmd2Yg-J.js` — regenerated production build output.
- `dist/assets/setup-page-pzyiaGak.js` — regenerated production build output.
- `dist/assets/swords-CH4nl9xO.js` — regenerated production build output.
- `dist/assets/tournament-page-BxfyiWPu.js` — regenerated production build output.
- `dist/assets/useMutation-D6GzBCqI.js` — regenerated production build output.
- `dist/assets/users-C60dfCnm.js` — regenerated production build output.
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


Earlier comparison/menu task generated artifacts (temporary paths use the canonical `/private/tmp` location):

- `/private/tmp/arena-desktop-compact-menu-zoom.png` — verification screenshot.
- `/private/tmp/arena-desktop-compact-menu.png` — verification screenshot.
- `/private/tmp/arena-desktop-team-stats-comparison.png` — verification screenshot.
- `/private/tmp/arena-desktop-team-stats-single.png` — verification screenshot.
- `/private/tmp/arena-desktop-team-stats-zoom.png` — verification screenshot.
- `/private/tmp/arena-frontend-rules-read.txt` — verification log or read-only verification inventory.
- `/private/tmp/arena-mobile-compact-menu-zoom.png` — verification screenshot.
- `/private/tmp/arena-mobile-compact-menu.png` — verification screenshot.
- `/private/tmp/arena-mobile-team-stats-comparison.png` — verification screenshot.
- `/private/tmp/arena-mobile-team-stats-single.png` — verification screenshot.
- `/private/tmp/arena-mobile-team-stats-zoom.png` — verification screenshot.
- `/private/tmp/arena-team-stats-browser-final.log` — verification log or read-only verification inventory.
- `/private/tmp/arena-team-stats-browser-green.log` — verification log or read-only verification inventory.
- `/private/tmp/arena-team-stats-browser.log` — verification log or read-only verification inventory.
- `/private/tmp/arena-team-stats-focused.log` — verification log or read-only verification inventory.
- `/private/tmp/arena-team-stats-format.log` — verification log or read-only verification inventory.
- `/private/tmp/arena-team-stats-intermediate-artifacts.json` — verification log or read-only verification inventory.
- `/private/tmp/arena-team-stats-lint.log` — verification log or read-only verification inventory.
- `/private/tmp/arena-team-stats-red.log` — verification log or read-only verification inventory.
- `/private/tmp/arena-team-stats-tooling.log` — verification log or read-only verification inventory.
- `/private/tmp/arena-team-stats-typecheck.log` — verification log or read-only verification inventory.
- `/private/tmp/arena-team-stats-unit.log` — verification log or read-only verification inventory.

Earlier comparison/menu task intermediate outputs and failed-browser diagnostics:

- `dist/assets/Home-CDf1xED7.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/Home-DNEGF_mC.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/Home-d5hy2edB.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/auth-page-BAt7QlK4.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/auth-page-BCUqBnOU.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/auth-page-BuI16H5s.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/dashboard-page-Cleyyk5O.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/dashboard-page-CurpgX0E.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/dashboard-page-_ELlujGs.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/index-B8iZ8Nha.css` — replaced/removed by the final production build or passing browser run.
- `dist/assets/index-CRruEHub.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/index-DbtGoLmt.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/index-Dh2lpRPi.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/index-FYw-Ijyi.css` — replaced/removed by the final production build or passing browser run.
- `dist/assets/match-editor-BrDidtXa.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/match-editor-DwPhpMwS.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/match-editor-HCQV1vbG.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/pagination--wpkfzTV.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/pagination-CKu3KwyW.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/pagination-DmyW7apa.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/public-page-1zyhQZj-.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/public-page-DCwEBU5g.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/public-page-rb7-PUJb.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/result-entry-B8h1vahJ.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/result-entry-BVYvBXfT.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/result-entry-D-6GNkLO.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/scan-line-11bPl4Ih.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/scan-line-D54H52lV.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/scan-line-x-ZtsCxZ.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/setup-draft-B1_sx-qP.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/setup-draft-Cxo39GXD.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/setup-draft-DGOnhRiZ.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/setup-page-B6Hpcgar.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/setup-page-BbdRAGmv.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/setup-page-hZp4YIXB.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/swords-CA-BMeRi.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/swords-DV5D4WxV.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/swords-DhZLoR3w.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/tournament-page-BrABf9M0.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/tournament-page-CL6LtjdO.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/tournament-page-DjxkmGco.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/useMutation-BEqn6hpw.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/useMutation-CSD0YgD9.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/useMutation-SUv4coNH.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/users-BnOKwVn8.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/users-CAhnTzwP.js` — replaced/removed by the final production build or passing browser run.
- `dist/assets/users-D2G2Mg94.js` — replaced/removed by the final production build or passing browser run.
- `playwright-report/data/03aa746b5d40ba22511aa41f9e07464a9e6095df.zip` — replaced/removed by the final production build or passing browser run.
- `playwright-report/data/13e8c3fbe3920d7d768505bf21497a3a30272c90.png` — replaced/removed by the final production build or passing browser run.
- `playwright-report/data/356147a645f00242547acfc5aa0d2c4c345465a1.png` — replaced/removed by the final production build or passing browser run.
- `playwright-report/data/5fc3336635cc89efbabfd378426be39f093f40ac.md` — replaced/removed by the final production build or passing browser run.
- `playwright-report/data/84b676be1f98ec25fb53095a7981a8d6926ceb19.md` — replaced/removed by the final production build or passing browser run.
- `playwright-report/data/87b1f8a2d556325030c5eff0c18ed1fcf7fc52c0.md` — replaced/removed by the final production build or passing browser run.
- `playwright-report/data/cbda0e6b67e0696efb6c4a8a7ba3519d6cd2f872.png` — replaced/removed by the final production build or passing browser run.
- `playwright-report/data/eebd41be89f43beeeaa41b76a57de3b952a7c8bf.zip` — replaced/removed by the final production build or passing browser run.
- `playwright-report/data/f1f5debe7ad8a316a3e367c3ee6b5635a2100071.zip` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/assets/codeMirrorModule-BEB2e8M3.js` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/assets/defaultSettingsView-D-g2vrvf.js` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/assets/urlMatch-L3liM589.js` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/codeMirrorModule.-QdMvsKi.css` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/codicon.DCmgc-ay.ttf` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/defaultSettingsView.C8BeHuxd.css` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/index.7-c5LSTW.js` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/index.B_TqY17P.css` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/index.html` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/manifest.webmanifest` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/playwright-logo.svg` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/snapshot.B_Jk1wbt.js` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/snapshot.html` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/sw.bundle.js` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/uiMode.CYwC_gH1.js` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/uiMode.CyMfwkXJ.css` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/uiMode.html` — replaced/removed by the final production build or passing browser run.
- `playwright-report/trace/xtermModule.kHJ-D0s7.css` — replaced/removed by the final production build or passing browser run.
- `test-results/team-stats-compact-menu-ro-1ba88-blic-link-opens-another-tab-desktop/error-context.md` — replaced/removed by the final production build or passing browser run.
- `test-results/team-stats-compact-menu-ro-1ba88-blic-link-opens-another-tab-desktop/test-failed-1.png` — replaced/removed by the final production build or passing browser run.
- `test-results/team-stats-compact-menu-ro-1ba88-blic-link-opens-another-tab-desktop/trace.zip` — replaced/removed by the final production build or passing browser run.
- `test-results/team-stats-compact-menu-ro-1ba88-blic-link-opens-another-tab-mobile/error-context.md` — replaced/removed by the final production build or passing browser run.
- `test-results/team-stats-compact-menu-ro-1ba88-blic-link-opens-another-tab-mobile/test-failed-1.png` — replaced/removed by the final production build or passing browser run.
- `test-results/team-stats-compact-menu-ro-1ba88-blic-link-opens-another-tab-mobile/trace.zip` — replaced/removed by the final production build or passing browser run.
- `test-results/team-stats-team-selections-7c0da-cally-and-wrap-at-text-zoom-mobile/error-context.md` — replaced/removed by the final production build or passing browser run.
- `test-results/team-stats-team-selections-7c0da-cally-and-wrap-at-text-zoom-mobile/test-failed-1.png` — replaced/removed by the final production build or passing browser run.
- `test-results/team-stats-team-selections-7c0da-cally-and-wrap-at-text-zoom-mobile/trace.zip` — replaced/removed by the final production build or passing browser run.


## Compact comparisons/adaptive tabs artifact inventory

The authored inventory is recorded in the current-change section above. This phase regenerated the production files listed in Generated files, tsconfig.tsbuildinfo, the Vitest result cache, playwright-report/index.html and test-results/.last-run.json. Existing screenshot paths listed earlier were refreshed by organizer, standings, scorecard and comparison regressions. Playwright replaced temporary per-run diagnostic attachments under playwright-report/data/ and test-results/; captured file paths removed during these runs are listed below. Vite also creates and removes temporary bundled configuration files under node_modules/.vite-temp/ while running checks. No dependency prebundles, settings or environment files were edited.

New verification logs, inventories and screenshots in this phase:

- `/private/tmp/arena-adaptive-tabs-focused.log` — verification log or artifact inventory.
- `/private/tmp/arena-adaptive-tabs-red.log` — verification log or artifact inventory.
- `/private/tmp/arena-desktop-adaptive-tabs-zoom.png` — new screenshot.
- `/private/tmp/arena-desktop-adaptive-tabs.png` — new screenshot.
- `/private/tmp/arena-desktop-compact-comparison.png` — new screenshot.
- `/private/tmp/arena-mobile-adaptive-tabs-zoom.png` — new screenshot.
- `/private/tmp/arena-mobile-adaptive-tabs.png` — new screenshot.
- `/private/tmp/arena-mobile-compact-baseline.json` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-browser-complete.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-browser-diagnostic.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-browser-final.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-browser-green.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-browser.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-comparison.png` — new screenshot.
- `/private/tmp/arena-mobile-compact-fixtures.png` — new screenshot.
- `/private/tmp/arena-mobile-compact-focused.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-format.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-intermediate-artifacts.json` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-lint.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-menu-zoom.png` — new screenshot.
- `/private/tmp/arena-mobile-compact-menu.png` — new screenshot.
- `/private/tmp/arena-mobile-compact-red.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-skip-link-red.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-tooling.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-typecheck.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-unit.log` — verification log or artifact inventory.
- `/private/tmp/arena-mobile-compact-zoom.png` — new screenshot.

Captured build/report files replaced or removed in this phase:

- `dist/assets/Home-BEH-x_bm.js` — replaced or removed by a later production build/browser run.
- `dist/assets/Home-Cb31SCX9.js` — replaced or removed by a later production build/browser run.
- `dist/assets/Home-cHUxPbeW.js` — replaced or removed by a later production build/browser run.
- `dist/assets/Home-yVVDnUJK.js` — replaced or removed by a later production build/browser run.
- `dist/assets/auth-page-BT5zOkPf.js` — replaced or removed by a later production build/browser run.
- `dist/assets/auth-page-B_p4vX76.js` — replaced or removed by a later production build/browser run.
- `dist/assets/auth-page-CrQ6QmhS.js` — replaced or removed by a later production build/browser run.
- `dist/assets/auth-page-DIJcQYaN.js` — replaced or removed by a later production build/browser run.
- `dist/assets/dashboard-page-B4ZQRh_S.js` — replaced or removed by a later production build/browser run.
- `dist/assets/dashboard-page-BLr0YvBq.js` — replaced or removed by a later production build/browser run.
- `dist/assets/dashboard-page-Bnu4Dz2a.js` — replaced or removed by a later production build/browser run.
- `dist/assets/dashboard-page-DMLv98Eb.js` — replaced or removed by a later production build/browser run.
- `dist/assets/index-ADEWypIP.js` — replaced or removed by a later production build/browser run.
- `dist/assets/index-BCW3gzRq.css` — replaced or removed by a later production build/browser run.
- `dist/assets/index-BcXqRGEp.css` — replaced or removed by a later production build/browser run.
- `dist/assets/index-DfoKJBfN.js` — replaced or removed by a later production build/browser run.
- `dist/assets/index-KAY5U31Q.js` — replaced or removed by a later production build/browser run.
- `dist/assets/index-WIiaCR8B.css` — replaced or removed by a later production build/browser run.
- `dist/assets/index-mKHJIKvF.js` — replaced or removed by a later production build/browser run.
- `dist/assets/index-v4vGpcfk.css` — replaced or removed by a later production build/browser run.
- `dist/assets/match-editor-Bl_A4yXp.js` — replaced or removed by a later production build/browser run.
- `dist/assets/match-editor-C7DNyDqL.js` — replaced or removed by a later production build/browser run.
- `dist/assets/match-editor-C_YwufCE.js` — replaced or removed by a later production build/browser run.
- `dist/assets/match-editor-ok0jwd_b.js` — replaced or removed by a later production build/browser run.
- `dist/assets/pagination-BySmAwBn.js` — replaced or removed by a later production build/browser run.
- `dist/assets/pagination-CA3blnb4.js` — replaced or removed by a later production build/browser run.
- `dist/assets/pagination-CApGSrVt.js` — replaced or removed by a later production build/browser run.
- `dist/assets/pagination-COd_IP0k.js` — replaced or removed by a later production build/browser run.
- `dist/assets/public-page-Bj9Edg2m.js` — replaced or removed by a later production build/browser run.
- `dist/assets/public-page-DjdZ3ltH.js` — replaced or removed by a later production build/browser run.
- `dist/assets/public-page-Dzj0nEzZ.js` — replaced or removed by a later production build/browser run.
- `dist/assets/public-page-Pxydg8Pm.js` — replaced or removed by a later production build/browser run.
- `dist/assets/result-entry-BKrlubch.js` — replaced or removed by a later production build/browser run.
- `dist/assets/result-entry-BME8apUE.js` — replaced or removed by a later production build/browser run.
- `dist/assets/result-entry-CvsvHiJf.js` — replaced or removed by a later production build/browser run.
- `dist/assets/result-entry-z7PXoVFQ.js` — replaced or removed by a later production build/browser run.
- `dist/assets/scan-line-C3ffWMmh.js` — replaced or removed by a later production build/browser run.
- `dist/assets/scan-line-CbZZPWYv.js` — replaced or removed by a later production build/browser run.
- `dist/assets/scan-line-CjZbmFX9.js` — replaced or removed by a later production build/browser run.
- `dist/assets/scan-line-nXxdHQWk.js` — replaced or removed by a later production build/browser run.
- `dist/assets/setup-draft-B_gbcWId.js` — replaced or removed by a later production build/browser run.
- `dist/assets/setup-draft-DMwr1Xsa.js` — replaced or removed by a later production build/browser run.
- `dist/assets/setup-draft-DnYANwcA.js` — replaced or removed by a later production build/browser run.
- `dist/assets/setup-draft-hfH2T2rV.js` — replaced or removed by a later production build/browser run.
- `dist/assets/setup-page-7I8Qo5rJ.js` — replaced or removed by a later production build/browser run.
- `dist/assets/setup-page-BO_MH1f-.js` — replaced or removed by a later production build/browser run.
- `dist/assets/setup-page-Cvxo2M5B.js` — replaced or removed by a later production build/browser run.
- `dist/assets/setup-page-DI3AMfTT.js` — replaced or removed by a later production build/browser run.
- `dist/assets/swords-B9E6JKeR.js` — replaced or removed by a later production build/browser run.
- `dist/assets/swords-BWFI05IZ.js` — replaced or removed by a later production build/browser run.
- `dist/assets/swords-C6NYZ0Zg.js` — replaced or removed by a later production build/browser run.
- `dist/assets/swords-wUbuRKTS.js` — replaced or removed by a later production build/browser run.
- `dist/assets/tournament-page-B9n_HiOq.js` — replaced or removed by a later production build/browser run.
- `dist/assets/tournament-page-B_OWKZOX.js` — replaced or removed by a later production build/browser run.
- `dist/assets/tournament-page-C-3IwjVu.js` — replaced or removed by a later production build/browser run.
- `dist/assets/tournament-page-hQ3b-q4C.js` — replaced or removed by a later production build/browser run.
- `dist/assets/useMutation-BQdRPsqT.js` — replaced or removed by a later production build/browser run.
- `dist/assets/useMutation-BjFeUXcv.js` — replaced or removed by a later production build/browser run.
- `dist/assets/useMutation-Cp5nuW2n.js` — replaced or removed by a later production build/browser run.
- `dist/assets/useMutation-CshCkPgZ.js` — replaced or removed by a later production build/browser run.
- `dist/assets/users-BWxc-eFg.js` — replaced or removed by a later production build/browser run.
- `dist/assets/users-CneLN8I6.js` — replaced or removed by a later production build/browser run.
- `dist/assets/users-DwFmeHmB.js` — replaced or removed by a later production build/browser run.
- `dist/assets/users-LSpZIzhf.js` — replaced or removed by a later production build/browser run.
- `playwright-report/data/0e02fb52252dfc816387c8828618f605135eace8.md` — replaced or removed by a later production build/browser run.
- `playwright-report/data/2a96d778c34bdd34b8d39aae9e6ddd2161ec08a2.png` — replaced or removed by a later production build/browser run.
- `playwright-report/data/2b8e1f1f7808000b473f52f80f181a1481f78740.zip` — replaced or removed by a later production build/browser run.
- `playwright-report/data/2efc0c38d5869a3be98998b4785eb0ae826d6125.md` — replaced or removed by a later production build/browser run.
- `playwright-report/data/44e5626b2ff5ae507c3dccf8bb138f7b9e1db522.png` — replaced or removed by a later production build/browser run.
- `playwright-report/data/47b70dc151e9b7343325b14305964526c24ca333.png` — replaced or removed by a later production build/browser run.
- `playwright-report/data/4bd36cd60be39a9e145653960e102b4fe5b9a48c.md` — replaced or removed by a later production build/browser run.
- `playwright-report/data/53645de2b54874bf830671808bcb4c66a4244d74.zip` — replaced or removed by a later production build/browser run.
- `playwright-report/data/5449fd7ffbcea866adb24fe632a7b1e04679656b.md` — replaced or removed by a later production build/browser run.
- `playwright-report/data/66258a436e49e2e20bac48651e19c35020ce5883.zip` — replaced or removed by a later production build/browser run.
- `playwright-report/data/92a373bf1e89393a2624b73682717c327e4d9d5a.md` — replaced or removed by a later production build/browser run.
- `playwright-report/data/948c8a9c6b49b19683df4d9f7847c46494bd5933.md` — replaced or removed by a later production build/browser run.
- `playwright-report/data/9daa45e6fb305c0d5cab188ccaccfc104b5548b1.zip` — replaced or removed by a later production build/browser run.
- `playwright-report/data/9f3e7b367d6ceb8775965cbd92e6755a6dfc0baf.zip` — replaced or removed by a later production build/browser run.
- `playwright-report/data/ab263c4524c74f8a3e84bb19bf32cffac11ae833.zip` — replaced or removed by a later production build/browser run.
- `playwright-report/data/aef242a624f2582964641de84cb5dc9ea6cf14a3.png` — replaced or removed by a later production build/browser run.
- `playwright-report/data/b61451a974de79d2e1a6e3ab9ec374475775bb7a.png` — replaced or removed by a later production build/browser run.
- `playwright-report/data/e52c06147369fc39d1d3399c1c65ba2d2db64ded.png` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/assets/codeMirrorModule-BEB2e8M3.js` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/assets/defaultSettingsView-D-g2vrvf.js` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/assets/urlMatch-L3liM589.js` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/codeMirrorModule.-QdMvsKi.css` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/codicon.DCmgc-ay.ttf` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/defaultSettingsView.C8BeHuxd.css` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/index.7-c5LSTW.js` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/index.B_TqY17P.css` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/index.html` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/manifest.webmanifest` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/playwright-logo.svg` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/snapshot.B_Jk1wbt.js` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/snapshot.html` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/sw.bundle.js` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/uiMode.CYwC_gH1.js` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/uiMode.CyMfwkXJ.css` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/uiMode.html` — replaced or removed by a later production build/browser run.
- `playwright-report/trace/xtermModule.kHJ-D0s7.css` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-adaptive-naviga-c9586-eps-active-sections-visible-desktop/error-context.md` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-adaptive-naviga-c9586-eps-active-sections-visible-desktop/test-failed-1.png` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-adaptive-naviga-c9586-eps-active-sections-visible-desktop/trace.zip` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-adaptive-naviga-c9586-eps-active-sections-visible-mobile/error-context.md` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-adaptive-naviga-c9586-eps-active-sections-visible-mobile/test-failed-1.png` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-adaptive-naviga-c9586-eps-active-sections-visible-mobile/trace.zip` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-team-selections-7c0da-cally-and-wrap-at-text-zoom-desktop/error-context.md` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-team-selections-7c0da-cally-and-wrap-at-text-zoom-desktop/test-failed-1.png` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-team-selections-7c0da-cally-and-wrap-at-text-zoom-desktop/trace.zip` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-team-selections-7c0da-cally-and-wrap-at-text-zoom-mobile/error-context.md` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-team-selections-7c0da-cally-and-wrap-at-text-zoom-mobile/test-failed-1.png` — replaced or removed by a later production build/browser run.
- `test-results/team-stats-team-selections-7c0da-cally-and-wrap-at-text-zoom-mobile/trace.zip` — replaced or removed by a later production build/browser run.
## Tooltip placement follow-up

The team-stats information tooltip now sizes itself from its full text before the viewport positioning calculation. This prevents its width and left edge from shifting after it opens. Added a desktop/mobile browser regression that checks for movement and viewport clipping. The regression failed first on both viewports with a 12px shift; after the CSS change, both cases pass. Typecheck, lint, and formatting checks pass. The live 362px-wide stats view was inspected after the fix and the tooltip remained fully visible.

Files changed for this follow-up:

- `e2e/team-stats.spec.ts` — added the tooltip stability and viewport containment browser regression.
- `src/styles.css` — set tooltip width to `max-content` before applying the existing maximum width.
- `docs/ORGANIZER_UX.md` — recorded the behavior change and verification.

Generated artifacts from verification:

- `/private/tmp/arena-stats-tooltip-fixed.png` — live view after the fix.
- `test-results/.last-run.json` — updated Playwright run metadata.
- `playwright-report/index.html` — updated Playwright report.

The other frontend changes present in this checkout predate this tooltip follow-up and were left untouched. No application data, backend files, or persistent external state changed.

## Team stats table layout follow-up

The team stats table now leads with Possession, Shots (on target), Shot accuracy, Passes (successful), and Pass accuracy. Accuracy is calculated in the frontend from the existing aggregate values, rounded to one decimal place with trailing zeroes omitted; missing values and zero attempts show a dash, while a zero numerator with attempts shows 0%. Paired values and rates use the lower recorded-match coverage of their source stats and expose both source coverages to assistive technology. Show all stats reveals Free kicks, Corner kicks, Crosses, Offsides, Fouls, Interceptions, Tackles, and Saves; Show key stats returns to the five-row view.

RED: `npm test -- src/features/tournament-management/team-stats-panel.test.tsx` failed on the old separate rows before the implementation. GREEN: all 10 focused component tests pass, and all 111 frontend unit/component tests pass. The 14 desktop/mobile `e2e/team-stats.spec.ts` cases pass, including the new expand/collapse behavior. Typecheck, lint, formatting, and production build pass. The table was inspected in desktop and mobile screenshots and in the open public stats page; expanding the live table showed all 13 rows in the planned order.

Files changed for this follow-up:

- `src/features/tournament-management/team-stats-panel.tsx` — combined source stats, calculated accuracy rows, lower-coverage summaries, and the accessible table disclosure.
- `src/features/tournament-management/team-stats-panel.test.tsx` — covered paired values, rates, zero/missing cases, coverage, ordering, and expansion.
- `e2e/team-stats.spec.ts` — verified the default rows and disclosure on desktop/mobile.
- `src/styles.css` — gave the disclosure a clear right alignment and 44px minimum height.
- `docs/ORGANIZER_UX.md` — documented the behavior and checks.

Generated artifacts updated during verification:

- `dist/_routes.json`, `dist/index.html`.
- `dist/assets/Home-B4MAm1Bs.js`, `dist/assets/auth-page-DhRXBbPG.js`, `dist/assets/dashboard-page-CGSV5iw4.js`, `dist/assets/index-C1jDwdk1.js`, `dist/assets/index-DLKatkSD.css`, `dist/assets/match-editor-ON3IR9XZ.js`, `dist/assets/pagination-DSvXL3kh.js`, `dist/assets/public-page-Dry5rNs3.js`, `dist/assets/result-entry-7xZ9pcvY.js`, `dist/assets/scan-line-D2u2NO_M.js`, `dist/assets/setup-draft-DdftpVMV.js`, `dist/assets/setup-page-C3wQOiGa.js`, `dist/assets/swords-DM4M0gsm.js`, `dist/assets/tournament-page-D3KIaHJS.js`, `dist/assets/useMutation-D8VvELAb.js`, and `dist/assets/users-BUgXgDR4.js`.
- `test-results/.last-run.json` and `playwright-report/index.html` — Playwright run metadata and report.
- The intermediate `test-results/team-stats-team-stats-star-8a470--to-the-complete-stat-order-desktop/` and `...-mobile/` failure screenshots, traces, and error contexts were removed by the later successful browser run.
- `/private/tmp/arena-desktop-team-stats-single.png`, `/private/tmp/arena-desktop-team-stats-comparison.png`, `/private/tmp/arena-desktop-team-stats-zoom.png`, `/private/tmp/arena-mobile-team-stats-single.png`, `/private/tmp/arena-mobile-team-stats-comparison.png`, and `/private/tmp/arena-mobile-team-stats-zoom.png` — isolated browser screenshots.
- `/private/tmp/arena-public-team-stats-expanded.png` and `/private/tmp/arena-public-team-stats-full.png` — live public table screenshots after inspecting expansion and the compact default view.

The tournament-navigation, menu, tooltip, and other earlier uncommitted work in this checkout predates this follow-up and was preserved. No backend/API contracts, dependencies, database records, or tournament data changed. The isolated browser preview server was stopped after the checks.

## Public match stats

Played fixtures and knockout matches in public tournaments with match stats enabled now show a **View stats** action in place of the Final status or disabled match card. Activating it fetches that match’s saved stats on demand and opens a read-only dialog with home/away values, loading feedback, an empty state, and retry on errors. The public match-stats endpoint only returns data for a completed match scoped to the supplied public tournament. No edit controls are available in the dialog.

RED: the focused public fixture test failed because it could not find the View stats action; the knockout-board test also failed because its public match card was disabled. GREEN: both tests verify the public action, on-demand request, read-only dialog and displayed values. All 113 frontend tests pass; typecheck, lint, formatting and production build pass. The browser-specific integration suite was not run because it requires its dedicated browser test database.

Files changed for this follow-up:

- `src/features/tournament-management/public-match-stats-dialog.tsx` — on-demand read-only stats dialog with loading, error/retry and empty states.
- `src/features/tournament-management/knockout-board.tsx` — made completed public knockout cards open match stats without enabling result editing.
- `src/features/tournament-management/knockout-board.test.tsx` — covered the public knockout stats action and read-only behavior.
- `src/features/tournament-management/tournament-page.tsx` — replaced Final with View stats for completed public fixtures when stats are enabled.
- `src/features/tournament-management/tournament-page.test.tsx` — covered the public action, request, values and read-only presentation.
- `src/shared/api/arena-api.ts` — added the typed public match-stats read.
- `src/shared/api/query-keys.ts` — added a scoped public match-stats cache key.
- `src/styles.css` — added compact, scroll-contained match-stats table styling.
- `contracts/openapi.json` and `src/generated/api.ts` — synchronized and regenerated from the backend OpenAPI schema.
- `docs/ORGANIZER_UX.md` — documented this behavior and verification.

Backend files changed for the same feature:

- `src/public-viewing/public-viewing.controller.ts` and `src/public-viewing/public-viewing.service.ts` — added the public read-only route and delegation.
- `src/stats/team-stats.dto.ts` — declared the response DTO.
- `src/tournaments/tournaments.repository.ts` and `src/tournaments/tournaments.service.ts` — fetch and scope completed-match stats.
- `test/api/api.test.ts` — added public endpoint coverage for saved stats and tournament scoping.
- `openapi.json` — regenerated the backend API contract.
- `README.md` — documented endpoint access rules.

The backend unit suite, typecheck, lint, formatting and build pass. The API integration test was not run because `TEST_DATABASE_URL` is unset; the integration suite requires a dedicated PostgreSQL database whose name ends in `_test`. No schema migration or application-data changes were made. Build output in the ignored frontend `dist/` directory was regenerated during validation.

## Public match stats density refinement

Reduced the View stats control’s width, padding and label size, with a 40px mobile hit area. Tightened stat table typography, line height and cell padding, strengthened the row dividers, and reduced the dialog’s content/header spacing. The two focused public match-view tests pass, along with frontend typecheck, lint, formatting and production build.
