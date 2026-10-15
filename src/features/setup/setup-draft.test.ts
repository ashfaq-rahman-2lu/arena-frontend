import { expect, test } from "vitest";
import type { Tournament } from "../../shared/api/arena-api";
import { tournament } from "../../test/fixtures";
import { SetupDraft, validateSetupDraft } from "./setup-draft";
const draft: SetupDraft = {
  name: "League",
  game: "EFOOTBALL",
  format: "LEAGUE",
  knockoutLegs: 1,
  knockoutFinalLegs: 1,
  legs: 1,
  winPoints: "3",
  drawPoints: "1",
  lossPoints: "0",
  entrants: [
    { clientId: "a", name: "Alpha", aliases: "", groupId: null },
    { clientId: "b", name: "Beta", aliases: "", groupId: null },
  ],
  groups: [],
};
test("empty numeric drafts do not become zero", (): void => {
  const result = validateSetupDraft({ ...draft, winPoints: "" });
  expect(result.valid).toBe(false);
  if (!result.valid) expect(typeof result.errors.winPoints).toBe("string");
});
test("trimmed duplicate names are rejected before submitting", (): void => {
  expect(
    validateSetupDraft({
      ...draft,
      entrants: [draft.entrants[0], { ...draft.entrants[1], name: " alpha " }],
    }),
  ).toMatchObject({ valid: false });
});
test("stable group IDs map to backend indexes only in the payload", (): void => {
  const result = validateSetupDraft({
    ...draft,
    format: "WORLD_CUP",
    groups: [{ clientId: "stable", name: "Group A", qualifierCount: "2" }],
    entrants: draft.entrants.map(
      (entrant: (typeof draft.entrants)[number]): typeof entrant => ({
        ...entrant,
        groupId: "stable",
      }),
    ),
  });
  expect(result).toMatchObject({
    valid: true,
    payload: {
      entrants: [{ groupIndex: 0 }, { groupIndex: 0 }],
      groups: [{ name: "Group A", qualifierCount: 2 }],
    },
  });
});
test("stale setup cannot be reapplied after the tournament starts", (): void => {
  const latest: Tournament = { ...tournament, status: "ACTIVE" };
  const result = validateSetupDraft(draft, latest);
  expect(result.valid).toBe(false);
});
test("knockout-only setup normalizes hidden round-robin settings even after incomplete league edits", (): void => {
  expect(
    validateSetupDraft({
      ...draft,
      format: "KNOCKOUT",
      legs: 2,
      winPoints: "",
      drawPoints: "",
      lossPoints: "",
    }),
  ).toMatchObject({
    valid: true,
    payload: {
      legs: 1,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      groups: [],
    },
  });
});
