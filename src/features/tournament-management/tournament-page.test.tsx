import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api, ApiError } from "../../shared/api/arena-api";
import { match, tournament } from "../../test/fixtures";
import { TournamentPage } from "./tournament-page";
test("a failed start retains the fixture dialog and shows a persistent error", async (): Promise<void> => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  cache.setQueryData(["session"], {
    csrf: "csrf",
    user: {
      id: "owner",
      name: "Admin",
      email: "admin@example.test",
      hasPassword: true,
      googleLinked: false,
    },
    googleEnabled: false,
  });
  const get = vi
    .spyOn(api, "get")
    .mockResolvedValue({ ...tournament, status: "DRAFT", matches: [] });
  const preview = vi
    .spyOn(api, "preview")
    .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  const start = vi
    .spyOn(api, "start")
    .mockRejectedValue(new Error("Could not start. Retry."));
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={["/manage/tournament-id"]}>
        <Routes>
          <Route path="/manage/:id" element={<TournamentPage admin />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: /Review & start/i }),
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Start tournament" }),
  );
  await waitFor((): void => expect(start).toHaveBeenCalled());
  expect(
    await screen.findByRole("dialog", { name: "Review your fixtures" }),
  ).toBeVisible();
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not start");
  get.mockRestore();
  preview.mockRestore();
  start.mockRestore();
  cache.clear();
});
test("tournament tabs support keyboard selection and identify their panel", async (): Promise<void> => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const get = vi.spyOn(api, "public").mockResolvedValue(tournament);
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={["/t/ARENA2026?tab=standings"]}>
        <Routes>
          <Route path="/t/:publicId" element={<TournamentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const standings = await screen.findByRole("tab", { name: "Standings" });
  standings.focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Fixtures" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("tabpanel", { name: "Fixtures" })).toBeVisible();
  get.mockRestore();
  cache.clear();
});
test("stale rename retains the draft and needs explicit review before a separate save", async (): Promise<void> => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  cache.setQueryData(["session"], {
    csrf: "csrf",
    user: {
      id: "owner",
      name: "Admin",
      email: "admin@example.test",
      hasPassword: true,
      googleLinked: false,
    },
    googleEnabled: false,
  });
  vi.spyOn(api, "session").mockResolvedValue({
    csrf: "csrf",
    user: {
      id: "owner",
      name: "Admin",
      email: "admin@example.test",
      hasPassword: true,
      googleLinked: false,
    },
    googleEnabled: false,
  });
  vi.spyOn(api, "get")
    .mockResolvedValueOnce(tournament)
    .mockResolvedValue({ ...tournament, revision: 2 });
  const rename = vi
    .spyOn(api, "rename")
    .mockRejectedValueOnce(
      new ApiError("Review latest", 409, "REVISION_CONFLICT"),
    )
    .mockResolvedValue({ ...tournament, revision: 3 });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={["/manage/tournament-id?tab=teams"]}>
        <Routes>
          <Route path="/manage/:id" element={<TournamentPage admin />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Edit Alpha" }),
  );
  const input = screen.getByRole("textbox", { name: "Team name" });
  await userEvent.clear(input);
  await userEvent.type(input, "Revised Alpha");
  await userEvent.click(screen.getByRole("button", { name: "Save team" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Reapply draft" }),
  );
  expect(rename).toHaveBeenCalledTimes(1);
  expect(input).toHaveValue("Revised Alpha");
  await userEvent.click(screen.getByRole("button", { name: "Save team" }));
  await waitFor((): void =>
    expect(rename).toHaveBeenLastCalledWith(
      "tournament-id",
      "home",
      "Revised Alpha",
      [],
      2,
    ),
  );
  cache.clear();
});

test("fixtures navigate complete rounds and keep group and knockout rounds distinct", async (): Promise<void> => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  vi.spyOn(api, "public").mockResolvedValue({
    ...tournament,
    format: "WORLD_CUP",
    matches: [
      { ...match, stage: "GROUP" },
      {
        ...match,
        id: "second",
        stage: "GROUP",
        round: 2,
        homeScore: null,
        awayScore: null,
      },
      {
        ...match,
        id: "knockout",
        stage: "KNOCKOUT",
        homeScore: null,
        awayScore: null,
      },
    ],
  });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={["/t/ARENA2026?tab=fixtures"]}>
        <Routes>
          <Route path="/t/:publicId" element={<TournamentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const selector = await screen.findByRole("combobox", {
    name: "Filter by round",
  });
  expect(
    screen.getByRole("button", { name: /Groups · Round 1.*1 of 1 played/ }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.getByRole("button", { name: /Groups · Round 2.*0 of 1 played/ }),
  ).toHaveAttribute("aria-expanded", "true");
  await userEvent.selectOptions(selector, "KNOCKOUT:1");
  expect(
    screen.queryByRole("button", { name: /Groups · Round/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Knockout · Round 1/ }),
  ).toHaveAttribute("aria-expanded", "true");
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Filter fixture status" }),
    "PLAYED",
  );
  expect(screen.getByRole("combobox", { name: "Filter by round" })).toHaveValue(
    "ALL",
  );
  expect(
    screen.getByRole("button", { name: /Groups · Round 1/ }),
  ).toBeVisible();
  cache.clear();
});

test("tournament actions open from the title menu", async (): Promise<void> => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  cache.setQueryData(["session"], {
    csrf: "csrf",
    user: {
      id: "owner",
      name: "Admin",
      email: "admin@example.test",
      hasPassword: true,
      googleLinked: false,
    },
    googleEnabled: false,
  });
  vi.spyOn(api, "get").mockResolvedValue(tournament);
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={["/manage/tournament-id"]}>
        <Routes>
          <Route path="/manage/:id" element={<TournamentPage admin />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Tournament actions" }),
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Edit tournament name" }),
  );
  expect(await screen.findByRole("dialog")).toBeVisible();
  cache.clear();
});

