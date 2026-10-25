import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { match, tournament } from "../../test/fixtures";
import { KnockoutBoard } from "./knockout-board";

test("public played knockout matches expose a read-only stats action", async (): Promise<void> => {
  const onViewStats = vi.fn<(selected: typeof match) => void>();
  const onSelect = vi.fn();
  const competition = {
    ...tournament,
    statsEnabled: true,
    rounds: [{ id: "round-1", number: 1, method: "MANUAL" as const, byes: [] }],
    knockoutTies: [
      {
        id: "tie-1",
        roundId: "round-1",
        slot: 0,
        homeId: "home",
        awayId: "away",
        legs: 1,
        homeTiebreak: null,
        awayTiebreak: null,
        winnerId: "home",
        homeAggregate: 2,
        awayAggregate: 0,
      },
    ],
    matches: [
      {
        ...match,
        stage: "KNOCKOUT" as const,
        scope: "KNOCKOUT",
        knockoutTieId: "tie-1",
      },
    ],
  };
  render(
    <KnockoutBoard
      t={competition}
      admin={false}
      onSelect={onSelect}
      onViewStats={onViewStats}
    />,
  );

  const button = screen.getByRole("button", {
    name: "View stats: Alpha vs Beta, leg 1",
  });
  expect(button).toBeEnabled();
  await userEvent.click(button);
  expect(onViewStats).toHaveBeenCalledWith(competition.matches[0]);
  expect(onSelect).not.toHaveBeenCalled();
});
