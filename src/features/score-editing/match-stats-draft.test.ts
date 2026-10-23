import { expect, test } from "vitest";
import {
  matchStatsPayload,
  statsFromMatch,
  MatchStatDraft,
} from "./match-stats-draft";
import type { Match } from "../../shared/api/arena-api";
type Stat = NonNullable<Match["stats"]>[number];

test("optional blank stats are omitted and zero remains an entered value", (): void => {
  const blank = statsFromMatch([]);
  expect(matchStatsPayload(blank)).toBeNull();
  const shots = blank.map((stat: MatchStatDraft): MatchStatDraft =>
    stat.key === "shots" ? { ...stat, home: "0" } : stat,
  );
  expect(
    matchStatsPayload(shots)?.find(
      (stat: Stat): boolean => stat.key === "shots",
    ),
  ).toMatchObject({ home: 0, away: null });
});
