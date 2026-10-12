> Historical update plan, completed before repository separation. Use the repository README and PILOT_DEPLOYMENT.md for current commands and hosting.

# Frontend compliance and usability update

## Summary

Update the frontend against [its project instructions](../AGENTS.md), the authoritative `.agents/rules/frontend-*.mdc` files, the React and design skills, and the coordinated contracts in [BACKEND_UPDATE_PLAN.md](BACKEND_UPDATE_PLAN.md).

Confirmed direction: **compliance and usability**, retain and refine Arena's dark/lime identity, and adopt backend pagination and stable error codes. Stale edits will support **explicit review and reapplication**.

Baseline: frontend type checking, production build, and both existing tests pass. Component and browser suites are not yet configured.

## Architecture, types, and API contracts

- Organize authentication, dashboard, setup, tournament management, public viewing, and score editing into features owning their components, hooks, models, and tests. Route pages compose these features; shared UI primitives live separately.
- Declare named props, drafts, validation results, API errors, and workflow states. Annotate every handwritten function and callback explicitly; remove `any`, non-null assertions, and unsafe casts. Generated contracts remain exempt.
- Introduce TypeScript-aware ESLint, React hooks/accessibility rules, and Prettier. Verify enforcement using deliberately invalid fixtures before enabling CI checks.
- Centralize generated `openapi-fetch` access, multipart handling, safe error parsing, cancellation, and CSRF/session bootstrap. Coalesce concurrent session requests and reset CSRF state when identity changes.
- Move reads and writes into TanStack Query hooks. Private keys include owner identity, resource, filters, pagination, and relevant revisions; public keys remain separate. Cancel and remove private queries on logout or identity changes, and ignore responses belonging to a previous identity.
- Invalidate affected detail, dashboard, history, preview, and session queries after successful writes. Disable mutation retries and retries for validation, authorization, or revision conflicts.
- Adopt `{items, total, page, limit}` for dashboard, history, and fixture preview, with 20 items per page. Dashboard search/status filters run server-side; totals use owner-wide summary metadata rather than the current page.
- Use URL search parameters for dashboard filters/pages and tournament tabs/fixture filters. Reset pagination when filters change.
- Regenerate contracts through `npm run api:generate`. Coordinate named authentication reasons—particularly email verification—with backend error codes so the UI stops inspecting message strings.

## Editing and asynchronous workflows

- **Setup:** initialize drafts once per resource, preserve edits through refetches, and give unsaved entrants/groups stable client IDs. Map those IDs to backend group indexes only when constructing a payload.
- Validate trimmed names, aliases, duplicate names, entrant/group limits, assignments, qualifier counts, and numeric rules before submission. Keep numeric drafts as strings until validated; empty values must never become zero.
- **All mutations:** use explicit pending/success/failure states, prevent duplicate submissions, retain failed inputs, and show persistent actionable errors. Close dialogs, navigate, and announce success only after confirmed success.
- **Stale revisions:** retain the draft and display local versus latest server values. Offer “Use latest” or “Reapply draft”; reapplication requires explicit review and validation before a separate save using the latest revisions. Invalid entrant references or changed eligibility must be corrected first. Never automatically merge or retry.
- **Score editing:** separate draft, extraction, correction-preview, confirmation, and save states. Preserve fields edited during extraction; require mapping for ambiguous identities; keep unreadable values null and zero meaningful.
- Invalidate correction previews whenever payload fields or relevant revisions change, including changes from extraction. After conflict recovery, obtain a fresh preview/token before confirming a destructive reset.
- Scope extraction responses to the active match/file/request. Cancel or ignore obsolete responses, validate upload size/type for user feedback, reset file inputs deliberately, and revoke preview URLs.
- Require confirmation before clearing a saved result. Preserve backend impact confirmation for downstream resets; extraction never persists scores.
- Warn before abandoning dirty setup or editor drafts. Use the existing React Router version's data router for navigation blocking and a `beforeunload` warning for reloads; preserve current paths and SPA deployment. [Navigation-blocking guidance](https://reactrouter.com/api/hooks/useBlocker)
- Keep drafts in memory. Reset sensitive drafts on logout or identity changes; handle session expiry with an explicit sign-in path and validated internal return URL.

