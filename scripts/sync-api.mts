import { writeFile } from "node:fs/promises";
const source = process.env.API_SCHEMA_URL;
if (!source)
  throw new Error("Set API_SCHEMA_URL to the backend's /api/openapi.json URL.");
const url = new URL(source);
if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
  throw new Error(
    "API_SCHEMA_URL must be an HTTP(S) URL without embedded credentials.",
  );
const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
if (!response.ok)
  throw new Error(`Schema download failed (${response.status}).`);
const schema: unknown = await response.json();
if (
  !schema ||
  typeof schema !== "object" ||
  !("openapi" in schema) ||
  typeof schema.openapi !== "string" ||
  !("paths" in schema) ||
  !schema.paths ||
  typeof schema.paths !== "object" ||
  !("components" in schema) ||
  !schema.components ||
  typeof schema.components !== "object"
)
  throw new Error("Downloaded document is not an OpenAPI contract.");
await writeFile(
  new URL("../contracts/openapi.json", import.meta.url),
  JSON.stringify(schema, null, 2) + "\n",
);
