export function resolveApiOrigin(
  value: string | undefined,
  fallback: string,
): string {
  const origin = value?.trim() || fallback;
  const parsed = new URL(origin);
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  )
    throw new Error(
      "API origin must be an HTTP(S) origin without credentials or a path.",
    );
  return parsed.origin;
}
export const API_ORIGIN = resolveApiOrigin(
  import.meta.env.VITE_API_BASE_URL,
  typeof location === "undefined" ? "http://localhost" : location.origin,
);
export function apiUrl(path: string): string {
  return new URL(path, API_ORIGIN).toString();
}
