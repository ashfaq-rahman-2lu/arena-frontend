import { expect, test } from "vitest";
import {
  proxyApi,
  type ProxyFailureLog,
} from "../../../functions/api/[[path]]";

test.each([429, 500, 502, 503, 504, 599])(
  "upstream HTTP %s logs selected diagnostics once and preserves its response",
  async (status: number): Promise<void> => {
    const logs: ProxyFailureLog[] = [];
    const body = '{"message":"private-response-body"}';
    const upstream = new Response(body, {
      status,
      headers: {
        "Content-Type":
          "application/json; charset=utf-8; token=private-parameter",
        "Retry-After": "30",
        "CF-Ray": "a53060c1be6933a4-DAC",
        "Set-Cookie": "session=private-response-cookie",
        "X-Provider-Secret": "private-secret-header",
        Location: "https://provider.invalid/?token=private-location",
      },
    });
    const result = await proxyApi(
      new Request(
        "https://arena.pages.dev/api/v1/auth/session?token=private-query",
        {
          headers: {
            "X-Request-ID": "trace-upstream-error",
            Cookie: "private-request-cookie",
            Authorization: "Bearer private-authorization",
            "X-CSRF-Token": "private-csrf",
          },
        },
      ),
      { API_ORIGIN: "https://arena.onrender.com" },
      async (_request: Request): Promise<Response> => upstream,
      (entry: ProxyFailureLog): void => {
        logs.push(entry);
      },
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      event: "api_proxy_failed",
      reason: "upstream_http_error",
      requestId: "trace-upstream-error",
      method: "GET",
      pathname: "/api/v1/auth/session",
      upstreamOrigin: "https://arena.onrender.com",
      statusCode: status,
      upstreamStatus: status,
      upstreamContentType: "application/json",
      upstreamRetryAfter: "30",
      upstreamCfRay: "a53060c1be6933a4-DAC",
    });
    expect(logs[0]?.durationMs).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(logs)).not.toMatch(/private-|Bearer/);
    expect(upstream.bodyUsed).toBe(false);
    expect(result.status).toBe(status);
    expect(result.headers.get("retry-after")).toBe("30");
    expect(result.headers.get("set-cookie")).toBe(
      "session=private-response-cookie",
    );
    expect(result.headers.get("x-request-id")).toBe("trace-upstream-error");
    expect(await result.text()).toBe(body);
  },
);

test.each([200, 429, 503])(
  "HTML upstream %s logs selected metadata once while retaining the safe JSON 502",
  async (status: number): Promise<void> => {
    const logs: ProxyFailureLog[] = [];
    const result = await proxyApi(
      new Request("https://arena.pages.dev/api/v1/auth/session"),
      { API_ORIGIN: "https://arena.onrender.com" },
      async (_request: Request): Promise<Response> =>
        new Response("<html>private-body</html>", {
          status,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Retry-After": "Sat, 31 Oct 2026 09:30:00 GMT",
            "CF-Ray": "a53060c1be6933a4-DAC",
          },
        }),
      (entry: ProxyFailureLog): void => {
        logs.push(entry);
      },
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      reason: "upstream_html",
      statusCode: 502,
      upstreamStatus: status,
      upstreamContentType: "text/html",
      upstreamRetryAfter: "Sat, 31 Oct 2026 09:30:00 GMT",
      upstreamCfRay: "a53060c1be6933a4-DAC",
    });
    expect(JSON.stringify(logs)).not.toContain("private-body");
    expect(result.status).toBe(502);
    expect(await result.json()).toMatchObject({
      code: "INTEGRATION_UNAVAILABLE",
    });
  },
);

test.each(["text/plain", "application/problem+json", null])(
  "HTTP 429 diagnostics work with %s content type and missing optional headers",
  async (contentType: string | null): Promise<void> => {
    const logs: ProxyFailureLog[] = [];
    await proxyApi(
      new Request("https://arena.pages.dev/api/v1/auth/session"),
      { API_ORIGIN: "https://arena.onrender.com" },
      async (_request: Request): Promise<Response> =>
        new Response(null, {
          status: 429,
          headers: contentType ? { "Content-Type": contentType } : {},
        }),
      (entry: ProxyFailureLog): void => {
        logs.push(entry);
      },
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      reason: "upstream_http_error",
      upstreamStatus: 429,
    });
    expect(Object.keys(logs[0] ?? {}).sort()).toEqual(
      [
        "event",
        "requestId",
        "method",
        "pathname",
        "durationMs",
        "reason",
        "statusCode",
        "upstreamOrigin",
        "upstreamStatus",
        ...(contentType ? ["upstreamContentType"] : []),
      ].sort(),
    );
  },
);

test("malformed or oversized diagnostic header values are omitted from logs", async (): Promise<void> => {
  const logs: ProxyFailureLog[] = [];
  await proxyApi(
    new Request("https://arena.pages.dev/api/v1/auth/session"),
    { API_ORIGIN: "https://arena.onrender.com" },
    async (_request: Request): Promise<Response> =>
      new Response(null, {
        status: 429,
        headers: {
          "Content-Type": "private-malformed-content-type".repeat(100),
          "Retry-After": "private-malformed-retry".repeat(100),
          "CF-Ray": "private-malformed-ray".repeat(100),
        },
      }),
    (entry: ProxyFailureLog): void => {
      logs.push(entry);
    },
  );
  expect(logs).toHaveLength(1);
  expect(logs[0]).toMatchObject({
    reason: "upstream_http_error",
    upstreamStatus: 429,
  });
  expect(JSON.stringify(logs)).not.toContain("private-");
});

