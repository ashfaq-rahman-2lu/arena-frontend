import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, test, vi } from "vitest";
import {
  api,
  type TeamStats,
  type Tournament,
} from "../../shared/api/arena-api";
import { tournament } from "../../test/fixtures";
import { TournamentPage } from "./tournament-page";

const competition: Tournament = { ...tournament, statsEnabled: true };
const definitions: [string, string][] = [
  ["possession", "Possession"],
  ["shots", "Shots"],
  ["shotsOnTarget", "Shots on target"],
  ["fouls", "Fouls"],
  ["offsides", "Offsides"],
  ["cornerKicks", "Corner kicks"],
  ["freeKicks", "Free kicks"],
  ["passes", "Passes"],
  ["successfulPasses", "Successful passes"],
  ["crosses", "Crosses"],
  ["interceptions", "Interceptions"],
  ["tackles", "Tackles"],
  ["saves", "Saves"],
];
const stats: TeamStats = {
  enabled: true,
  teams: ["Charlie", "Bravo", "Alpha", "Delta", "Echo", "Foxtrot", "Golf"].map(
    (name: string): TeamStats["teams"][number] => ({
      entrantId: name.toLowerCase(),
      name,
      stats: definitions.map(
        ([key, label]: [
          string,
          string,
        ]): TeamStats["teams"][number]["stats"][number] => ({
          key,
          label,
          unit: key === "possession" ? "percent" : "count",
          value:
            name === "Alpha"
              ? null
              : key === "possession"
                ? 55.5
                : name === "Bravo"
                  ? 0
                  : 12,
          recordedMatches: name === "Alpha" ? 0 : 2,
          playedMatches: 5,
        }),
      ),
    }),
  ),
};
function show(
  admin: boolean = true,
  teamStats: TeamStats = stats,
): QueryClient {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  cache.setQueryData(["session"], {
    csrf: "csrf",
    googleEnabled: false,
    user: {
      id: "owner",
      name: "Admin",
      email: "admin@example.test",
      hasPassword: true,
      googleLinked: false,
    },
  });
  vi.spyOn(api, "get").mockImplementation(
    async (id: string): Promise<Tournament> => ({ ...competition, id }),
  );
  vi.spyOn(api, "public").mockResolvedValue(competition);
  vi.spyOn(api, "teamStats").mockResolvedValue(structuredClone(teamStats));
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter
        initialEntries={[
          admin ? "/manage/tournament-id?tab=stats" : "/t/ARENA2026?tab=stats",
        ]}
      >
        <Link to="/manage/other?tab=stats">Other tournament</Link>
        <Routes>
          <Route
            path={admin ? "/manage/:id" : "/t/:publicId"}
            element={<TournamentPage admin={admin} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}
async function compare(name: string): Promise<void> {
  await userEvent.selectOptions(
    await screen.findByRole("combobox", { name: "Compare with" }),
    name.toLowerCase(),
  );
}
test("single team defaults alphabetically to recorded data and preserves zero, units and coverage", async (): Promise<void> => {
  const cache = show();
  const selector = await screen.findByRole("combobox", {
    name: "Team",
  });
  expect(selector).toHaveValue("bravo");
  expect(
    within(selector)
      .getAllByRole("option")
      .map((option: HTMLElement): string => option.textContent ?? ""),
  ).toEqual([
    "Choose a team",
    "Alpha",
    "Bravo",
    "Charlie",
    "Delta",
    "Echo",
    "Foxtrot",
    "Golf",
  ]);
  const table = await screen.findByRole("table");
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((header: HTMLElement): string => header.textContent ?? ""),
  ).toEqual(["Stat", "Bravo"]);
  expect(
    within(table).getByRole("row", {
      name: /Possession 55.5% 2 recorded matches \/ 5 matches played/,
    }),
  ).toBeVisible();
  const shotsRow = within(table).getByRole("row", {
    name: /Shots \(on target\)/,
  });
  expect(within(shotsRow).getByText("0 (0)")).toBeVisible();
  expect(
    within(table)
      .getAllByRole("row")
      .slice(1)
      .map(
        (row: HTMLElement): string =>
          row.querySelector("th")?.textContent ?? "",
      ),
  ).toEqual([
    "Possession",
    "Shots (on target)",
    "Shot accuracy",
    "Passes (successful)",
    "Pass accuracy",
  ]);
  expect(within(table).getAllByRole("row")).toHaveLength(6);
  await userEvent.click(screen.getByRole("button", { name: "Show all stats" }));
  expect(within(table).getAllByRole("row")).toHaveLength(14);
  expect(
    within(table)
      .getAllByRole("row")
      .slice(6)
      .map(
        (row: HTMLElement): string =>
          row.querySelector("th")?.textContent ?? "",
      ),
  ).toEqual([
    "Free kicks",
    "Corner kicks",
    "Crosses",
    "Offsides",
    "Fouls",
    "Interceptions",
    "Tackles",
    "Saves",
  ]);
  await userEvent.click(screen.getByRole("button", { name: "Show key stats" }));
  expect(within(table).getAllByRole("row")).toHaveLength(6);
  cache.clear();
});