## Visual design, accessibility, and performance

- Keep Arena branding and the existing page hierarchy. Consolidate semantic tokens around background `#10120e`, surface `#171a14`, text `#eeeee7`, muted text `#a7afa0`, lime `#c6f16c`, and warning/error accent `#f2ae85`.
- Retain the condensed display treatment for marketing headings and the existing system sans-serif stack for operational screens. Use 16px body text, at least 14px form labels/dense operational text, and at least 12px supporting metadata. Use tabular numerals for scores and standings.
- Format and organize CSS by shared foundations and features. Remove conflicting overrides; reuse consistent button, field, badge, dialog, and notification variants.
- Give fields associated labels, combined hint/error descriptions, invalid states, and first-error focus. Use fieldsets/radios for game and format choices, pressed buttons for dashboard filters, and complete keyboard semantics for tournament tabs.
- Name dialogs through their headings, define initial focus, retain native focus containment, and restore focus to their triggers. Dirty-dismissal confirmation must preserve dialog drafts.
- Add semantic navigation, a skip link, meaningful table captions/headers, contextual match-action names, decorative-icon hiding, and announced loading/success/error states. Verify against the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
- Keep fixture status text and essential setup guidance available on mobile. Support long names, 200% text zoom, reduced motion, and usable touch targets; confine table/bracket scrolling to their containers.
- Preserve visible-only public polling every 15 seconds. Show refresh failures without removing successfully loaded competition data.
- Lazy-load substantial auth/setup/management routes and the score editor. Paginate displayed fixtures locally at 50 rows while preserving server ordering. Measure before adding memoization or virtualization.
- Record bundle sizes and large-tournament interaction timings. Target a smaller initial JavaScript payload than the current 114.61 kB gzip baseline.

## Test-first delivery and acceptance

- Implement in stages: test/tooling foundation; feature/type refactor; coordinated API/cache changes; editing fixes; visual/accessibility refinement.
- Execute and record **red → green → refactor** for behavior changes. Establish regression coverage before structural moves.
- Configure Vitest discovery for `.test.ts` and `.test.tsx`; use React Testing Library, user-event, jest-dom, and jsdom for component tests. Give every test its own query client and transport fixtures. [Vitest environment guidance](https://vitest.dev/guide/environment.html)
- Cover pagination/search/totals, identity isolation, cancellation, session loading/expiry, failed-dialog retention, duplicate submissions, stable draft IDs, numeric validation, dirty navigation, and explicit stale-draft reapplication.
- Preserve suggestion-merging tests; add delayed extraction, file replacement, ambiguous mapping, zero/null, preview invalidation, fresh reset confirmation, and upload cleanup cases.
- Configure Playwright with desktop and mobile Chromium projects, managed frontend/backend servers, and an isolated database named `arena_browser_test`. Guard its name before migrations or fixture cleanup; use test-only seeded accounts and injected integration fakes.
- Exercise sign-in, league/cup setup, public viewing, results, correction confirmation, score suggestions, pagination, and keyboard dialog flows. Include automated accessibility checks and visual inspection at 375px and 1440px, long-content cases, and 200% zoom.
- Completion gates: frontend lint/format, typecheck, tests, build, browser tests, contract regeneration, backend contract/API checks, and generated-file drift checks in CI.
- Update verification documentation with intentional behavior changes, executed red/green evidence, screenshots, measurements, and unavailable checks.

No new competition capabilities, theme switcher, framework upgrade, state library, paid integration calls, or deployment is included. Contract changes ship with the backend update; existing routes and tournament rules remain the agreed defaults.
