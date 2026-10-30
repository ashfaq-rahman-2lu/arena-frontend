export interface ProxyEnvironment {
  API_ORIGIN?: string;
}
export interface ProxyContext {
  request: Request;
  env: ProxyEnvironment;
}
interface StreamingRequestInit extends RequestInit {
  duplex: "half";
}
export type ProxyTransport = (request: Request) => Promise<Response>;
export interface ProxyFailureLog {
  event: "api_proxy_failed";
  requestId: string;
  method: string;
  pathname: string;
  upstreamOrigin?: string;
  reason: "invalid_configuration" | "upstream_html" | "upstream_request_failed";
  statusCode: 502 | 503;
  durationMs: number;
  upstreamStatus?: number;
  errorType?: string;
}
export type ProxyLogger = (entry: ProxyFailureLog) => void;
function logProxyFailure(entry: ProxyFailureLog): void {
  console.error(JSON.stringify(entry));
}
function failure(
  status: number,
  code: string,
  message: string,
  requestId: string,
): Response {
  return Response.json(
    { statusCode: status, code, message },
    {
      status,
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    },
  );
}
export async function proxyApi(
  request: Request,
  environment: ProxyEnvironment,
  transport: ProxyTransport = fetch,
  logger: ProxyLogger = logProxyFailure,
): Promise<Response> {
  const startedAt = Date.now();
  const incoming = new URL(request.url);
  const incomingId = request.headers.get("x-request-id");
  const requestId =
    incomingId && /^[\w-]{1,100}$/.test(incomingId)
      ? incomingId
      : crypto.randomUUID();
  const logFailure = (
    details: Pick<
      ProxyFailureLog,
      | "reason"
      | "statusCode"
      | "upstreamOrigin"
      | "upstreamStatus"
      | "errorType"
    >,
  ): void => {
    logger({
      event: "api_proxy_failed",
      requestId,
      method: request.method,
      pathname: incoming.pathname,
      durationMs: Date.now() - startedAt,
      ...details,
    });
  };
  let origin: URL;
  try {
    if (!environment.API_ORIGIN) throw new Error("Missing upstream");
    origin = new URL(environment.API_ORIGIN);
    if (
      !["https:", "http:"].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== "/" ||
      origin.search ||
      origin.hash ||
      origin.origin === incoming.origin
    )
      throw new Error("Invalid upstream");
  } catch {
    logFailure({ reason: "invalid_configuration", statusCode: 503 });
    return failure(
      503,
      "INTEGRATION_UNAVAILABLE",
      "The API gateway is not configured.",
      requestId,
    );
  }
  const target = new URL(incoming.pathname + incoming.search, origin);
  const headers = new Headers(request.headers);
  headers.set("X-Request-ID", requestId);
  for (const name of [
    "host",
    "content-length",
    "connection",
    "x-forwarded-host",
    "x-forwarded-proto",
    "x-forwarded-for",
  ])
    headers.delete(name);
  const init: StreamingRequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
    duplex: "half",
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
    signal: AbortSignal.timeout(90000),
  };
  try {
    const upstream = await transport(new Request(target, init));
    const isRedirect =
      [301, 302, 303, 307, 308].includes(upstream.status) &&
      upstream.headers.has("location");
    if (
      !isRedirect &&
      incoming.pathname.startsWith("/api/v1/") &&
      upstream.headers.get("content-type")?.includes("text/html")
    ) {
      logFailure({
        reason: "upstream_html",
        statusCode: 502,
        upstreamOrigin: origin.origin,
        upstreamStatus: upstream.status,
      });
      await upstream.body?.cancel();
      return failure(
        502,
        "INTEGRATION_UNAVAILABLE",
        "The API is waking up or unavailable. Please retry shortly.",
        requestId,
      );
    }
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("Cache-Control", "no-store");
    responseHeaders.set("X-Request-ID", requestId);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const errorType =
      error instanceof Error &&
      ["Error", "TypeError", "AbortError", "TimeoutError"].includes(error.name)
        ? error.name
        : "unknown";
    logFailure({
      reason: "upstream_request_failed",
      statusCode: 502,
      upstreamOrigin: origin.origin,
      errorType,
    });
    return failure(
      502,
      "INTEGRATION_UNAVAILABLE",
      "The API is waking up or unavailable. Please retry shortly.",
      requestId,
    );
  }
}
export function onRequest(context: ProxyContext): Promise<Response> {
  return proxyApi(context.request, context.env);
}
