import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { tournament } from "../../test/fixtures";
import { StandingsTable } from "./standings-table";

test("statistics are controlled by a labeled icon with a focus tooltip", async (): Promise<void> => {
  render(
    <StandingsTable
      tournament={tournament}
      standings={{ scope: "LEAGUE", rows: [] }}
    />,
  );
  const control = screen.getByRole("button", { name: "Show full statistics" });
  expect(control).toHaveTextContent(/^$/);
  expect(control).toHaveAttribute("aria-pressed", "false");
  control.focus();
  expect(await screen.findByRole("tooltip")).toHaveTextContent(
    "Show full statistics",
  );
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  await userEvent.keyboard("{Enter}");
  expect(
    screen.getByRole("button", { name: "Show key statistics" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("multiple group badges identify their count and confirmed qualification", async (): Promise<void> => {
  const value = { ...tournament, qualification: { entrantIds: ["home"] } };
  render(
    <>
      <StandingsTable
        tournament={value}
        standings={{ scope: "a", rows: [] }}
        group={{ id: "a", name: "Group A", qualifierCount: 2 }}
      />
      <StandingsTable
        tournament={value}
        standings={{ scope: "b", rows: [] }}
        group={{ id: "b", name: "Group B", qualifierCount: 4 }}
      />
    </>,
  );
  expect(
    screen.getByRole("button", {
      name: "Qualification places for Group A: Top 2",
    }),
  ).toHaveTextContent("Top 2");
  await userEvent.click(
    screen.getByRole("button", {
      name: "Qualification places for Group B: Top 4",
    }),
  );
  expect(screen.getByRole("tooltip")).toHaveTextContent("top 4 teams advance");
  expect(screen.getByRole("tooltip")).toHaveTextContent(
    "Qualification is confirmed",
  );
  expect(screen.queryByText("Qualification confirmed")).not.toBeInTheDocument();
});
