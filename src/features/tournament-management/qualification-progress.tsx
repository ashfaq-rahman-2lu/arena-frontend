import type { ReactElement } from "react";
import type { Match, Tournament } from "../../shared/api/arena-api";

interface QualificationProgressProps {
  tournament: Tournament;
  onFixtures: () => void;
  onStandings: () => void;
  onReview: () => void;
  onStart: () => void;
}
interface GroupProgress {
  id: string;
  name: string;
  remaining: number;
  tieNames: string[];
}
export function QualificationProgress({
  tournament: t,
  onFixtures,
  onStandings,
  onReview,
  onStart,
}: QualificationProgressProps): ReactElement {
  const groups: GroupProgress[] = t.groups.map(
    (group: Tournament["groups"][number]): GroupProgress => {
      const matches = t.matches.filter(
        (match: Match): boolean =>
          match.stage === "GROUP" && match.scope === group.id,
      );
      const rows =
        t.standings.find(
          (standing: Tournament["standings"][number]): boolean =>
            standing.scope === group.id,
        )?.rows ?? [];
      const last = rows[group.qualifierCount - 1];
      const next = rows[group.qualifierCount];
      const cutoffTie =
        last?.tieSignature &&
        !last.tieResolved &&
        last.tieSignature === next?.tieSignature;
      return {
        id: group.id,
        name: group.name,
        remaining: matches.filter(
          (match: Match): boolean =>
            match.homeScore === null || match.awayScore === null,
        ).length,
        tieNames: cutoffTie
          ? rows
              .filter(
                (row: (typeof rows)[number]): boolean =>
                  row.tieSignature === last.tieSignature,
              )
              .map((row: (typeof rows)[number]): string => row.name)
          : [],
      };
    },
  );
  const remaining = groups.reduce(
    (total: number, group: GroupProgress): number => total + group.remaining,
    0,
  );
  const ties = groups.some(
    (group: GroupProgress): boolean =>
      group.tieNames.length > 0 && group.remaining === 0,
  );
  return (
    <section
      className="panel qualification-progress"
      aria-label="Group qualification progress"
    >
      <h2>Get ready for the knockout stage</h2>
      <p>
        Finish group matches, resolve qualification ties, then review the
        advancing teams.
      </p>
      {t.status === "DRAFT" ? (
        <button className="button" type="button" onClick={onStart}>
          Review &amp; start
        </button>
      ) : (
        <>
          <ul>
            {groups.map((group: GroupProgress): ReactElement => (
              <li key={group.id}>
                {group.remaining > 0
                  ? `${group.name}: ${group.remaining} ${group.remaining === 1 ? "match" : "matches"} remaining`
                  : group.tieNames.length
                    ? `${group.name}: resolve the qualification tie between ${group.tieNames.join(", ")}`
                    : `${group.name}: matches complete`}
              </li>
            ))}
          </ul>
          <div className="qualification-next-actions">
            {remaining > 0 && (
              <button type="button" className="button" onClick={onFixtures}>
                Finish group matches
              </button>
            )}
            {ties && (
              <button
                type="button"
                className="button secondary"
                onClick={onStandings}
              >
                Resolve qualification ties
              </button>
            )}
            {t.qualificationPreview && (
              <button type="button" className="button" onClick={onReview}>
                Review qualifiers
              </button>
            )}
            {!remaining && !ties && !t.qualificationPreview && (
              <p>
                Qualification is not ready yet. Review the group standings and
                tournament rules.
              </p>
            )}
            <button type="button" className="text-button" onClick={onStandings}>
              View group standings
            </button>
          </div>
        </>
      )}
    </section>
  );
}
