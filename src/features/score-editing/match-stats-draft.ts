import type { Match } from "../../shared/api/arena-api";

export type MatchStat = NonNullable<Match["stats"]>[number];
export interface MatchStatDraft {
  key: MatchStat["key"];
  label: string;
  unit: MatchStat["unit"];
  home: string;
  away: string;
}

const statDefinitions: Pick<MatchStatDraft, "key" | "label" | "unit">[] = [
  { key: "possession", label: "Possession", unit: "percent" },
  { key: "shots", label: "Shots", unit: "count" },
  { key: "shotsOnTarget", label: "Shots on target", unit: "count" },
  { key: "fouls", label: "Fouls", unit: "count" },
  { key: "offsides", label: "Offsides", unit: "count" },
  { key: "cornerKicks", label: "Corner kicks", unit: "count" },
  { key: "freeKicks", label: "Free kicks", unit: "count" },
  { key: "passes", label: "Passes", unit: "count" },
  { key: "successfulPasses", label: "Successful passes", unit: "count" },
  { key: "crosses", label: "Crosses", unit: "count" },
  { key: "interceptions", label: "Interceptions", unit: "count" },
  { key: "tackles", label: "Tackles", unit: "count" },
  { key: "saves", label: "Saves", unit: "count" },
];

export function statsFromMatch(stats: MatchStat[] | null): MatchStatDraft[] {
  return statDefinitions.map(
    (
      definition: Pick<MatchStatDraft, "key" | "label" | "unit">,
    ): MatchStatDraft => {
      const stored = stats?.find(
        (stat: MatchStat): boolean => stat.key === definition.key,
      );
      return {
        ...definition,
        home: stored?.home == null ? "" : String(stored.home),
        away: stored?.away == null ? "" : String(stored.away),
      };
    },
  );
}

export function matchStatsPayload(draft: MatchStatDraft[]): MatchStat[] | null {
  const values: MatchStat[] = draft.map((stat: MatchStatDraft): MatchStat => {
    const value = (input: string): number | null => {
      if (input === "") return null;
      if (!/^\d+$/.test(input))
        throw new Error(`${stat.label} must be a whole number.`);
      const parsed = Number(input);
      if (
        !Number.isSafeInteger(parsed) ||
        parsed > (stat.unit === "percent" ? 100 : 9999)
      )
        throw new Error(`${stat.label} is outside the allowed range.`);
      return parsed;
    };
    return {
      key: stat.key,
      label: stat.label,
      unit: stat.unit,
      home: value(stat.home),
      away: value(stat.away),
    };
  });
  return values.some(
    (stat: MatchStat): boolean => stat.home !== null || stat.away !== null,
  )
    ? values
    : null;
}
