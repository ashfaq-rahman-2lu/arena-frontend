import { expect, test } from "vitest";
import { proxyApi } from "../../../functions/api/[[path]]";
test("Pages proxy forwards cookies, CSRF, query and body to the fixed Render origin", async (): Promise<void> => {
  let forwarded: Request | undefined;
  const result = await proxyApi(
    new Request(
      "https://arena.pages.dev/api/v1/matches/match/result?review=1",
      {
        method: "PATCH",
        headers: {
          Cookie: "arena_session=signed",
          Origin: "https://arena.pages.dev",
          "X-CSRF-Token": "csrf",
          "Content-Type": "application/json",
        },
        body: '{"homeScore":0,"awayScore":1}',
      },
    ),
    { API_ORIGIN: "https://arena.onrender.com" },
    async (request: Request): Promise<Response> => {
      forwarded = request;
      return new Response('{"ok":true}', { status: 200 });
    },
  );
  expect(result.status).toBe(200);
  expect(forwarded?.url).toBe(
    "https://arena.onrender.com/api/v1/matches/match/result?review=1",
  );
  expect(forwarded?.headers.get("cookie")).toBe("arena_session=signed");
  expect(forwarded?.headers.get("origin")).toBe("https://arena.pages.dev");
  expect(forwarded?.headers.get("x-csrf-token")).toBe("csrf");
  expect(await forwarded?.text()).toBe('{"homeScore":0,"awayScore":1}');
  expect(result.headers.get("cache-control")).toBe("no-store");
});
test.each([
  [
    "/api/v1/auth/google",
    "https://accounts.google.com/authorize",
    "arena_oauth=signed; HttpOnly; Secure; SameSite=Lax",
  ],
  [
    "/api/v1/auth/google/callback?state=state&code=code",
    "https://arena.pages.dev/dashboard",
    "arena_session=signed; HttpOnly; Secure; SameSite=Lax",
  ],
])(
  "HTML OAuth redirects pass through for %s",
  async (path: string, location: string, cookie: string): Promise<void> => {
    let redirect: RequestRedirect | undefined;
    const body = `<p>Found. Redirecting to ${location}</p>`;
    const result = await proxyApi(
      new Request(`https://arena.pages.dev${path}`),
      { API_ORIGIN: "https://arena.onrender.com" },
      async (request: Request): Promise<Response> => {
        redirect = request.redirect;
        return new Response(body, {
          status: 302,
          headers: {
            Location: location,
            "Set-Cookie": cookie,
            "Content-Type": "text/html; charset=utf-8",
          },
        });
      },
    );
    expect(redirect).toBe("manual");
    expect(result.status).toBe(302);
    expect(result.headers.get("location")).toBe(location);
    expect(result.headers.get("set-cookie")).toBe(cookie);
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(await result.text()).toBe(body);
  },
);
test("unconfigured or invalid upstreams fail safely without calling fetch", async (): Promise<void> => {
  for (const origin of [
    undefined,
    "https://user:secret@arena.onrender.com",
    "https://arena.onrender.com/path",
    "https://arena.pages.dev",
  ]) {
    let called = false;
    const result = await proxyApi(
      new Request("https://arena.pages.dev/api/v1/health"),
      { API_ORIGIN: origin },
      async (_request: Request): Promise<Response> => {
        called = true;
        return new Response();
      },
    );
    expect(result.status).toBe(503);
    expect(called).toBe(false);
  }
});
test("upstream failures return an actionable safe gateway error", async (): Promise<void> => {
  const result = await proxyApi(
    new Request("https://arena.pages.dev/api/v1/health"),
    { API_ORIGIN: "https://arena.onrender.com" },
    async (_request: Request): Promise<Response> => {
      throw new Error("private provider details");
    },
  );
  expect(result.status).toBe(502);
  expect(await result.text()).not.toContain("private provider details");
});
test("Render's HTML wake-up response becomes an actionable API gateway error", async (): Promise<void> => {
  const result = await proxyApi(
    new Request("https://arena.pages.dev/api/v1/auth/session"),
    { API_ORIGIN: "https://arena.onrender.com" },
    async (_request: Request): Promise<Response> =>
      new Response("<html>Loading Render service</html>", {
        headers: { "Content-Type": "text/html" },
      }),
  );
  expect(result.status).toBe(502);
  expect(await result.json()).toMatchObject({
    code: "INTEGRATION_UNAVAILABLE",
    message: "The API is waking up or unavailable. Please retry shortly.",
  });
});
