import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("the browser tab declares an Arena icon available from nested routes", (): void => {
  const html = new DOMParser().parseFromString(
    readFileSync(resolve("index.html"), "utf8"),
    "text/html",
  );
  const icon = html.querySelector<HTMLLinkElement>('link[rel="icon"]');
  expect(icon).not.toBeNull();
  expect(icon?.getAttribute("href")).toBe("/favicon.svg");
  expect(icon?.getAttribute("type")).toBe("image/svg+xml");
  const svg = new DOMParser().parseFromString(
    readFileSync(resolve("public/favicon.svg"), "utf8"),
    "image/svg+xml",
  );
  expect(svg.querySelector("parsererror")).toBeNull();
  expect(svg.documentElement.localName).toBe("svg");
  expect(svg.documentElement.getAttribute("viewBox")).toBe("0 0 64 64");
  expect(svg.querySelector("path")).not.toBeNull();
});
