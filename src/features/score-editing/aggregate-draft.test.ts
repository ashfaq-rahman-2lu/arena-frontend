import { expect, test } from "vitest";
import { match, tournament } from "../../test/fixtures";
import type { Match, Tournament } from "../../shared/api/arena-api";
import { resultPayload } from "./score-draft";
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
  homeScore: null,
  awayScore: null,
  winnerId: null,
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
      awayAggregate: 0,
      homeTiebreak: null,
      awayTiebreak: null,
      winnerId: null,
    },
  ],
};
test("drawn first legs do not require a winner", (): void => {
  expect(
    resultPayload(
      { home: "0", away: "0", homeTiebreak: "", awayTiebreak: "", winner: "" },
      first,
      t.revision,
      false,
      t,
    ),
  ).toMatchObject({ homeScore: 0, awayScore: 0, winnerId: null });
});
test("aggregate decisions use canonical team identities even when leg two is not drawn", (): void => {
  expect(
    resultPayload(
      {
        home: "2",
        away: "0",
        homeTiebreak: "3",
        awayTiebreak: "4",
        winner: "",
      },
      second,
      t.revision,
      false,
      t,
    ),
  ).toMatchObject({
    homeScore: 2,
    awayScore: 0,
    knockoutDecision: {
      homeTiebreak: 3,
      awayTiebreak: 4,
      winnerId: first.awayId,
    },
  });
});