test("paired totals, rounded accuracy rates, source coverage, zeros and missing values render correctly", async (): Promise<void> => {
  const data = structuredClone(stats);
  const setValue = (
    teamName: string,
    key: string,
    value: number | null,
    recordedMatches: number,
  ): void => {
    const team = data.teams.find(
      (entry: TeamStats["teams"][number]): boolean => entry.name === teamName,
    );
    const stat = team?.stats.find(
      (entry: TeamStats["teams"][number]["stats"][number]): boolean =>
        entry.key === key,
    );
    if (!stat) throw new Error(`Missing ${teamName} ${key} fixture stat`);
    stat.value = value;
    stat.recordedMatches = recordedMatches;
  };
  setValue("Bravo", "shots", 11, 4);
  setValue("Bravo", "shotsOnTarget", 9, 2);
  setValue("Bravo", "passes", 79, 3);
  setValue("Bravo", "successfulPasses", 57, 1);
  setValue("Delta", "shots", 10, 4);
  setValue("Delta", "shotsOnTarget", 0, 3);
  setValue("Delta", "passes", 20, 4);
  setValue("Delta", "successfulPasses", 0, 3);
  setValue("Echo", "shots", 10, 2);
  setValue("Echo", "shotsOnTarget", 8, 2);
  setValue("Echo", "passes", 10, 2);
  setValue("Echo", "successfulPasses", 8, 2);
  const cache = show(true, data);
  const table = await screen.findByRole("table");
  const shots = within(table).getByRole("row", { name: /Shots \(on target\)/ });
  expect(within(shots).getByText("11 (9)")).toBeVisible();
  expect(within(shots).getByText("2/5")).toHaveAccessibleName(
    "Shots: 4 recorded matches / 5 matches played; Shots on target: 2 recorded matches / 5 matches played",
  );
  expect(
    within(table).getByRole("row", { name: /Shot accuracy/ }),
  ).toHaveTextContent("81.8%");
  const shotAccuracy = within(table).getByRole("row", {
    name: /Shot accuracy/,
  });
  expect(within(shotAccuracy).getByText("2/5")).toHaveAccessibleName(
    "Shots on target: 2 recorded matches / 5 matches played; Shots: 4 recorded matches / 5 matches played",
  );
  expect(
    within(table).getByRole("row", { name: /Passes \(successful\)/ }),
  ).toHaveTextContent("79 (57)");
  expect(
    within(table).getByRole("row", { name: /Pass accuracy/ }),
  ).toHaveTextContent("72.2%");
  await compare("Charlie");
  expect(within(shotAccuracy).getByText("81.8%")).toBeVisible();
  expect(within(shotAccuracy).getByText("100%")).toBeVisible();
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Team" }),
    "echo",
  );
  expect(
    within(table).getByRole("row", { name: /Shot accuracy/ }),
  ).toHaveTextContent("80%");
  expect(
    within(table).getByRole("row", { name: /Pass accuracy/ }),
  ).toHaveTextContent("80%");
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Team" }),
    "delta",
  );
  expect(
    within(table).getByRole("row", { name: /Shot accuracy/ }),
  ).toHaveTextContent("0%");
  expect(
    within(table).getByRole("row", { name: /Pass accuracy/ }),
  ).toHaveTextContent("0%");
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Team" }),
    "alpha",
  );
  expect(
    within(table).getByRole("row", { name: /Shot accuracy/ }),
  ).toHaveTextContent("—");
  expect(
    within(table).getByRole("row", { name: /Pass accuracy/ }),
  ).toHaveTextContent("—");
  cache.clear();
});
test("two and more teams share a stat-first comparison layout without duplicates or a fixed limit", async (): Promise<void> => {
  const cache = show();
  await compare("Charlie");
  expect(
    screen
      .getAllByRole("columnheader")
      .map((header: HTMLElement): string => header.textContent ?? ""),
  ).toEqual(["Stat", "Bravo", "Charlie"]);
  expect(
    within(screen.getByRole("combobox", { name: "Compare with" })).queryByRole(
      "option",
      { name: "Bravo" },
    ),
  ).not.toBeInTheDocument();
  for (const name of ["Alpha", "Delta", "Echo", "Foxtrot", "Golf"])
    await compare(name);
  expect(screen.getAllByRole("columnheader")).toHaveLength(8);
  expect(screen.getByRole("combobox", { name: "Compare with" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Remove Bravo" }));
  expect(screen.getByRole("combobox", { name: "Team" })).toHaveValue("charlie");
  expect(screen.getAllByRole("columnheader")[1]).toHaveTextContent("Charlie");
  cache.clear();
});
test("selections survive tab changes, refresh values by stat key, and reset for another tournament", async (): Promise<void> => {
  const cache = show();
  await compare("Charlie");
  await userEvent.click(screen.getByRole("tab", { name: "Fixtures" }));
  await userEvent.click(screen.getByRole("tab", { name: "Team stats" }));
  expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  const updated = structuredClone(stats);
  updated.teams[0].stats.reverse();
  const shots = updated.teams[0].stats.find(
    (stat: TeamStats["teams"][number]["stats"][number]): boolean =>
      stat.key === "shots",
  );
  if (!shots) throw new Error("Missing fixture stat");
  shots.value = 33;
  vi.mocked(api.teamStats).mockResolvedValue(updated);
  await act(async (): Promise<void> => {
    cache.setQueryData(["team-stats", "ARENA2026", 1], updated);
  });
  const shotsRow = await screen.findByRole("row", {
    name: /Shots \(on target\)/,
  });
  expect(within(shotsRow).getByText("33 (12)")).toBeVisible();
  await userEvent.click(screen.getByRole("link", { name: "Other tournament" }));
  await waitFor((): void => {
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });
  expect(screen.getByRole("combobox", { name: "Team" })).toHaveValue("bravo");
  cache.clear();
});
test("removing every team shows a prompt and teams without recorded stats show missing values", async (): Promise<void> => {
  const cache = show();
  await userEvent.click(
    await screen.findByRole("button", { name: "Remove Bravo" }),
  );
  expect(screen.getByText("Choose a team to see its stats.")).toBeVisible();
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Team" }),
    "alpha",
  );
  expect(
    screen.getByText(
      "No match stats have been recorded for the selected team.",
    ),
  ).toBeVisible();
  expect(
    screen.getByRole("row", {
      name: /Possession — 0 recorded matches \/ 5 matches played/,
    }),
  ).toBeVisible();
  cache.clear();
});
test("public stats support comparison without owner-only menu actions", async (): Promise<void> => {
  const cache = show(false);
  await compare("Charlie");
  expect(screen.getAllByRole("columnheader")).toHaveLength(3);
  await userEvent.click(
    screen.getByRole("button", { name: "Tournament actions" }),
  );
  expect(
    screen.queryByRole("button", { name: "Archive stats" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: /Public page/ }),
  ).not.toBeInTheDocument();
  cache.clear();
});
test("stats show loading, retry errors, and an explicit empty tournament state", async (): Promise<void> => {
  const cache = show();
  vi.mocked(api.teamStats)
    .mockReset()
    .mockRejectedValueOnce(new Error("Offline"))
    .mockResolvedValue({ enabled: true, teams: [] });
  await waitFor((): void => {
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load team stats",
    );
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Retry team stats" }),
  );
  expect(
    await screen.findByText("No teams are available for stats yet."),
  ).toBeVisible();
  cache.clear();
});
test("initial loading resolves to alphabetical fallback without stats and retains the initial choice on refresh", async (): Promise<void> => {
  const cache = show();
  let finish: (value: TeamStats) => void = (): void => {
    throw new Error("Request not started");
  };
  vi.mocked(api.teamStats).mockImplementation(
    (): Promise<TeamStats> =>
      new Promise((resolve: (value: TeamStats) => void): void => {
        finish = resolve;
      }),
  );
  expect(await screen.findByText("Loading team stats…")).toBeVisible();
  const empty = structuredClone(stats);
  for (const team of empty.teams)
    for (const stat of team.stats) {
      stat.value = null;
      stat.recordedMatches = 0;
    }
  await act(async (): Promise<void> => {
    finish(empty);
  });
  expect(await screen.findByRole("combobox", { name: "Team" })).toHaveValue(
    "alpha",
  );
  expect(
    screen.getByText(/No match stats have been recorded yet/),
  ).toBeVisible();
  await act(async (): Promise<void> => {
    cache.setQueryData(["team-stats", "ARENA2026", 1], stats);
  });
  expect(screen.getByRole("combobox", { name: "Team" })).toHaveValue("alpha");
  cache.clear();
});

test("compact chips expose complete names without confusing duplicate first words", async (): Promise<void> => {
  const cache = show();
  await screen.findByRole("combobox", { name: "Team" });
  const changed = structuredClone(stats);
  changed.teams[0].name = "Bravo international championship";
  changed.teams[1].name = "Bravo regional championship";
  changed.teams[3].name = "Extraordinarilylong";
  await act(async (): Promise<void> => {
    cache.setQueryData(["team-stats", "ARENA2026", 1], changed);
  });
  await compare("Charlie");
  await compare("Delta");
  const chips = screen.getByRole("list", { name: "Selected teams" });
  expect(within(chips).getAllByText("Bravo…")).toHaveLength(2);
  expect(within(chips).getByText("Extraord…")).toBeVisible();
  const name = within(chips).getByRole("button", {
    name: "Show full team name: Bravo regional championship",
  });
  await userEvent.hover(name);
  expect(screen.getByRole("tooltip")).toHaveTextContent(
    "Bravo regional championship",
  );
  await userEvent.unhover(name);
  await userEvent.click(name);
  expect(screen.getByRole("tooltip")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(name).toHaveFocus();
  await userEvent.click(
    within(chips).getByRole("button", {
      name: "Remove Bravo regional championship",
    }),
  );
  expect(
    within(chips).getByRole("button", {
      name: "Remove Bravo international championship",
    }),
  ).toBeVisible();
  cache.clear();
});
test("stats information replaces the long visible guide and supports focus and dismissal", async (): Promise<void> => {
  const cache = show();
  const info = await screen.findByRole("button", { name: "Stats information" });
  expect(screen.queryByText(/Counts are totals/)).not.toBeInTheDocument();
  await userEvent.click(info);
  expect(screen.getByRole("tooltip")).toHaveTextContent(
    /possession is an average/,
  );
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  expect(info).toHaveFocus();
  const row = screen.getByRole("row", { name: /Possession/ });
  expect(within(row).getByText("2/5")).toHaveAccessibleName(
    "2 recorded matches / 5 matches played",
  );
  cache.clear();
});
