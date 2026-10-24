import { useState, type ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import type { Match } from "../../shared/api/arena-api";
import { match } from "../../test/fixtures";
import { FixtureRounds } from "./fixture-rounds";
const matches: Match[] = [
  match,
  { ...match, id: "second", round: 2, homeScore: null, awayScore: null },
  { ...match, id: "third", round: 3, homeScore: null, awayScore: null },
];
function Rounds(): ReactElement {
  const [round, setRound] = useState<string>("ALL");
  return (
    <FixtureRounds
      matches={matches}
      selectedRound={round}
      onRoundChange={setRound}
      renderMatch={(fixture: Match): ReactElement => (
        <button>{fixture.id}</button>
      )}
    />
  );
}
test("rounds expand individually or together and reset for a selected round", async (): Promise<void> => {
  render(<Rounds />);
  expect(
    screen.queryByRole("button", { name: "match-id" }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "second" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Expand all" }));
  expect(screen.getByRole("button", { name: "third" })).toBeVisible();
  expect(screen.getByRole("button", { name: "match-id" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Collapse all" }));
  expect(
    screen.queryByRole("button", { name: "second" }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: /League · Round 3/ }),
  );
  expect(screen.getByRole("button", { name: "third" })).toBeVisible();
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: "Filter by round" }),
    "LEAGUE:2",
  );
  expect(screen.getByRole("button", { name: "second" })).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Expand all" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText(/fixtures · Play in any order/),
  ).not.toBeInTheDocument();
});

test("an empty fixture view has no expansion actions or round headings", (): void => {
  render(
    <FixtureRounds
      matches={[]}
      selectedRound="ALL"
      onRoundChange={(): void => {}}
      renderMatch={(fixture: Match): ReactElement => <span>{fixture.id}</span>}
    />,
  );
  expect(screen.getByRole("combobox", { name: "Filter by round" })).toHaveValue(
    "ALL",
  );
  expect(
    screen.queryByRole("button", { name: "Expand all" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("heading")).not.toBeInTheDocument();
});
