import { describe, expect, it } from "vitest";
import { mergeSuggestedScores, swapDraftScores } from "./suggestion-draft";
describe("scorecard drafts", (): void => {
  it("swaps a complete result without mutating it and restores it on a second swap", (): void => {
    const draft = {
      home: "0",
      away: "",
      homeTiebreak: "4",
      awayTiebreak: "5",
      winner: "away",
    };
    const context = { homeId: "home", awayId: "away", aggregate: false };
    const swapped = swapDraftScores(draft, context);
    expect(swapped).toEqual({
      home: "",
      away: "0",
      homeTiebreak: "5",
      awayTiebreak: "4",
      winner: "home",
    });
    expect(swapDraftScores(swapped, context)).toEqual(draft);
    expect(draft.home).toBe("0");
  });
  it("clears decisions belonging to the full aggregate when only one leg is swapped", (): void => {
    expect(
      swapDraftScores(
        {
          home: "2",
          away: "1",
          homeTiebreak: "4",
          awayTiebreak: "5",
          winner: "away",
        },
        { homeId: "home", awayId: "away", aggregate: true },
      ),
    ).toEqual({
      home: "1",
      away: "2",
      homeTiebreak: "",
      awayTiebreak: "",
      winner: "",
    });
  });
  it("preserves fields edited during extraction and fills untouched fields", (): void => {
    const draft = {
      home: "7",
      away: "",
      homeTiebreak: "",
      awayTiebreak: "",
      winner: "",
    };
    const merged = mergeSuggestedScores(
      draft,
      { home: 2, away: 1 },
      new Set(["home"]),
    );
    expect(merged.home).toBe("7");
    expect(merged.away).toBe("1");
    expect(draft.away).toBe("");
  });
  it("does not fill unreadable scores with zero", (): void => {
    const merged = mergeSuggestedScores(
      { home: "", away: "", homeTiebreak: "", awayTiebreak: "", winner: "" },
      { home: null, away: 0 },
      new Set(),
    );
    expect(merged.home).toBe("");
    expect(merged.away).toBe("0");
  });
});
