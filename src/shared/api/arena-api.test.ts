import { expect, test } from "vitest";
import { createArenaApi, safeReturnUrl } from "./arena-api";
test("concurrent session bootstrap makes one request and shares CSRF", async (): Promise<void> => {
  let calls = 0;
  let release: ((response: Response) => void) | undefined;
  const transport = async (
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> => {
    calls++;
    return new Promise<Response>(
      (resolve: (response: Response) => void): void => {
        release = resolve;
      },
    );
  };
  const instance = createArenaApi(transport);
  const first = instance.session(),
    second = instance.session();
  await new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, 0);
  });
  expect(calls).toBe(1);
  if (!release) throw new Error("No request");
  release(
    new Response(
      JSON.stringify({ csrf: "csrf", user: null, googleEnabled: false }),
      { headers: { "Content-Type": "application/json" } },
    ),
  );
  expect(await first).toEqual(await second);
});
test("safe return URLs reject external or protocol-relative targets", (): void => {
  expect(safeReturnUrl("//evil.test")).toBe("/dashboard");
  expect(safeReturnUrl("https://evil.test")).toBe("/dashboard");
  expect(safeReturnUrl("/manage/id?tab=history")).toBe(
    "/manage/id?tab=history",
  );
});
test("malformed API errors have a safe fallback and stable reason", async (): Promise<void> => {
  const instance = createArenaApi(
    async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> =>
      new Response(JSON.stringify({ message: { private: "stack" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
  );
  await expect(instance.session()).rejects.toMatchObject({
    status: 401,
    code: "UNAUTHENTICATED",
    message: "Sign in to continue",
  });
});
test("login rejects late data from the previous identity", async (): Promise<void> => {
  let release: ((response: Response) => void) | undefined;
  const instance = createArenaApi(
    async (
      input: RequestInfo | URL,
      _init?: RequestInit,
    ): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/tournaments/old"))
        return new Promise<Response>(
          (resolve: (response: Response) => void): void => {
            release = resolve;
          },
        );
      return new Response(
        JSON.stringify(
          url.endsWith("/auth/login")
            ? { csrf: "new" }
            : {
                csrf: "new",
                user: {
                  id: "new",
                  name: "New",
                  email: "new@example.test",
                  hasPassword: true,
                  googleLinked: false,
                },
                googleEnabled: false,
              },
        ),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  );
  await instance.session();
  const old = instance.get("old");
  await new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, 0);
  });
  await instance.login("new@example.test", "password");
  if (!release) throw new Error("No detail request");
  release(
    new Response(JSON.stringify({ id: "old" }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  await expect(old).rejects.toMatchObject({ code: "IDENTITY_CHANGED" });
});
test("cancelling a private read propagates to the transport", async (): Promise<void> => {
  let active: AbortSignal | undefined;
  const instance = createArenaApi(
    async (
      input: RequestInfo | URL,
      _init?: RequestInit,
    ): Promise<Response> => {
      if (!(input instanceof Request)) throw new Error("Expected Request");
      active = input.signal;
      return new Promise<Response>(
        (
          _resolve: (response: Response) => void,
          reject: (reason: unknown) => void,
        ): void => {
          input.signal.addEventListener(
            "abort",
            (): void => reject(new DOMException("Cancelled", "AbortError")),
            { once: true },
          );
        },
      );
    },
  );
  const controller = new AbortController();
  const read = instance.get("private", controller.signal);
  await new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, 0);
  });
  controller.abort();
  expect(active?.aborted).toBe(true);
  await expect(read).rejects.toMatchObject({ name: "AbortError" });
});
test("JSON requests and scorecard uploads use the same separately hosted API", async (): Promise<void> => {
  const urls: string[] = [];
  const instance = createArenaApi(
    async (
      input: RequestInfo | URL,
      _init?: RequestInit,
    ): Promise<Response> => {
      const url = input instanceof Request ? input.url : String(input);
      urls.push(url);
      return new Response(
        JSON.stringify(
          url.endsWith("/auth/session")
            ? { csrf: "csrf", user: null, googleEnabled: false }
            : {
                matched: false,
                homeScore: null,
                awayScore: null,
                homeTiebreak: null,
                awayTiebreak: null,
                observedSides: [
                  { name: null, score: null, tiebreak: null },
                  { name: null, score: null, tiebreak: null },
                ],
                warnings: [],
              },
        ),
        { headers: { "Content-Type": "application/json" } },
      );
    },
    "https://api.arena.test",
  );
  await instance.extract(
    "match",
    new File(["image"], "score.png", { type: "image/png" }),
  );
  expect(urls).toEqual([
    "https://api.arena.test/api/v1/auth/session",
    "https://api.arena.test/api/v1/matches/match/extract-score",
  ]);
});
