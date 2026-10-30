import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { api, type PublicMatchStats } from "../../shared/api/arena-api";
import { PublicMatchStatsDialog } from "./public-match-stats-dialog";

const stats: PublicMatchStats["stats"] = [
  { key: "shots", label: "Shots", unit: "count", home: 1, away: 4 },
  {
    key: "shotsOnTarget",
    label: "Shots on target",
    unit: "count",
    home: 0,
    away: 3,
  },
  { key: "passes", label: "Passes", unit: "count", home: 55, away: 73 },
  {
    key: "successfulPasses",
    label: "Successful passes",
    unit: "count",
    home: 40,
    away: 57,
  },
];

function show(entries: PublicMatchStats["stats"]): QueryClient {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  vi.spyOn(api, "publicMatchStats").mockResolvedValue({ stats: entries });
  render(
    <QueryClientProvider client={cache}>
      <PublicMatchStatsDialog
        publicId="ARENA2026"
        matchId="match-id"
        homeName="Northside FC"
        awayName="Blue Knights"
        onClose={(): void => {}}
      />
    </QueryClientProvider>,
  );
  return cache;
}

test("match stats show each side's accuracy beside its counts with Team stats precision", async (): Promise<void> => {
  const cache = show(stats);
  const shots = await screen.findByRole("row", { name: /^Shot accuracy/ });
  expect(within(shots).getAllByRole("cell")).toHaveLength(2);
  expect(within(shots).getByText("0%")).toBeVisible();
  expect(within(shots).getByText("75%")).toBeVisible();
  const passes = screen.getByRole("row", { name: /^Pass accuracy/ });
  expect(within(passes).getByText("72.7%")).toBeVisible();
  expect(within(passes).getByText("78.1%")).toBeVisible();
  expect(
    screen
      .getAllByRole("rowheader")
      .map((cell: HTMLElement): string | null => cell.textContent),
  ).toEqual([
    "Shots",
    "Shots on target",
    "Shot accuracy",
    "Passes",
    "Successful passes",
    "Pass accuracy",
  ]);
  cache.clear();
});

test("zero attempts show unavailable accuracy instead of dividing by zero", async (): Promise<void> => {
  const cache = show(
    stats.map(
      (
        stat: PublicMatchStats["stats"][number],
      ): PublicMatchStats["stats"][number] => ({ ...stat, home: 0, away: 0 }),
    ),
  );
  const shots = await screen.findByRole("row", { name: /^Shot accuracy/ });
  expect(within(shots).getAllByText("—")).toHaveLength(2);
  expect(
    within(screen.getByRole("row", { name: /^Pass accuracy/ })).getAllByText(
      "—",
    ),
  ).toHaveLength(2);
  cache.clear();
});

test("missing values stay unavailable independently for each side", async (): Promise<void> => {
  const cache = show(
    stats.map(
      (
        stat: PublicMatchStats["stats"][number],
      ): PublicMatchStats["stats"][number] => ({
        ...stat,
        home: stat.key === "shotsOnTarget" ? null : stat.home,
        away: stat.key === "passes" ? null : stat.away,
      }),
    ),
  );
  const shots = await screen.findByRole("row", { name: /^Shot accuracy/ });
  expect(within(shots).getByText("—")).toBeVisible();
  expect(within(shots).getByText("75%")).toBeVisible();
  const passes = screen.getByRole("row", { name: /^Pass accuracy/ });
  expect(within(passes).getByText("72.7%")).toBeVisible();
  expect(within(passes).getByText("—")).toBeVisible();
  cache.clear();
});

test("omitted source stats show unavailable accuracy without inventing values", async (): Promise<void> => {
  const cache = show(
    stats.filter(
      (stat: PublicMatchStats["stats"][number]): boolean =>
        stat.key !== "shotsOnTarget" && stat.key !== "passes",
    ),
  );
  const shots = await screen.findByRole("row", { name: /^Shot accuracy/ });
  expect(within(shots).getAllByText("—")).toHaveLength(2);
  expect(
    within(screen.getByRole("row", { name: /^Pass accuracy/ })).getAllByText(
      "—",
    ),
  ).toHaveLength(2);
  cache.clear();
});

test("unrecorded matches keep the empty state", async (): Promise<void> => {
  const cache = show([]);
  expect(
    await screen.findByText("No match stats were recorded for this match."),
  ).toBeVisible();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  cache.clear();
});
