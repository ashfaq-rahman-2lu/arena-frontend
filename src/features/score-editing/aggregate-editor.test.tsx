import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { match, tournament } from "../../test/fixtures";
import type { Match, Tournament } from "../../shared/api/arena-api";
import { MatchEditor } from "./match-editor";
test("editing either score clears a saved aggregate decision before it can be reused", async (): Promise<void> => {
  const first: Match = {
    ...match,
    id: "leg1",
    knockoutTieId: "tie",
    stage: "KNOCKOUT",
    leg: 1,
  };
  const second: Match = {
    ...first,
    id: "leg2",
    leg: 2,
    homeId: first.awayId,
    awayId: first.homeId,
  };
  const t: Tournament = {
    ...tournament,
    format: "KNOCKOUT",
    matches: [first, second],
    knockoutTies: [
      {
        id: "tie",
        roundId: "r",
        slot: 0,
        homeId: first.homeId,
        awayId: first.awayId,
        legs: 2,
        homeAggregate: 2,
        awayAggregate: 2,
        homeTiebreak: 4,
        awayTiebreak: 3,
        winnerId: first.homeId,
      },
    ],
  };
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MatchEditor t={t} match={second} onClose={vi.fn()} onSaved={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByLabelText("Winner of the tied aggregate")).toHaveValue(
    first.homeId,
  );
  await userEvent.clear(screen.getByLabelText("Alpha score"));
  await userEvent.type(screen.getByLabelText("Alpha score"), "1");
  await userEvent.clear(screen.getByLabelText("Beta score"));
  await userEvent.type(screen.getByLabelText("Beta score"), "3");
  expect(screen.getByLabelText("Winner of the tied aggregate")).toHaveValue("");
  expect(screen.getByLabelText("Alpha tiebreak (optional)")).toHaveValue(null);
  client.clear();
});
