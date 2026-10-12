import { describe, expect, it } from "vitest";
import { mergeSuggestedScores } from "./suggestion-draft";
describe("scorecard drafts", (): void => {
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
