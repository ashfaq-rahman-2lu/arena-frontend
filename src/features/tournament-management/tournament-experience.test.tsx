import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api, ApiError, type Tournament } from "../../shared/api/arena-api";
import { match, tournament } from "../../test/fixtures";
import { TournamentPage } from "./tournament-page";

function showCompetition(
  value: Tournament,
  tab: string,
  admin: boolean = false,
  initialError?: ApiError,
): QueryClient {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const session = {
    csrf: "csrf",
    user: admin
      ? {
          id: "owner",
          name: "Admin",
          email: "admin@example.test",
          hasPassword: true,
          googleLinked: false,
        }
      : null,
    googleEnabled: false,
  };
  vi.spyOn(api, "session").mockResolvedValue(session);
  cache.setQueryData(["session"], session);
  if (admin) vi.spyOn(api, "get").mockResolvedValue(value);
  else if (initialError)
    vi.spyOn(api, "public").mockRejectedValue(initialError);
  else vi.spyOn(api, "public").mockResolvedValue(value);
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter
        initialEntries={[
          admin
            ? `/manage/tournament-id?tab=${tab}`
            : `/t/ARENA2026?tab=${tab}`,
        ]}
      >
        <Routes>
          <Route path="/manage/:id" element={<TournamentPage admin />} />
          <Route path="/t/:publicId" element={<TournamentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}
const groupTournament: Tournament = {
  ...tournament,
  format: "WORLD_CUP",
  currentStage: "GROUP",
  groups: [{ id: "g", name: "Group A", qualifierCount: 1 }],
  matches: [
    { ...match, stage: "GROUP", scope: "g", homeScore: null, awayScore: null },
  ],
  standings: [
    {
      scope: "g",
      rows: tournament.entrants.map(
        (
          entrant: Tournament["entrants"][number],
          index: number,
        ): Tournament["standings"][number]["rows"][number] => ({
          entrantId: entrant.id,
          name: entrant.name,
          rank: index + 1,
          played: 1,
          won: 0,
          drawn: 1,
          lost: 0,
          scoreFor: 1,
          scoreAgainst: 1,
          difference: 0,
          points: 1,
          tieSignature: "tie",
          tieResolved: false,
        }),
      ),
    },
  ],
};

test("lookup errors let spectators correct the ID without returning home", async (): Promise<void> => {
  const cache = showCompetition(
    tournament,
    "standings",
    false,
    new ApiError("No tournament found with that ID", 404, "NOT_FOUND"),
  );
  const input = await screen.findByRole("textbox", { name: /Tournament ID/ });
  expect(input).toHaveValue("ARENA2026");
  expect(
    screen.queryByRole("button", { name: "Try again" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  vi.mocked(api.public).mockResolvedValue({
    ...tournament,
    publicId: "NEWCODE99",
  });
  await userEvent.clear(input);
  await userEvent.type(input, "NEWCODE99");
  await userEvent.click(
    screen.getByRole("button", { name: "Find tournament" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Test league" }),
  ).toBeVisible();
  expect(api.public).toHaveBeenLastCalledWith(
    "NEWCODE99",
    expect.any(AbortSignal),
  );
  cache.clear();
});

test.each(["teams", "standings"])(
  "%s team names link to all that team's fixtures and reset restrictive filters",
  async (tab: string): Promise<void> => {
    const cache = showCompetition(
      {
        ...tournament,
        standings: [{ ...groupTournament.standings[0], scope: "LEAGUE" }],
      },
      `${tab}&status=PENDING&stage=KNOCKOUT&round=KNOCKOUT:9`,
    );
    const link = await screen.findByRole("link", {
      name: "View fixtures for Alpha",
    });
    await userEvent.click(link);
    expect(screen.getByRole("tab", { name: "Fixtures" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tabpanel", { name: "Fixtures" })).toHaveFocus();
    expect(
      screen.getByRole("combobox", { name: "Filter by team" }),
    ).toHaveValue("home");
    expect(
      screen.getByRole("combobox", { name: "Filter fixture status" }),
    ).toHaveValue("ALL");
    expect(
      screen.getByRole("combobox", { name: "Filter by round" }),
    ).toHaveValue("ALL");
    cache.clear();
  },
);

test("team progress excludes duplicate tournament totals and respects team selection", async (): Promise<void> => {
  const cache = showCompetition(
    {
      ...tournament,
      entrants: [
        ...tournament.entrants,
        { id: "third", name: "Gamma", aliases: [], groupId: null },
      ],
      matches: [
        match,
        { ...match, id: "pending", homeScore: null, awayScore: null },
        { ...match, id: "other", homeId: "away", awayId: "third" },
      ],
    },
    "fixtures&team=home",
  );
  expect(await screen.findByText("Alpha: 1/2 matches played")).toBeVisible();
  expect(
    screen.queryByText(/Tournament:.*matches played/),
  ).not.toBeInTheDocument();
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Filter fixture status" }),
    "PENDING",
  );
  expect(screen.getByText("Alpha: 1/2 matches played")).toBeVisible();
  cache.clear();
});

test("knockout guidance names unfinished groups and opens their remaining matches", async (): Promise<void> => {
  const cache = showCompetition(groupTournament, "knockout", true);
  expect(await screen.findByText("Group A: 1 match remaining")).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Finish group matches" }),
  );
  expect(screen.getByRole("combobox", { name: "Filter stage" })).toHaveValue(
    "GROUP",
  );
  expect(
    screen.getByRole("combobox", { name: "Filter fixture status" }),
  ).toHaveValue("PENDING");
  cache.clear();
});

test("knockout guidance identifies qualification cutoff ties and opens their standings", async (): Promise<void> => {
  const cache = showCompetition(
    {
      ...groupTournament,
      matches: [{ ...groupTournament.matches[0], homeScore: 1, awayScore: 1 }],
    },
    "knockout",
    true,
  );
  expect(
    await screen.findByText(
      "Group A: resolve the qualification tie between Alpha, Beta",
    ),
  ).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Resolve qualification ties" }),
  );
  expect(screen.getByRole("tabpanel", { name: "Standings" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Decide order" })).toBeVisible();
  cache.clear();
});

test("ready groups open the existing qualifier confirmation without qualifying automatically", async (): Promise<void> => {
  const qualify = vi.spyOn(api, "qualify");
  const cache = showCompetition(
    {
      ...groupTournament,
      matches: [{ ...groupTournament.matches[0], homeScore: 2, awayScore: 0 }],
      qualificationPreview: {
        groups: [{ groupId: "g", name: "Group A", entrantIds: ["home"] }],
        entrantIds: ["home"],
      },
    },
    "knockout",
    true,
  );
  const guidance = await screen.findByRole("region", {
    name: "Group qualification progress",
  });
  await userEvent.click(
    within(guidance).getByRole("button", { name: "Review qualifiers" }),
  );
  expect(
    await screen.findByRole("dialog", { name: "Confirm your qualifiers" }),
  ).toBeVisible();
  expect(qualify).not.toHaveBeenCalled();
  cache.clear();
});

test("public refresh status retains standings on failure and offers a recoverable retry", async (): Promise<void> => {
  const cache = showCompetition(tournament, "standings");
  expect(await screen.findByText(/Updated/)).toBeVisible();
  expect(screen.getByText(/Every 1 min/)).toBeVisible();
  vi.mocked(api.public).mockRejectedValue(new Error("Offline"));
  await act(async (): Promise<void> => {
    await cache.refetchQueries({ queryKey: ["public"] });
  });
  expect(await screen.findByText(/Couldn’t refresh/)).toBeVisible();
  expect(screen.getByRole("heading", { name: "Test league" })).toBeVisible();
  vi.mocked(api.public).mockResolvedValue(tournament);
  await userEvent.click(screen.getByRole("button", { name: "Refresh now" }));
  await waitFor((): void => {
    expect(screen.queryByText(/Couldn’t refresh/)).not.toBeInTheDocument();
  });
  cache.clear();
});
