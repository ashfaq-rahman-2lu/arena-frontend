import { spawn } from "node:child_process";
const origin = new URL(process.env.BROWSER_API_URL ?? "http://127.0.0.1:3001");
if (
  !["http:", "https:"].includes(origin.protocol) ||
  origin.username ||
  origin.password ||
  origin.pathname !== "/"
)
  throw new Error(
    "BROWSER_API_URL must be an HTTP(S) origin without credentials or a path.",
  );
const child = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "pages",
    "dev",
    "dist",
    "--ip",
    "127.0.0.1",
    "--port",
    "5174",
    "--binding",
    `API_ORIGIN=${origin.origin}`,
  ],
  { stdio: "inherit" },
);
child.on("exit", (code: number | null): void => {
  process.exitCode = code ?? 1;
});
child.on("error", (error: Error): void => {
  process.stderr.write(error.message + "\n");
  process.exitCode = 1;
});
process.on("SIGTERM", (): void => {
  child.kill("SIGTERM");
});
process.on("SIGINT", (): void => {
  child.kill("SIGINT");
});
