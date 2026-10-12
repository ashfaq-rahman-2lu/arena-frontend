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
function failure(status: number, code: string, message: string): Response {
  return Response.json(
    { statusCode: status, code, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function proxyApi(
  request: Request,
  environment: ProxyEnvironment,
  transport: ProxyTransport = fetch,
): Promise<Response> {
  const incoming = new URL(request.url);
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
    return failure(
      503,
      "INTEGRATION_UNAVAILABLE",
      "The API gateway is not configured.",
    );
  }
  const target = new URL(incoming.pathname + incoming.search, origin);
  const headers = new Headers(request.headers);
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
    if (
      incoming.pathname.startsWith("/api/v1/") &&
      upstream.headers.get("content-type")?.includes("text/html")
    ) {
      await upstream.body?.cancel();
      return failure(
        502,
        "INTEGRATION_UNAVAILABLE",
        "The API is waking up or unavailable. Please retry shortly.",
      );
    }
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set("Cache-Control", "no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return failure(
      502,
      "INTEGRATION_UNAVAILABLE",
      "The API is waking up or unavailable. Please retry shortly.",
    );
  }
}
export function onRequest(context: ProxyContext): Promise<Response> {
  return proxyApi(context.request, context.env);
}
