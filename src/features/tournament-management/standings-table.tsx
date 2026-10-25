import { Link } from "react-router-dom";
import { teamFixturesSearch } from "./fixture-navigation";
import { Columns3 } from "lucide-react";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
} from "react";
import type { components } from "../../generated/api";
import type { Entrant, Tournament } from "../../shared/api/arena-api";
import { TeamMark } from "../../shared/ui/primitives";

type ScopeStanding = components["schemas"]["ScopeStanding"];
type Standing = components["schemas"]["Standing"];
type Group = components["schemas"]["Group"];
interface StandingsTableProps {
  tournament: Tournament;
  standings: ScopeStanding;
  group?: Group;
}
interface StandingsHintProps {
  label: string;
  description: string;
  children: ReactNode;
  className: string;
  pressed?: boolean;
  onActivate?: () => void;
}
function StandingsHint({
  label,
  description,
  children,
  className,
  pressed,
  onActivate,
}: StandingsHintProps): ReactElement {
  const [open, setOpen] = useState<boolean>(false);
  const tooltipId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  useLayoutEffect((): (() => void) | undefined => {
    if (!open) return;
    const position = (): void => {
      if (!trigger.current || !tooltip.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const hint = tooltip.current.getBoundingClientRect();
      const left = Math.max(
        16,
        Math.min(
          anchor.right - hint.width,
          window.innerWidth - hint.width - 16,
        ),
      );
      const below = anchor.bottom + 6;
      const top =
        below + hint.height <= window.innerHeight - 16
          ? below
          : Math.max(16, anchor.top - hint.height - 6);
      tooltip.current.style.left = `${left}px`;
      tooltip.current.style.top = `${top}px`;
    };
    position();
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(position);
    if (trigger.current) observer?.observe(trigger.current);
    if (tooltip.current) observer?.observe(tooltip.current);
    return (): void => {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
      observer?.disconnect();
    };
  }, [open, description]);
  return (
    <span
      className={`standings-hint ${className}`}
      onMouseEnter={(): void => setOpen(true)}
      onMouseLeave={(event: MouseEvent<HTMLSpanElement>): void => {
        if (!event.currentTarget.contains(document.activeElement))
          setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        aria-describedby={open ? tooltipId : undefined}
        onFocus={(): void => setOpen(true)}
        onBlur={(): void => setOpen(false)}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>): void => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
        onClick={(): void => {
          if (onActivate) {
            onActivate();
            setOpen(false);
          } else setOpen(true);
        }}
      >
        {children}
      </button>
      {open && (
        <span ref={tooltip} id={tooltipId} role="tooltip">
          {description}
        </span>
      )}
    </span>
  );
}
export function StandingsTable({
  tournament: t,
  standings,
  group,
}: StandingsTableProps): ReactElement {
  const [full, setFull] = useState<boolean>(false);
  return (
    <>
      <header className="panel-head standings-header">
        <div className="standings-heading">
          <h3>{group?.name ?? "League standings"}</h3>
          {group && (
            <StandingsHint
              className="qualification-badge"
              label={`Qualification places for ${group.name}: Top ${group.qualifierCount}`}
              description={`The top ${group.qualifierCount} ${group.qualifierCount === 1 ? "team advances" : "teams advance"}. Highlighted rows show qualification places. ${t.qualification ? "Qualification is confirmed." : "Positions are provisional until group matches finish and qualification ties are resolved."}`}
            >
              Top {group.qualifierCount}
            </StandingsHint>
          )}
        </div>
        <StandingsHint
          className="standings-columns"
          label={full ? "Show key statistics" : "Show full statistics"}
          description={full ? "Show key statistics" : "Show full statistics"}
          pressed={full}
          onActivate={(): void => setFull(!full)}
        >
          <Columns3 size={20} aria-hidden="true" />
        </StandingsHint>
      </header>
      <div
        className={`table-scroll standings-scroll ${full ? "full-statistics" : ""}`}
        tabIndex={0}
        role="region"
        aria-label="Standings table"
      >
        <table>
          <caption className="sr-only">
            {group?.name ?? "League"} standings
          </caption>
          <thead>
            <tr>
              <th scope="col" className="rank-cell">
                #
              </th>
              <th scope="col">Team</th>
              <th scope="col">
                <abbr title="Played">P</abbr>
              </th>
              <th scope="col">
                <abbr title="Score difference">SD</abbr>
              </th>
              <th scope="col">
                <abbr title="Points">PTS</abbr>
              </th>
              <th scope="col" className="detail-stat">
                <abbr title="Wins">W</abbr>
              </th>
              <th scope="col" className="detail-stat">
                <abbr title="Draws">D</abbr>
              </th>
              <th scope="col" className="detail-stat">
                <abbr title="Losses">L</abbr>
              </th>
              <th scope="col" className="detail-stat">
                <abbr title="Score for">SF</abbr>
              </th>
              <th scope="col" className="detail-stat">
                <abbr title="Score against">SA</abbr>
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.rows.map(
              (row: Standing, index: number): ReactElement => (
                <tr
                  key={row.entrantId}
                  className={`${group && index < group.qualifierCount ? "qualifier" : ""} ${group && index === group.qualifierCount - 1 ? "qualification-cutoff" : ""} ${index === 0 ? "leader" : ""}`}
                >
                  <td className="rank-cell">
                    {row.rank.toString().padStart(2, "0")}
                    {group && index < group.qualifierCount && (
                      <span className="sr-only">
                        {" "}
                        {t.qualification
                          ? "Qualification position"
                          : "Current qualification position"}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="table-team">
                      <TeamMark
                        name={row.name}
                        index={t.entrants.findIndex(
                          (entrant: Entrant): boolean =>
                            entrant.id === row.entrantId,
                        )}
                      />
                      <strong>
                        <Link
                          className="team-fixtures-link"
                          to={teamFixturesSearch(row.entrantId)}
                          state={{ focusFixtures: true }}
                          aria-label={`View fixtures for ${row.name}`}
                        >
                          {row.name}
                        </Link>
                      </strong>
                      {row.tieSignature &&
                        !row.tieResolved &&
                        row.played > 0 && (
                          <span
                            className="tie-label"
                            title="Still tied on points, difference and score for"
                          >
                            TIED
                          </span>
                        )}
                    </div>
                  </td>
                  <td>{row.played}</td>
                  <td>
                    {row.difference > 0 ? "+" : ""}
                    {row.difference}
                  </td>
                  <td className="points-cell">{row.points}</td>
                  <td className="detail-stat">{row.won}</td>
                  <td className="detail-stat">{row.drawn}</td>
                  <td className="detail-stat">{row.lost}</td>
                  <td className="detail-stat">{row.scoreFor}</td>
                  <td className="detail-stat">{row.scoreAgainst}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <div className="table-note">
        {t.winPoints} points for a win · {t.drawPoints} for a draw ·{" "}
        {t.lossPoints} for a loss
      </div>
      <details className="standings-guide">
        <summary>Table guide &amp; tie-break rules</summary>
        <p>
          Points, then score difference, then score for determine the order. An
          admin resolves any remaining ties.
        </p>
        <dl>
          <div>
            <dt>P</dt>
            <dd>Played</dd>
          </div>
          <div>
            <dt>SD</dt>
            <dd>Score difference (score for minus score against)</dd>
          </div>
          <div>
            <dt>PTS</dt>
            <dd>Points</dd>
          </div>
          <div>
            <dt>W / D / L</dt>
            <dd>Wins / draws / losses</dd>
          </div>
          <div>
            <dt>SF</dt>
            <dd>Score for</dd>
          </div>
          <div>
            <dt>SA</dt>
            <dd>Score against</dd>
          </div>
        </dl>
      </details>
    </>
  );
}
