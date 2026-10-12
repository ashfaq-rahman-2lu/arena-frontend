# Frontend repository separation verification

Verified on 2026-10-12 with Node 24.21.0. This directory is a separate local Git repository on `main`, with its own dependency lockfile, rules, lint/format configuration, tooling tests, API-schema snapshot, CI, Docker build, and Cloudflare Pages gateway. It requires no parent workspace or backend checkout for ordinary installation, tests, builds, or API generation.

## Executed checks

- A fresh frontend-only copy in an isolated temporary directory passed `npm ci --ignore-scripts`, lint, type checks, component/unit tests, API generation, production build, and Pages Function compilation. Its parent contains no backend checkout or workspace dependencies.
- All 39 unit/component tests pass, including configured API origins, absolute multipart-upload URLs, safe origin validation, Pages proxy headers/body/cookies/redirects, gateway failures, and Render's HTML wake-up response.
- Lint, formatting, type checks, and all 3 tooling-enforcement tests pass independently.
- Playwright's 6 desktop/mobile scenarios passed in each mode: Vite `/api` proxy, direct API origin, and real local Cloudflare Pages Functions via Wrangler (18 scenario executions). After the wake-up response fix and removal of a redundant redirect rule, all 6 Pages scenarios passed again.
- Browser coverage includes sign-in/session cookies, CSRF-protected league/cup setup, dirty navigation, uploads and suggestions, result saves/clear confirmation, reviewed downstream resets, public viewing, server pagination, keyboard tabs/dialog focus, accessibility scans, long content, and 200% text zoom.
- Wrangler compiled the Functions successfully. Telemetry was disabled for local verification; no Cloudflare login or deployment was needed.
- The frontend contract snapshot matches backend `openapi.json` byte-for-byte, and regeneration preserves the generated client. Contract updates now use release artifacts or explicit `API_SCHEMA_URL=... npm run api:sync`, never sibling filesystem writes.
- Dependency installation reported zero audit vulnerabilities.

## Executed red → green evidence

Configured-origin tests failed while requests still used the frontend origin. Multipart-routing coverage failed when uploads retained a relative URL; both now use the configured API origin. Proxy tests first failed for missing cookie/CSRF/body forwarding, redirect preservation, configuration validation, and safe gateway failures, then passed after implementation. A separate test observed Render's HTML wake-up response passing through with status 200; it now becomes an actionable JSON gateway error.

Missing test-module setup, Node/runtime selection, a remaining backend harness path, and linting a loosely typed matcher were corrected separately and are not counted as behavioral red evidence.

Wrangler identified an unnecessary `/* /index.html 200` redirect as a loop. It was removed; Pages' built-in SPA fallback was verified by the browser suite. `_routes.json` invokes the gateway only for `/api/*`.

## Measurements and limits

Production entry JavaScript is approximately 116.82 kB gzip; CSS approximately 11.35 kB gzip. The earlier target below 114.61 kB remains unmet. The Pages gateway is compiled separately and is not included in the browser bundle. For the 64-team/2,016-fixture test competition, the final Pages run rendered 50 fixture rows after tab selection in 121ms desktop and 125ms mobile on this machine; these are informal Playwright timings.

Latest screenshots under `e2e/screenshots/` were visually inspected, including desktop correction and mobile 200% zoom. No visual redesign or framework upgrade was introduced.

Docker image execution, live Cloudflare/Render/Neon behavior, provider credentials, actual Google/email/vision delivery, and GitHub CI execution remain unverified. Git remotes, commits, and cloud deployments were not created or published. Tests used only the guarded temporary backend fixture database and fake integrations. Historical combined-workspace verification is under `docs/PREVIOUS_WORKSPACE_VERIFICATION.md`.
