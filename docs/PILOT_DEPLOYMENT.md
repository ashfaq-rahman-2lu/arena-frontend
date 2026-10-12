# Zero-budget pilot: Cloudflare Pages Free frontend

The API is independently deployed on Render Free with Neon Free PostgreSQL. Requests follow this path:

```text
Browser → https://YOUR-PROJECT.pages.dev/api/*
        → Cloudflare Pages Function
        → https://YOUR-API.onrender.com/api/*
        → Neon PostgreSQL
```

The frontend repository contains `functions/api/[[path]].ts`. It forwards request bodies, signed cookies, CSRF and Origin headers, and preserves upstream `Set-Cookie` and OAuth redirects. It follows no redirects itself and prevents API responses from being cached. The upstream is fixed by server-side configuration, not chosen by browser input.

## Cloudflare Pages setup

1. Push this frontend repository to your Git host and connect it to a Free Cloudflare Pages project.
2. Use the repository root as the project directory.
3. Build command: `npm ci && npm run build`.
4. Build output directory: `dist`.
5. Set build `NODE_VERSION=24.21.0`.
6. Leave `VITE_API_BASE_URL` empty for this pilot. The browser must call `/api` on Pages.
7. Set the Pages Functions runtime variable `API_ORIGIN=https://YOUR-API.onrender.com` for production, and redeploy after changing it.
8. Set the backend's `FRONTEND_URL` to this project's exact HTTPS Pages origin. If enabling Google, use `https://YOUR-PROJECT.pages.dev/api/v1/auth/google/callback` as its callback URL.

`wrangler.jsonc` describes this Pages build and compatibility date. Set its name to your actual Pages project if using Wrangler deployment. Dashboard/Git integration is sufficient; no Cloudflare API token belongs in browser code.

`public/_routes.json` restricts Functions invocations to `/api/*`; static pages/assets do not need proxy invocations. Pages supplies its default SPA fallback because this build has no top-level `404.html`. Use Pages Git integration or Wrangler deployment so the Functions directory is compiled; a static-files-only upload is insufficient.

Production cookies remain signed, HttpOnly, Secure, and SameSite=Lax on the Pages domain. Do not set `VITE_API_BASE_URL` directly to the unrelated Render domain for this cookie-session pilot.

## Previews and local tests

The backend accepts one exact frontend origin. Do not point arbitrary Pages preview domains at the production API; use a separate test API/database and matching `FRONTEND_URL` for previews.

The standard browser suite tests the Vite proxy. `BROWSER_DIRECT_API=true` tests a separate API origin. `BROWSER_USE_PAGES=true` runs the real local Pages Functions runtime through Wrangler, using the same dedicated backend fixture server. No Cloudflare account or paid provider call is needed for local checks.

## Free-service limits

Pages Functions share the Workers Free request quota (currently 100,000/day); static requests remain free and unlimited when they do not invoke Functions. Public pages poll every 15 seconds while visible, so watch API request usage as pilot audience grows. Keep Workers on the Free plan. When quota is exhausted, choose fail-closed behavior for Functions in the dashboard rather than falling back to static content on API routes.

Render's first request after idle may take about a minute. The proxy preserves redirects and allows a 90-second upstream timeout, then returns a safe retry message. Render HTML wake-up pages are also converted into a safe JSON gateway error for `/api/v1/*` requests. Actual cloud deployment and credentials still need account-side setup.

Sources checked during implementation:

- [Pages Functions routing](https://developers.cloudflare.com/pages/functions/routing/)
- [Pages Functions Free quotas](https://developers.cloudflare.com/pages/functions/pricing/)
- [Pages SPA defaults](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [Render Free cold starts](https://render.com/docs/free)
