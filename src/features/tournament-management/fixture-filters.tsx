import type { ChangeEvent, ReactElement } from "react";
import type { Tournament } from "../../shared/api/arena-api";
import { TeamFilter } from "./team-filter";

interface FixtureFiltersProps {
  tournament: Tournament;
  team: string;
  status: string;
  stage: string;
  onTeamChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onStageChange: (value: string) => void;
}
export function FixtureFilters({
  tournament,
  team,
  status,
  stage,
  onTeamChange,
  onStatusChange,
  onStageChange,
}: FixtureFiltersProps): ReactElement {
  return (
    <>
      <TeamFilter
        entrants={tournament.entrants}
        value={team}
        onChange={onTeamChange}
      />
      <select
        aria-label="Filter fixture status"
        value={status}
        onChange={(event: ChangeEvent<HTMLSelectElement>): void =>
          onStatusChange(event.currentTarget.value)
        }
      >
        <option value="ALL">All matches</option>
        <option value="PENDING">To play</option>
        <option value="PLAYED">Played</option>
      </select>
      {tournament.format === "WORLD_CUP" && (
        <select
          aria-label="Filter stage"
          value={stage}
          onChange={(event: ChangeEvent<HTMLSelectElement>): void =>
            onStageChange(event.currentTarget.value)
          }
        >
          <option value="ALL">All stages</option>
          <option value="GROUP">Groups</option>
          <option value="KNOCKOUT">Knockout</option>
        </select>
      )}
    </>
  );
}
