import { API_ORIGIN } from "./api-origin";
export type Entrant = components["schemas"]["Entrant"];
export type Message = components["schemas"]["MessageResult"];
import createClient from "openapi-fetch";
import type { components, paths } from "../../generated/api";
export type Tournament = components["schemas"]["TournamentView"];
export type Match = components["schemas"]["Match"];
export type Session = components["schemas"]["SessionView"];
export type Setup = components["schemas"]["TournamentSetup"];
export type SetupUpdate = components["schemas"]["TournamentUpdate"];
export type ResultInput = components["schemas"]["ResultInput"];
export type Impact = components["schemas"]["CorrectionImpact"];
export type Suggestion = components["schemas"]["ExtractionSuggestion"];
export type TournamentPage = components["schemas"]["TournamentPage"];
export type HistoryPage = components["schemas"]["HistoryPage"];
export type FixturePage = components["schemas"]["FixturePage"];
export type TournamentFilters = {
  page: number;
  limit: number;
  search?: string;
  status?: "DRAFT" | "ACTIVE" | "COMPLETED";
};
export type ApiTransport = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;
export interface TransportResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Could not complete the request. Please retry.";
}
export function safeReturnUrl(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value)
  )
    return "/dashboard";
  try {
    const url = new URL(value, "https://arena.invalid");
    return url.origin === "https://arena.invalid"
      ? url.pathname + url.search + url.hash
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
export function safeApiError(error: unknown, status: number): ApiError {
  const fallback =
    status === 401
      ? "Sign in to continue"
      : "Could not complete the request. Please retry.";
  let message = fallback,
    code = status === 401 ? "UNAUTHENTICATED" : "REQUEST_FAILED";
  if (error && typeof error === "object") {
    if (
      "message" in error &&
      typeof error.message === "string" &&
      error.message.length <= 1000
    )
      message = error.message;
    if (
      "code" in error &&
      typeof error.code === "string" &&
      /^[A-Z_]{1,80}$/.test(error.code)
    )
      code = error.code;
  }
  return new ApiError(message, status, code);
}
function isSuggestion(value: unknown): value is Suggestion {
  if (!value || typeof value !== "object") return false;
  if (
    !("matched" in value) ||
    typeof value.matched !== "boolean" ||
    !("observedSides" in value) ||
    !Array.isArray(value.observedSides) ||
    value.observedSides.length !== 2 ||
    !("warnings" in value) ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(
      (warning: unknown): boolean => typeof warning === "string",
    )
  )
    return false;
  const score = (item: unknown): boolean =>
    item === null ||
    (typeof item === "number" &&
      Number.isInteger(item) &&
      item >= 0 &&
      item <= 2147483647);
  for (const name of ["homeScore", "awayScore", "homeTiebreak", "awayTiebreak"])
    if (!score(Reflect.get(value, name))) return false;
  return value.observedSides.every((side: unknown): boolean =>
    Boolean(
      side &&
      typeof side === "object" &&
      "name" in side &&
      (side.name === null || typeof side.name === "string") &&
      "score" in side &&
      score(side.score) &&
      "tiebreak" in side &&
      score(side.tiebreak),
    ),
  );
}
export interface ArenaApi {
  session: () => Promise<Session>;
  login: (email: string, password: string) => Promise<Session>;
  register: (name: string, email: string, password: string) => Promise<Message>;
  forgot: (email: string) => Promise<Message>;
  resend: (email: string) => Promise<Message>;
  verify: (token: string) => Promise<Message>;
  reset: (token: string, password: string) => Promise<Message>;
  logout: () => Promise<Session>;
  list: (
    query: TournamentFilters,
    signal?: AbortSignal,
  ) => Promise<TournamentPage>;
  get: (id: string, signal?: AbortSignal) => Promise<Tournament>;
  public: (publicId: string, signal?: AbortSignal) => Promise<Tournament>;
  create: (body: Setup) => Promise<Tournament>;
  update: (id: string, body: SetupUpdate) => Promise<Tournament>;
  preview: (
    id: string,
    page?: number,
    limit?: number,
    signal?: AbortSignal,
  ) => Promise<FixturePage>;
  start: (id: string, expectedRevision: number) => Promise<Tournament>;
  rename: (
    id: string,
    entrantId: string,
    name: string,
    aliases: string[],
    expectedRevision: number,
  ) => Promise<Tournament>;
  tie: (
    id: string,
    scope: string,
    signature: string,
    order: string[],
    expectedRevision: number,
  ) => Promise<Tournament>;
  qualify: (id: string, expectedRevision: number) => Promise<Tournament>;
  pair: (
    id: string,
    pairs: [string, string][],
    byes: string[],
    expectedRevision: number,
  ) => Promise<Tournament>;
  impact: (matchId: string, body: ResultInput) => Promise<Impact>;
  result: (matchId: string, body: ResultInput) => Promise<Tournament>;
  extract(
    matchId: string,
    image: File,
    signal?: AbortSignal,
  ): Promise<Suggestion>;
  history: (
    id: string,
    page?: number,
    limit?: number,
    signal?: AbortSignal,
  ) => Promise<HistoryPage>;
  resetIdentity: () => void;
}
export function createArenaApi(
  transport: ApiTransport = fetch,
  baseUrl: string = API_ORIGIN,
): ArenaApi {
  let csrf = "";
  let generation = 0;
  let ownerId: string | null = null;
  let sessionFlight: Promise<Session> | null = null;
  const client = createClient<paths>({
    baseUrl,
    credentials: "include",
    fetch: transport,
  });
  client.use({
    onRequest: async ({ request }: { request: Request }): Promise<Request> => {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        if (!csrf) await getSession();
        request.headers.set("X-CSRF-Token", csrf);
      }
      return request;
    },
  });
  async function unwrap<T>(promise: Promise<TransportResult<T>>): Promise<T> {
    const epoch = generation;
    const { data, error, response } = await promise;
    if (epoch !== generation)
      throw new ApiError(
        "Your session changed. Please try again.",
        409,
        "IDENTITY_CHANGED",
      );
    if (!response.ok) throw safeApiError(error, response.status);
    if (data === undefined)
      throw new ApiError(
        "The server returned an empty response.",
        502,
        "INVALID_RESPONSE",
      );
    return data;
  }
  function getSession(): Promise<Session> {
    if (sessionFlight) return sessionFlight;
    const epoch = generation;
    const request = unwrap(client.GET("/api/v1/auth/session")).then(
      (data: Session): Session => {
        if (epoch !== generation)
          throw new ApiError("Your session changed.", 409, "IDENTITY_CHANGED");
        if (ownerId !== (data.user?.id ?? null) && ownerId !== null) {
          generation++;
          csrf = "";
        }
        ownerId = data.user?.id ?? null;
        csrf = data.csrf;
        return data;
      },
    );
    sessionFlight = request;
    void request
      .finally((): void => {
        if (sessionFlight === request) sessionFlight = null;
      })
      .catch((): void => {});
    return request;
  }
  const api = {
    session: getSession,
    login: async (email: string, password: string): Promise<Session> => {
      await unwrap(
        client.POST("/api/v1/auth/login", { body: { email, password } }),
      );
      generation++;
      csrf = "";
      ownerId = null;
      sessionFlight = null;
      return getSession();
    },
    register: (
      name: string,
      email: string,
      password: string,
    ): Promise<Message> =>
      unwrap(
        client.POST("/api/v1/auth/register", {
          body: { name, email, password },
        }),
      ),
    forgot: (email: string): Promise<Message> =>
      unwrap(client.POST("/api/v1/auth/forgot-password", { body: { email } })),
    resend: (email: string): Promise<Message> =>
      unwrap(
        client.POST("/api/v1/auth/resend-verification", { body: { email } }),
      ),
    verify: (token: string): Promise<Message> =>
      unwrap(client.POST("/api/v1/auth/verify", { body: { token } })),
    reset: (token: string, password: string): Promise<Message> =>
      unwrap(
        client.POST("/api/v1/auth/reset-password", {
          body: { token, password },
        }),
      ),
    logout: async (): Promise<Session> => {
      await unwrap(client.POST("/api/v1/auth/logout"));
      csrf = "";
      sessionFlight = null;
      generation++;
      return getSession();
    },
    list: (
      query: TournamentFilters,
      signal?: AbortSignal,
    ): Promise<TournamentPage> =>
      unwrap(client.GET("/api/v1/tournaments", { params: { query }, signal })),
    get: (id: string, signal?: AbortSignal): Promise<Tournament> =>
      unwrap(
        client.GET("/api/v1/tournaments/{id}", {
          params: { path: { id } },
          signal,
        }),
      ),
    public: (publicId: string, signal?: AbortSignal): Promise<Tournament> =>
      unwrap(
        client.GET("/api/v1/public/tournaments/{publicId}", {
          params: { path: { publicId } },
          signal,
        }),
      ),
    create: (body: Setup): Promise<Tournament> =>
      unwrap(client.POST("/api/v1/tournaments", { body })),
    update: (
      id: string,
      body: Setup & {
        expectedRevision: number;
      },
    ): Promise<Tournament> =>
      unwrap(
        client.PATCH("/api/v1/tournaments/{id}", {
          params: { path: { id } },
          body,
        }),
      ),
    preview: (
      id: string,
      page: number = 1,
      limit: number = 20,
      signal?: AbortSignal,
    ): Promise<{
      items: components["schemas"]["Fixture"][];
      total: number;
      page: number;
      limit: number;
    }> =>
      unwrap(
        client.GET("/api/v1/tournaments/{id}/fixture-preview", {
          params: { path: { id }, query: { page, limit } },
          signal,
        }),
      ),
    start: (id: string, expectedRevision: number): Promise<Tournament> =>
      unwrap(
        client.POST("/api/v1/tournaments/{id}/start", {
          params: { path: { id } },
          body: { expectedRevision },
        }),
      ),
    rename: (
      id: string,
      entrantId: string,
      name: string,
      aliases: string[],
      expectedRevision: number,
    ): Promise<Tournament> =>
      unwrap(
        client.PATCH("/api/v1/tournaments/{id}/entrants/{entrantId}", {
          params: { path: { id, entrantId } },
          body: { name, aliases, expectedRevision },
        }),
      ),
    tie: (
      id: string,
      scope: string,
      signature: string,
      order: string[],
      expectedRevision: number,
    ): Promise<Tournament> =>
      unwrap(
        client.POST("/api/v1/tournaments/{id}/ties", {
          params: { path: { id } },
          body: { scope, signature, order, expectedRevision },
        }),
      ),
    qualify: (id: string, expectedRevision: number): Promise<Tournament> =>
      unwrap(
        client.POST("/api/v1/tournaments/{id}/qualification", {
          params: { path: { id } },
          body: { expectedRevision },
        }),
      ),
    pair: (
      id: string,
      pairs: [string, string][],
      byes: string[],
      expectedRevision: number,
    ): Promise<Tournament> =>
      unwrap(
        client.POST("/api/v1/tournaments/{id}/rounds", {
          params: { path: { id } },
          body: { pairs, byes, expectedRevision },
        }),
      ),
    impact: (
      matchId: string,
      body: ResultInput,
    ): Promise<components["schemas"]["CorrectionImpact"]> =>
      unwrap(
        client.POST("/api/v1/matches/{matchId}/correction-preview", {
          params: { path: { matchId } },
          body,
        }),
      ),
    result: (matchId: string, body: ResultInput): Promise<Tournament> =>
      unwrap(
        client.PATCH("/api/v1/matches/{matchId}/result", {
          params: { path: { matchId } },
          body,
        }),
      ),
    async extract(
      matchId: string,
      image: File,
      signal?: AbortSignal,
    ): Promise<Suggestion> {
      const epoch = generation;
      if (!csrf) await getSession();
      const form = new FormData();
      form.append("image", image);
      const response = await transport(
        new URL(`/api/v1/matches/${matchId}/extract-score`, baseUrl).toString(),
        {
          method: "POST",
          credentials: "include",
          headers: { "X-CSRF-Token": csrf },
          body: form,
          signal,
        },
      );
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw safeApiError(null, response.status);
      }
      if (epoch !== generation)
        throw new ApiError("Your session changed.", 409, "IDENTITY_CHANGED");
      if (!response.ok) throw safeApiError(data, response.status);
      if (!isSuggestion(data))
        throw new ApiError(
          "Could not read this suggestion. Enter scores manually.",
          502,
          "INVALID_RESPONSE",
        );
      return data;
    },
    history: (
      id: string,
      page: number = 1,
      limit: number = 20,
      signal?: AbortSignal,
    ): Promise<HistoryPage> =>
      unwrap(
        client.GET("/api/v1/tournaments/{id}/history", {
          params: { path: { id }, query: { page, limit } },
          signal,
        }),
      ),
    resetIdentity: (): void => {
      generation++;
      csrf = "";
      ownerId = null;
      sessionFlight = null;
    },
  };
  return api;
}
export const api = createArenaApi();
