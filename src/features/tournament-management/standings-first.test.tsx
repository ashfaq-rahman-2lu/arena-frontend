import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api, type Match, type Tournament } from "../../shared/api/arena-api";
import { match, tournament } from "../../test/fixtures";
import { TournamentPage } from "./tournament-page";

const reverse: Match = {
  ...match,
  id: "reverse",
  homeId: "away",
  awayId: "home",
  homeScore: null,
  awayScore: null,
  winnerId: null,
  round: 2,
  leg: 2,
  revision: 4,
};
const competition: Tournament = {
  ...tournament,
  legs: 2,
  entrants: [
    ...tournament.entrants,
    { id: "third", name: "Gamma", aliases: [], groupId: null },
  ],
  matches: [
    match,
    reverse,
    { ...reverse, id: "other", awayId: "third", round: 3 },
  ],
};
function RouteState(): React.JSX.Element {
  const location = useLocation();
  const navigation = useNavigationType();
  return (
    <output aria-label="Route state">
      {location.search} {navigation}
    </output>
  );
}
function show(
  value: Tournament = competition,
  path: string = "/manage/tournament-id",
  admin: boolean = true,
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
  vi.spyOn(api, "public").mockResolvedValue(value);
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path={admin ? "/manage/:id" : "/t/:publicId"}
            element={
              <>
                <TournamentPage admin={admin} />
                <RouteState />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}
async function pickTeams(): Promise<HTMLElement> {
  await userEvent.click(
    await screen.findByRole("button", { name: "Enter result" }),
  );
  const dialog = await screen.findByRole(
    "dialog",
    { name: "Enter result" },
    { timeout: 5000 },
  );
  await userEvent.selectOptions(
    within(dialog).getByLabelText("Home team"),
    "home",
  );
  await userEvent.selectOptions(
    within(dialog).getByLabelText("Away team"),
    "away",
  );
  return dialog;
}
function allowSave(): void {
  vi.spyOn(api, "impact").mockResolvedValue({
    requiresReset: false,
    reason: null,
    roundIds: [],
    matchIds: [],
    resetQualification: false,
    impactToken: "impact",
    tournamentRevision: 1,
  });
}

test("started competitions open standings with a compact summary and details only in information", async (): Promise<void> => {
  const cache = show();
  expect(await screen.findByRole("tab", { name: "Standings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByText("1/3 matches (33%)")).toBeVisible();
  expect(
    screen.queryByRole("link", { name: "My tournaments" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("ROUND ROBIN LEAGUE")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Tournament information" }),
  );
  const info = await screen.findByRole("dialog", {
    name: "Tournament information",
  });
  expect(within(info).getByText("Test league")).toBeVisible();
  expect(within(info).getByText("eFootball")).toBeVisible();
  expect(within(info).getByText("ARENA2026")).toBeVisible();
  expect(within(info).getByText("3")).toBeVisible();
  await userEvent.click(within(info).getByRole("button", { name: "Close" }));
  expect(
    screen.getByRole("button", { name: "Tournament information" }),
  ).toHaveFocus();
  cache.clear();
});
interface DefaultCase {
  format: Tournament["format"];
  status: Tournament["status"];
  tab: string;
  admin: boolean;
}
const cases: DefaultCase[] = [
  { format: "WORLD_CUP", status: "ACTIVE", tab: "Standings", admin: true },
  { format: "LEAGUE", status: "ACTIVE", tab: "Standings", admin: false },
  { format: "KNOCKOUT", status: "ACTIVE", tab: "Knockout", admin: true },
  { format: "LEAGUE", status: "DRAFT", tab: "Standings", admin: true },
];
test.each(cases)(
  "default view for $format/$status, owner=$admin",
  async ({ format, status, tab, admin }: DefaultCase): Promise<void> => {
    const cache = show(
      { ...competition, format, status, matches: [] },
      admin ? "/manage/tournament-id" : "/t/ARENA2026",
      admin,
    );
    expect(await screen.findByRole("tab", { name: tab })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getAllByRole("tab")[0]).toHaveTextContent(tab);
    expect(
      screen.queryByRole("tab", { name: "Overview" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("0/0 matches (0%)")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Enter result" }),
    ).not.toBeInTheDocument();
    cache.clear();
  },
);
test("explicit fixture links remain selected", async (): Promise<void> => {
  const cache = show(competition, "/manage/tournament-id?tab=fixtures");
  expect(await screen.findByRole("tab", { name: "Fixtures" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  cache.clear();
});
test("picker shows both directions, unplayed first, and requires explicit selection independently of fixture filters", async (): Promise<void> => {
  const cache = show(
    competition,
    "/manage/tournament-id?tab=fixtures&team=third&round=LEAGUE:3",
  );
  const dialog = await pickTeams();
  const actions = within(dialog).getAllByRole("button", {
    name: /Select fixture:/,
  });
  expect(actions).toHaveLength(2);
  expect(actions[0]).toHaveTextContent("Beta");
  expect(actions[0]).toHaveTextContent("To play");
  expect(actions[1]).toHaveTextContent("2 : 0");
  expect(
    screen.queryByRole("dialog", { name: "Make the result official" }),
  ).not.toBeInTheDocument();
  await userEvent.click(actions[0]);
  const editor = await screen.findByRole("dialog", {
    name: "Make the result official",
  });
  expect(within(editor).getByText(/Round 2/)).toBeVisible();
  await userEvent.click(within(editor).getByRole("button", { name: "Cancel" }));
  const picker = await screen.findByRole("dialog", { name: "Enter result" });
  expect(within(picker).getByLabelText("Home team")).toHaveValue("home");
  expect(within(picker).getByLabelText("Away team")).toHaveValue("away");
  expect(
    within(picker).getAllByRole("button", { name: /Select fixture:/ })[0],
  ).toHaveFocus();
  cache.clear();
});
test("picker prevents identical teams, updates choices, and handles unscheduled pairs", async (): Promise<void> => {
  const cache = show({ ...competition, matches: [match] });
  const dialog = await pickTeams();
  expect(
    within(dialog).getAllByRole("button", { name: /Select fixture:/ }),
  ).toHaveLength(1);
  expect(
    within(dialog)
      .getByLabelText("Away team")
      .querySelector('option[value="home"]'),
  ).toBeDisabled();
  await userEvent.selectOptions(
    within(dialog).getByLabelText("Away team"),
    "third",
  );
  expect(
    within(dialog).queryByRole("button", { name: /Select fixture:/ }),
  ).not.toBeInTheDocument();
  expect(within(dialog).getByText(/No scheduled matches/)).toBeVisible();
  await userEvent.selectOptions(
    within(dialog).getByLabelText("Home team"),
    "third",
  );
  expect(within(dialog).getByLabelText("Away team")).toHaveValue("");
  cache.clear();
});
test("picker save uses actual fixture orientation and revisions, then closes and focuses plus", async (): Promise<void> => {
  const cache = show();
  allowSave();
  const saved: Tournament = {
    ...competition,
    revision: 2,
    matches: competition.matches.map((entry: Match): Match =>
      entry.id === reverse.id
        ? { ...entry, homeScore: 3, awayScore: 1, revision: 5 }
        : entry,
    ),
  };
  const result = vi
    .spyOn(api, "result")
    .mockImplementation((): Promise<Tournament> => {
      vi.mocked(api.get).mockResolvedValue(saved);
      return Promise.resolve(saved);
    });
  const dialog = await pickTeams();
  await userEvent.click(
    within(dialog).getAllByRole("button", { name: /Select fixture:/ })[0],
  );
  await userEvent.type(await screen.findByLabelText("Beta score"), "3");
  await userEvent.type(screen.getByLabelText("Alpha score"), "1");
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  await waitFor((): void =>
    expect(result).toHaveBeenCalledWith(
      "reverse",
      expect.objectContaining({
        homeScore: 3,
        awayScore: 1,
        expectedRevision: 4,
        expectedTournamentRevision: 1,
      }),
    ),
  );
  await waitFor((): void => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  expect(screen.getByRole("button", { name: "Enter result" })).toHaveFocus();
  cache.clear();
});
test("pair-scoped Save & next uses returned revisions and never jumps to unrelated teams", async (): Promise<void> => {
  const first: Match = { ...match, homeScore: null, awayScore: null };
  const value: Tournament = {
    ...competition,
    matches: [first, reverse, competition.matches[2]],
  };
  const cache = show(value);
  allowSave();
  const updated: Tournament = {
    ...value,
    revision: 3,
    matches: [
      { ...first, homeScore: 1, awayScore: 0, revision: 2 },
      { ...reverse, revision: 6 },
      competition.matches[2],
    ],
  };
  const result = vi
    .spyOn(api, "result")
    .mockImplementation((): Promise<Tournament> => {
      vi.mocked(api.get).mockResolvedValue(updated);
      return Promise.resolve(updated);
    });
  const dialog = await pickTeams();
  await userEvent.click(
    within(dialog).getAllByRole("button", { name: /Select fixture:/ })[0],
  );
  await userEvent.type(await screen.findByLabelText("Alpha score"), "1");
  await userEvent.type(screen.getByLabelText("Beta score"), "0");
  await userEvent.click(
    screen.getByRole("button", { name: "Save & next match" }),
  );
  await waitFor((): void => {
    expect(screen.getByText(/Round 2 ·/)).toBeVisible();
  });
  expect(screen.getByLabelText("Beta score")).toHaveFocus();
  expect(screen.getByLabelText("Beta score")).toHaveValue(null);
  expect(
    screen.queryByRole("button", { name: "Save & next match" }),
  ).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Beta score"), "2");
  await userEvent.type(screen.getByLabelText("Alpha score"), "0");
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  await waitFor((): void =>
    expect(result).toHaveBeenLastCalledWith(
      "reverse",
      expect.objectContaining({
        expectedRevision: 6,
        expectedTournamentRevision: 3,
      }),
    ),
  );
  cache.clear();
});
test("a failed pair save retains the editor and draft", async (): Promise<void> => {
  const cache = show();
  allowSave();
  vi.spyOn(api, "result").mockRejectedValue(new Error("Save failed; retry"));
  const dialog = await pickTeams();
  await userEvent.click(
    within(dialog).getAllByRole("button", { name: /Select fixture:/ })[0],
  );
  await userEvent.type(await screen.findByLabelText("Beta score"), "1");
  await userEvent.type(screen.getByLabelText("Alpha score"), "0");
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Save failed; retry",
  );
  expect(screen.getByLabelText("Beta score")).toHaveValue(1);
  expect(
    screen.queryByRole("dialog", { name: "Enter result" }),
  ).not.toBeInTheDocument();
  cache.clear();
});

test("legacy overview links replace history while preserving filters", async (): Promise<void> => {
  const cache = show(
    competition,
    "/manage/tournament-id?tab=overview&team=third&round=LEAGUE%3A3",
  );
  await waitFor((): void => {
    expect(screen.getByLabelText("Route state")).toHaveTextContent(
      "tab=standings&team=third&round=LEAGUE%3A3 REPLACE",
    );
  });
  expect(screen.getByRole("tabpanel", { name: "Standings" })).toBeVisible();
  cache.clear();
});
test("drafts retain setup actions and explain empty standings", async (): Promise<void> => {
  const cache = show({
    ...competition,
    status: "DRAFT",
    standings: [],
    matches: [],
  });
  expect(
    await screen.findByText(
      "Standings will appear when the tournament starts.",
    ),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Edit setup" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Review & start" })).toBeVisible();
  cache.clear();
});
