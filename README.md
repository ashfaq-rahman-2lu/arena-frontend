# Arena frontend

Independent React/Vite repository. It requires Node.js 24+ and npm. Its own package/lockfile, API contract, lint rules, CI, tests, and Docker build do not require a backend checkout or a parent workspace.

## Selected pilot hosting

Deploy on Cloudflare Pages Free with the included Pages Function proxy to the independent Render API. Follow [the pilot deployment guide](docs/PILOT_DEPLOYMENT.md). Keep `VITE_API_BASE_URL` empty and configure the server-side `API_ORIGIN` binding.

## Local development

Use Node 24. If you manage Node with nvm, run `nvm use` in this repository first; `.nvmrc` pins the major version and npm rejects unsupported runtimes.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173. Start the separately deployed/local API first. With an empty `VITE_API_BASE_URL`, Vite proxies `/api` to `API_PROXY_URL` (default `http://127.0.0.1:3000`). For direct API access, set `VITE_API_BASE_URL=http://localhost:3000` and restart Vite. The API must set `FRONTEND_URL=http://localhost:5173`; use the same localhost hostname consistently for cookies.

## Separate deployment

Set `VITE_API_BASE_URL` to the API origin, e.g. `https://api.example.com`, before building:

```sh
VITE_API_BASE_URL=https://api.example.com npm run build
```

Deploy `dist/` on static hosting with an SPA fallback to `index.html`. The API origin is public build-time configuration; never place API keys, database credentials, or session secrets in Vite environment variables.

Docker builds from this repository only:

```sh
docker build --build-arg VITE_API_BASE_URL=https://api.example.com -t arena-frontend .
docker run --rm -p 5173:80 arena-frontend
```

The frontend image serves static files; it has no hardcoded backend container hostname. JSON, scorecard uploads, and Google login/link URLs all use the configured API origin.

Cookie sessions work with sibling HTTPS subdomains, e.g. `app.example.com` and `api.example.com`, while the API allows the exact frontend origin via credentialed CORS. For different root domains, configure the frontend hosting ingress to forward `/api` to the separately hosted API and leave `VITE_API_BASE_URL` empty. Static Nginx in this image does not automatically configure that external ingress. A same-origin proxy must also forward OAuth callback routes; configure Google's callback URL accordingly.

## Login navigation

Opening `/auth/login` with an active session redirects to `/dashboard` (or a safe `returnTo` destination when supplied), replacing the login history entry. Login and registration wait for the initial session check so Google sign-in (when enabled) and the email form appear together, without inserting the Google button above fields already in use. Signed-out visitors can sign in normally, and successful sign-in still honors a safe `returnTo` destination. Password reset and email confirmation/verification pages remain accessible with an active session.

Session GET requests recover from network failures and HTTP 429/502/503/504 with increasing delays (2, 4, 8, then 15 seconds, plus up to 20% jitter), honoring a supplied `Retry-After`. Each recovery attempt has a two-minute deadline including in-flight requests. Authentication/validation/conflict errors are not retried. During the initial check, auth and protected pages show “Starting server…”. If recovery fails, they keep the current route and offer a keyboard-accessible Retry button; a failed check is not treated as a signed-out session. Cached session data remains visible during background refreshes. Recovery stops when its query is cancelled, and exhausted attempts require manual retry rather than restarting on focus, reconnect, or remount. Login, registration, and other writes are not automatically retried. The shared query deduplicates recovery across navigation and page consumers; no keep-alive polling is added.

## Reviewing match results

Optional match statistics start collapsed so organizers can enter scores quickly. Select **Add match statistics (optional)** to edit them. Existing recorded statistics (including zero values) and statistics applied from a scorecard open the section for review. Collapsing it preserves the draft and does not exclude those statistics from saving.

Every game's result editor includes **Swap results** beneath the score fields. It reverses the draft scores and any displayed OCR stat columns while keeping team identities and fixture order fixed. Swapping never saves automatically; review the result and select **Save result**. Single-match knockout tiebreaks and the selected winner move with the result. Swapping a leg of a two-leg tie clears the aggregate decision so it can be reviewed again.

Screenshot upload remains available only for eFootball tournaments. Stats are labeled with the tournament's home/away team names, and reversed screenshot sides are identified. Reading a new upload resets the displayed screenshot orientation, while manually edited or swapped scores remain protected from OCR overwrites.

## Finding and following tournaments

Tournament lookup accepts an 8–10 character alphanumeric ID or an HTTP(S) tournament link ending in `/t/ID`, including links with query parameters or a trailing slash. It extracts the ID and opens the local public page; it never follows the pasted link's origin. Invalid input stays in the form with an explanation. Failed public lookups include an editable ID/link field so spectators can correct the code in place.

Team names in standings and team cards link to that team's complete fixture list, clearing unrelated status, stage, and round filters. Fixture progress shows the selected team's played/total count; the overall count appears only in the tournament header. Team totals remain independent of fixture status and round filters.

Public tournament pages show the last successful refresh time in the viewer's local time zone and the one-minute refresh interval. During a failed background refresh, the last tournament view stays visible with a warning and **Refresh now** recovery action.

For group tournaments, the admin Knockout section lists remaining matches per group and completed groups with unresolved ties across the qualification cutoff. Its actions open unfinished group fixtures, standings for tie resolution, or the existing qualifier review dialog. Advancement still requires explicit confirmation; the API remains authoritative about qualification readiness.

## API schema updates

`contracts/openapi.json` is a committed snapshot supplied by an API release. Ordinary installs, builds, and tests use it offline.

```sh
npm run api:generate
```

To explicitly synchronize from a running API:

```sh
API_SCHEMA_URL=https://api.example.com/api/openapi.json npm run api:sync
```

Review and commit both `contracts/openapi.json` and `src/generated/api.ts` together. For a downloaded backend release artifact, replace the contract snapshot with that exact artifact and run `npm run api:generate`. Generated types must never be patched manually. CI regenerates against the committed snapshot and checks drift.

## Checks

```sh
npm run test:tooling
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

These checks require no backend repository or server.

## Browser tests

Browser tests require the backend's dedicated fixture server, with injected providers and a database named exactly `arena_browser_test`. Start it in the separate backend repository using its `npm run test:browser-server` instructions. Do not point this suite at production or normal development data.

Then, from this frontend repository:

```sh
npx playwright install chromium
BROWSER_API_URL=http://127.0.0.1:3001 npm run test:browser
BROWSER_API_URL=http://127.0.0.1:3001 BROWSER_DIRECT_API=true npm run test:browser
```

Playwright manages only this frontend's production build/preview on port 5174. The first command exercises the `/api` proxy; the second sends browser requests directly to the API's separate origin. Both run desktop/mobile Chromium projects. The backend fixture expects frontend origin `http://127.0.0.1:5174`.

`.github/workflows/browser.yml` provides a manual browser workflow that accepts a separately built backend test-image reference. Normal frontend CI remains independent and never checks out backend source. Screenshots live in `e2e/screenshots/`.

See `VERIFICATION.md` for current separation checks and `docs/` for historical product/update plans.
