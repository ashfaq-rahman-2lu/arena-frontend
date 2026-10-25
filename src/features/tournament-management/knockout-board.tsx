import type { ReactElement } from "react";
import type {
  KnockoutTie,
  Match,
  Tournament,
} from "../../shared/api/arena-api";
import { TeamMark } from "../../shared/ui/primitives";
interface KnockoutBoardProps {
  t: Tournament;
  admin: boolean;
  onSelect: (match: Match) => void;
  onViewStats: (match: Match) => void;
}
export function KnockoutBoard({
  t,
  admin,
  onSelect,
  onViewStats,
}: KnockoutBoardProps): ReactElement {
  const name = (id: string): string =>
    t.entrants.find((e: Tournament["entrants"][number]): boolean => e.id === id)
      ?.name ?? "Team";
  if (!t.rounds.length)
    return (
      <div className="empty">
        <h2>The road to the final starts here.</h2>
        <p>
          {t.status === "DRAFT"
            ? "Start the tournament to arrange the opening round."
            : t.format === "KNOCKOUT" || t.qualification
              ? "The admin will choose the first knockout pairings."
              : "Knockout fixtures appear after group qualification is confirmed."}
        </p>
      </div>
    );
  return (
    <div className="knockout-grid">
      {t.rounds.map((round: Tournament["rounds"][number]): ReactElement => {
        const ties = t.knockoutTies.filter(
          (tie: KnockoutTie): boolean => tie.roundId === round.id,
        );
        return (
          <section key={round.id} className="panel knockout-round">
            <div className="panel-head">
              <h3>
                {ties.length === 1 && !round.byes.length
                  ? "Final"
                  : `Round ${round.number}`}
              </h3>
              <span className="badge neutral">
                {round.method === "FIXED"
                  ? "Fixed bracket"
                  : round.method === "RANDOM"
                    ? "Random draw"
                    : "Manual pairings"}
              </span>
            </div>
            {ties.map((tie: KnockoutTie): ReactElement => (
              <article key={tie.id} className="knockout-tie">
                <h4>
                  {name(tie.homeId)} vs {name(tie.awayId)}
                </h4>
                <p>
                  {tie.legs === 2 ? "Two legs" : "Single match"} ·{" "}
                  {tie.winnerId
                    ? `Advances: ${name(tie.winnerId)}`
                    : "Awaiting tie winner"}
                </p>
                {tie.legs === 2 && (
                  <p>
                    Aggregate: {name(tie.homeId)} {tie.homeAggregate} –{" "}
                    {tie.awayAggregate} {name(tie.awayId)}
                  </p>
                )}
                {tie.homeTiebreak !== null && (
                  <p>
                    Tiebreak: {tie.homeTiebreak} – {tie.awayTiebreak}
                  </p>
                )}
                {t.matches
                  .filter((m: Match): boolean => m.knockoutTieId === tie.id)
                  .map((m: Match): ReactElement => {
                    const canViewStats: boolean =
                      !admin &&
                      t.statsEnabled &&
                      m.homeScore !== null &&
                      m.awayScore !== null;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        className="bracket-match"
                        disabled={!admin && !canViewStats}
                        onClick={(): void => {
                          if (admin) onSelect(m);
                          else if (canViewStats) onViewStats(m);
                        }}
                        aria-label={`${admin ? "Edit" : canViewStats ? "View stats:" : "Match"} ${name(m.homeId)} vs ${name(m.awayId)}, leg ${m.leg}`}
                      >
                        <span>
                          Leg {m.leg} · {name(m.homeId)}{" "}
                          <b>{m.homeScore ?? "—"}</b>
                        </span>
                        <span>
                          {name(m.awayId)} <b>{m.awayScore ?? "—"}</b>
                        </span>
                        {canViewStats && (
                          <span className="bracket-match-stats-label">
                            View stats
                          </span>
                        )}
                      </button>
                    );
                  })}
              </article>
            ))}
            {round.byes.map(
              (
                bye: Tournament["rounds"][number]["byes"][number],
              ): ReactElement => (
                <div key={bye.entrantId} className="bye-row">
                  <TeamMark name={name(bye.entrantId)} />
                  <strong>{name(bye.entrantId)}</strong>
                  <span className="badge neutral">BYE · ADVANCES</span>
                </div>
              ),
            )}
          </section>
        );
      })}
    </div>
  );
}