test("a round with more than fifty fixtures is available in full", async (): Promise<void> => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  vi.spyOn(api, "public").mockResolvedValue({
    ...tournament,
    matches: Array.from(
      { length: 60 },
      (_value: unknown, index: number): typeof match => ({
        ...match,
        id: `match-${index}`,
        homeScore: null,
        awayScore: null,
      }),
    ),
  });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter
        initialEntries={["/t/ARENA2026?tab=fixtures&fixturesPage=2"]}
      >
        <Routes>
          <Route path="/t/:publicId" element={<TournamentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const round = await screen.findByRole("button", {
    name: /League · Round 1.*0 of 60 played/,
  });
  expect(screen.getAllByText("VS")).toHaveLength(60);
  await userEvent.click(round);
  expect(screen.queryByText("VS")).not.toBeInTheDocument();
  await userEvent.click(round);
  expect(screen.getAllByText("VS")).toHaveLength(60);
  cache.clear();
});

function showOrganizerPage(
  value: typeof tournament,
  path: string = "/manage/tournament-id?tab=fixtures",
): QueryClient {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  cache.setQueryData(["session"], {
    csrf: "csrf",
    user: {
      id: "owner",
      name: "Admin",
      email: "admin@example.test",
      hasPassword: true,
      googleLinked: false,
    },
    googleEnabled: false,
  });
  vi.spyOn(api, "get").mockResolvedValue(value);
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/manage/:id" element={<TournamentPage admin />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}

test("fixture progress is global and result actions respect dropdown filters", async (): Promise<void> => {
  const cache = showOrganizerPage({
    ...tournament,
    matches: [
      match,
      { ...match, id: "pending", round: 2, homeScore: null, awayScore: null },
    ],
  });
  expect(await screen.findByText("1/2 matches played")).toBeVisible();
  expect(
    screen.queryByRole("group", { name: "Fixture status shortcuts" }),
  ).not.toBeInTheDocument();
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Filter fixture status" }),
    "PENDING",
  );
  expect(screen.getByText("1/2 matches played")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Add result: Alpha vs Beta, round 2" }),
  ).toHaveTextContent(/^Add$/);
  expect(
    screen.queryByRole("button", { name: /Edit result:/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Add result: Alpha vs Beta, round 2" }),
  );
  expect(
    await screen.findByRole("dialog", { name: "Make the result official" }),
  ).toBeVisible();
  expect(screen.getByText(/Round 2 ·/)).toBeInTheDocument();
  cache.clear();
});

test("standings explain provisional qualification, the cutoff, and score abbreviations", async (): Promise<void> => {
  const cache = showOrganizerPage(
    {
      ...tournament,
      format: "WORLD_CUP",
      groups: [{ id: "g", name: "Group A", qualifierCount: 1 }],
      standings: [
        {
          scope: "g",
          rows: tournament.entrants.map(
            (
              entrant: (typeof tournament.entrants)[number],
              index: number,
            ): (typeof tournament.standings)[number]["rows"][number] => ({
              entrantId: entrant.id,
              name: entrant.name,
              rank: index + 1,
              played: 0,
              won: 0,
              drawn: 0,
              lost: 0,
              scoreFor: 0,
              scoreAgainst: 0,
              difference: 0,
              points: 0,
              tieSignature: null,
              tieResolved: false,
            }),
          ),
        },
      ],
    },
    "/manage/tournament-id?tab=standings",
  );
  const qualification = await screen.findByRole("button", {
    name: "Qualification places for Group A: Top 1",
  });
  expect(qualification).toHaveTextContent("Top 1");
  expect(
    screen.queryByText("Current qualification positions"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Qualification cutoff")).not.toBeInTheDocument();
  await userEvent.click(qualification);
  expect(screen.getByRole("tooltip")).toHaveTextContent("provisional");
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  await userEvent.click(screen.getByText("Table guide & tie-break rules"));
  expect(screen.getByText("Score for")).toBeVisible();
  expect(
    screen.getByText(/Points, then score difference, then score for/),
  ).toBeVisible();
  cache.clear();
});

test("Save & next match opens a fresh draft using the returned revisions", async (): Promise<void> => {
  const first = { ...match, homeScore: null, awayScore: null };
  const second = { ...first, id: "next", round: 2 };
  const value = { ...tournament, matches: [first, second] };
  const updated = {
    ...value,
    revision: 2,
    matches: [
      { ...first, homeScore: 1, awayScore: 0, revision: 2 },
      { ...second, revision: 3 },
    ],
  };
  const cache = showOrganizerPage(value);
  vi.spyOn(api, "impact").mockResolvedValue({
    requiresReset: false,
    reason: null,
    roundIds: [],
    matchIds: [],
    resetQualification: false,
    impactToken: "impact",
    tournamentRevision: 1,
  });
  const save = vi
    .spyOn(api, "result")
    .mockImplementation((): Promise<typeof tournament> => {
      vi.mocked(api.get).mockResolvedValue(updated);
      return Promise.resolve(updated);
    });
  await userEvent.click(
    await screen.findByRole("button", {
      name: "Add result: Alpha vs Beta, round 1",
    }),
  );
  await userEvent.type(await screen.findByLabelText("Alpha score"), "1");
  await userEvent.type(screen.getByLabelText("Beta score"), "0");
  await userEvent.click(
    screen.getByRole("button", { name: "Save & next match" }),
  );
  await waitFor((): void => {
    expect(screen.getByText(/Round 2 ·/)).toBeVisible();
  });
  expect(screen.getByLabelText("Alpha score")).toHaveValue(null);
  expect(screen.getByLabelText("Alpha score")).toHaveFocus();
  expect(
    screen.queryByRole("button", { name: "Save & next match" }),
  ).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Alpha score"), "2");
  await userEvent.type(screen.getByLabelText("Beta score"), "1");
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  await waitFor((): void =>
    expect(save).toHaveBeenLastCalledWith(
      "next",
      expect.objectContaining({
        expectedRevision: 3,
        expectedTournamentRevision: 2,
      }),
    ),
  );
  cache.clear();
});

test("result entry respects a selected round and does not offer next outside that round", async (): Promise<void> => {
  const pending = { ...match, homeScore: null, awayScore: null };
  const cache = showOrganizerPage(
    {
      ...tournament,
      matches: [pending, { ...pending, id: "second", round: 2 }],
    },
    "/manage/tournament-id?tab=fixtures&round=LEAGUE%3A2",
  );
  await userEvent.click(
    await screen.findByRole("button", {
      name: "Add result: Alpha vs Beta, round 2",
    }),
  );
  expect(await screen.findByText(/Round 2 ·/)).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Save & next match" }),
  ).not.toBeInTheDocument();
  cache.clear();
});

test("the title menu groups tournament tools, stats, sharing, and public viewing and dismisses accessibly", async (): Promise<void> => {
  const cache = showOrganizerPage({ ...tournament, statsEnabled: true });
  const trigger = await screen.findByRole("button", {
    name: "Tournament actions",
  });
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.queryByRole("button", { name: "Share tournament" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Public page" }),
  ).not.toBeInTheDocument();
  await userEvent.click(trigger);
  expect(screen.getByRole("button", { name: "Add teams" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Archive stats" })).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Share tournament" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Public page" })).toHaveAttribute(
    "href",
    "/t/ARENA2026",
  );
  await userEvent.keyboard("{Tab}");
  expect(
    screen.getByRole("button", { name: "Edit tournament name" }),
  ).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(trigger);
  await userEvent.click(screen.getByRole("heading", { name: "Test league" }));
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  cache.clear();
});

test("changing a fixture filter resets expanded rounds without changing global progress", async (): Promise<void> => {
  const cache = showOrganizerPage({
    ...tournament,
    matches: [
      match,
      { ...match, id: "second", round: 2, homeScore: null, awayScore: null },
      { ...match, id: "third", round: 3, homeScore: null, awayScore: null },
    ],
  });
  await userEvent.click(
    await screen.findByRole("button", { name: "Expand all" }),
  );
  expect(
    screen.getByRole("button", { name: /League · Round 1/ }),
  ).toHaveAttribute("aria-expanded", "true");
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Filter by team" }),
    "home",
  );
  expect(
    screen.getByRole("button", { name: /League · Round 1/ }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    screen.getByRole("button", { name: /League · Round 2/ }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(
    screen.getByRole("button", { name: /League · Round 3/ }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByText("1/3 matches played")).toBeVisible();
  cache.clear();
});
