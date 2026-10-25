import type { ReactElement } from "react";
import type { Match, Tournament } from "../../shared/api/arena-api";

interface FixtureProgressProps {
  tournament: Tournament;
  teamId: string;
}
export function FixtureProgress({
  tournament,
  teamId,
}: FixtureProgressProps): ReactElement | null {
  const team = tournament.entrants.find(
    (entrant: Tournament["entrants"][number]): boolean => entrant.id === teamId,
  );
  if (!team) return null;
  const teamMatches = tournament.matches.filter(
    (match: Match): boolean =>
      match.homeId === teamId || match.awayId === teamId,
  );
  const played = (matches: Match[]): number =>
    matches.filter(
      (match: Match): boolean =>
        match.homeScore !== null && match.awayScore !== null,
    ).length;
  return (
    <div className="fixtures-progress">
      {team && (
        <p>{`${team.name}: ${played(teamMatches)}/${teamMatches.length} matches played`}</p>
      )}
    </div>
  );
}