test.each([200, 302, 400, 401, 403, 404, 409])(
  "HTTP %s outside the diagnostic failure cases does not add failure logs",
  async (status: number): Promise<void> => {
    const logs: ProxyFailureLog[] = [];
    const result = await proxyApi(
      new Request("https://arena.pages.dev/api/v1/auth/session"),
      { API_ORIGIN: "https://arena.onrender.com" },
      async (_request: Request): Promise<Response> =>
        new Response("unchanged", { status }),
      (entry: ProxyFailureLog): void => {
        logs.push(entry);
      },
    );
    expect(result.status).toBe(status);
    expect(await result.text()).toBe("unchanged");
    expect(logs).toEqual([]);
  },
);
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

test("gateway failures log safe diagnostics and return the same request ID", async (): Promise<void> => {
  const logs: ProxyFailureLog[] = [];
  let forwardedId: string | null = null;
  const result = await proxyApi(
    new Request(
      "https://arena.pages.dev/api/v1/auth/session?token=private-query",
      {
        headers: {
          "X-Request-ID": "trace-123",
          Cookie: "private-cookie",
          Authorization: "Bearer private-auth",
        },
      },
    ),
    { API_ORIGIN: "https://arena.onrender.com" },
    async (request: Request): Promise<Response> => {
      forwardedId = request.headers.get("x-request-id");
      throw new TypeError("private-provider-message", {
        cause: new Error("private-cause", { cause: "private-nested-cause" }),
      });
    },
    (entry: ProxyFailureLog): void => {
      logs.push(entry);
    },
  );
  expect(result.status).toBe(502);
  expect(result.headers.get("x-request-id")).toBe("trace-123");
  expect(forwardedId).toBe("trace-123");
  expect(logs).toEqual([
    expect.objectContaining({
      event: "api_proxy_failed",
      requestId: "trace-123",
      method: "GET",
      pathname: "/api/v1/auth/session",
      upstreamOrigin: "https://arena.onrender.com",
      reason: "upstream_request_failed",
      statusCode: 502,
      errorType: "TypeError",
    }),
  ]);
  expect(logs[0]?.durationMs).toBeGreaterThanOrEqual(0);
  expect(JSON.stringify(logs)).not.toMatch(/private-|Bearer/);
  expect(await result.text()).not.toContain("private-");
});

test("HTML upstream diagnostics record its status without logging its body", async (): Promise<void> => {
  const logs: ProxyFailureLog[] = [];
  const result = await proxyApi(
    new Request("https://arena.pages.dev/api/v1/auth/session"),
    { API_ORIGIN: "https://arena.onrender.com" },
    async (_request: Request): Promise<Response> =>
      new Response("<html>private-provider-content</html>", {
        status: 503,
        headers: { "Content-Type": "text/html" },
      }),
    (entry: ProxyFailureLog): void => {
      logs.push(entry);
    },
  );
  expect(result.status).toBe(502);
  expect(logs).toEqual([
    expect.objectContaining({
      reason: "upstream_html",
      upstreamStatus: 503,
      statusCode: 502,
    }),
  ]);
  expect(logs[0]?.requestId).toMatch(/^[\w-]{1,100}$/);
  expect(result.headers.get("x-request-id")).toBe(logs[0]?.requestId);
  expect(JSON.stringify(logs)).not.toContain("private-provider-content");
});

test("invalid gateway configuration is logged without exposing the configured credentials", async (): Promise<void> => {
  const logs: ProxyFailureLog[] = [];
  const result = await proxyApi(
    new Request("https://arena.pages.dev/api/v1/health"),
    { API_ORIGIN: "https://user:private-password@arena.onrender.com" },
    async (_request: Request): Promise<Response> => {
      throw new Error("must not fetch");
    },
    (entry: ProxyFailureLog): void => {
      logs.push(entry);
    },
  );
  expect(result.status).toBe(503);
  expect(logs).toEqual([
    expect.objectContaining({
      reason: "invalid_configuration",
      statusCode: 503,
    }),
  ]);
  expect(JSON.stringify(logs)).not.toContain("private-password");
});

test("successful API requests carry a generated request ID without failure logs", async (): Promise<void> => {
  const logs: ProxyFailureLog[] = [];
  let forwardedId: string | null = null;
  const result = await proxyApi(
    new Request("https://arena.pages.dev/api/v1/health", {
      headers: { "X-Request-ID": "invalid request ID" },
    }),
    { API_ORIGIN: "https://arena.onrender.com" },
    async (request: Request): Promise<Response> => {
      forwardedId = request.headers.get("x-request-id");
      return Response.json({ status: "ok" });
    },
    (entry: ProxyFailureLog): void => {
      logs.push(entry);
    },
  );
  expect(result.status).toBe(200);
  expect(forwardedId).toMatch(/^[\w-]{1,100}$/);
  expect(result.headers.get("x-request-id")).toBe(forwardedId);
  expect(logs).toEqual([]);
});
