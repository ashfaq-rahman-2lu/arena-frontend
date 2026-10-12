import { expect, test } from "vitest";
import { resolveApiOrigin } from "./api-origin";
test("separate deployment uses the configured API origin", (): void => {
  expect(
    resolveApiOrigin("https://api.arena.test/", "https://app.arena.test"),
  ).toBe("https://api.arena.test");
});
test("an empty origin keeps same-origin proxy deployment", (): void => {
  expect(resolveApiOrigin("", "https://app.arena.test")).toBe(
    "https://app.arena.test",
  );
});
test("API origins reject credentials, paths, queries, and non-HTTP protocols", (): void => {
  for (const value of [
    "javascript:alert(1)",
    "https://secret@api.arena.test",
    "https://api.arena.test/api",
    "https://api.arena.test?key=secret",
    "https://api.arena.test#fragment",
  ])
    expect((): string =>
      resolveApiOrigin(value, "https://app.arena.test"),
    ).toThrow("API origin");
});
