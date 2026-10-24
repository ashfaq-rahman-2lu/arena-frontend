import type { Match, Tournament } from "../../shared/api/arena-api";
export interface ResultTeamPair {
  homeId: string;
  awayId: string;
}
export function pairFixtures(
  tournament: Tournament,
  pair: ResultTeamPair,
): Match[] {
  if (!pair.homeId || !pair.awayId || pair.homeId === pair.awayId) return [];
  return tournament.matches
    .filter(
      (match: Match): boolean =>
        (match.homeId === pair.homeId && match.awayId === pair.awayId) ||
        (match.homeId === pair.awayId && match.awayId === pair.homeId),
    )
    .sort(
      (a: Match, b: Match): number =>
        Number(a.homeScore !== null) - Number(b.homeScore !== null) ||
        Number(a.stage === "KNOCKOUT") - Number(b.stage === "KNOCKOUT") ||
        a.round - b.round ||
        a.leg - b.leg ||
        a.id.localeCompare(b.id),
    );
}
