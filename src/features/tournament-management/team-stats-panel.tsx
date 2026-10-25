import type { UseQueryResult } from "@tanstack/react-query";
import { Info, X } from "lucide-react";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { errorMessage, type TeamStats } from "../../shared/api/arena-api";
import { Field } from "../../shared/ui/primitives";

type Team = TeamStats["teams"][number];
type Stat = Team["stats"][number];
interface SingleStatRow {
  kind: "single";
  key: string;
  label: string;
}
interface PairedStatRow {
  kind: "paired";
  key: string;
  pairedKey: string;
  label: string;
}
interface PercentageStatRow {
  kind: "percentage";
  numeratorKey: string;
  denominatorKey: string;
  label: string;
}
type StatDefinition = SingleStatRow | PairedStatRow | PercentageStatRow;
const featuredDefinitions: StatDefinition[] = [
  { kind: "single", key: "possession", label: "Possession" },
  {
    kind: "paired",
    key: "shots",
    pairedKey: "shotsOnTarget",
    label: "Shots (on target)",
  },
  {
    kind: "percentage",
    numeratorKey: "shotsOnTarget",
    denominatorKey: "shots",
    label: "Shot accuracy",
  },
  {
    kind: "paired",
    key: "passes",
    pairedKey: "successfulPasses",
    label: "Passes (successful)",
  },
  {
    kind: "percentage",
    numeratorKey: "successfulPasses",
    denominatorKey: "passes",
    label: "Pass accuracy",
  },
];
const additionalDefinitions: SingleStatRow[] = [
  { kind: "single", key: "freeKicks", label: "Free kicks" },
  { kind: "single", key: "cornerKicks", label: "Corner kicks" },
  { kind: "single", key: "crosses", label: "Crosses" },
  { kind: "single", key: "offsides", label: "Offsides" },
  { kind: "single", key: "fouls", label: "Fouls" },
  { kind: "single", key: "interceptions", label: "Interceptions" },
  { kind: "single", key: "tackles", label: "Tackles" },
  { kind: "single", key: "saves", label: "Saves" },
];
interface TeamStatsPanelProps {
  query: UseQueryResult<TeamStats, Error>;
  active: boolean;
}
interface StatsHintProps {
  label: string;
  description: string;
  children: ReactNode;
}
function StatsHint({
  label,
  description,
  children,
}: StatsHintProps): ReactElement {
  const [open, setOpen] = useState<boolean>(false);
  const id = useId();
  const container = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const hint = useRef<HTMLSpanElement>(null);
  useLayoutEffect((): (() => void) | undefined => {
    if (!open) return;
    const position = (): void => {
      if (!trigger.current || !hint.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const box = hint.current.getBoundingClientRect();
      hint.current.style.left = `${Math.max(12, Math.min(anchor.left, window.innerWidth - box.width - 12))}px`;
      hint.current.style.top = `${anchor.bottom + box.height + 6 < window.innerHeight ? anchor.bottom + 6 : Math.max(12, anchor.top - box.height - 6)}px`;
    };
    const outside = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !container.current?.contains(event.target)
      )
        setOpen(false);
    };
    const dismiss = (event: globalThis.KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", dismiss);
    position();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(position);
    if (hint.current) observer?.observe(hint.current);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    return (): void => {
      observer?.disconnect();
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", dismiss);
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
    };
  }, [open]);
  return (
    <span
      className="team-stats-hint"
      ref={container}
      onMouseEnter={(): void => setOpen(true)}
      onMouseLeave={(event: MouseEvent<HTMLSpanElement>): void => {
        if (!event.currentTarget.contains(document.activeElement))
          setOpen(false);
      }}
    >
      <button
        type="button"
        ref={trigger}
        aria-label={label}
        aria-describedby={open ? id : undefined}
        onFocus={(): void => setOpen(true)}
        onBlur={(): void => setOpen(false)}
        onClick={(): void => setOpen(true)}
        onKeyDown={(event: KeyboardEvent<HTMLButtonElement>): void => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {children}
      </button>
      {open && (
        <span ref={hint} id={id} role="tooltip">
          {description}
        </span>
      )}
    </span>
  );
}
function chipName(name: string): string {
  const trimmed = name.trim();
  const word = trimmed.split(/\s+/)[0] ?? "";
  const shortened = Array.from(word).slice(0, 8).join("");
  return shortened + (shortened !== trimmed ? "…" : "");
}
interface StatValueProps {
  team: Team;
  definition: StatDefinition;
}
interface StatCellDisplay {
  value: string;
  recordedMatches: number;
  playedMatches: number;
  coverageDescription: string;
}
function findStat(team: Team, key: string): Stat | undefined {
  return team.stats.find((entry: Stat): boolean => entry.key === key);
}
function formatStat(stat: Stat | undefined): string {
  if (stat?.value === null || stat?.value === undefined) return "—";
  return `${stat.value}${stat.unit === "percent" ? "%" : ""}`;
}
function getCellDisplay(
  team: Team,
  definition: StatDefinition,
): StatCellDisplay {
  const primaryKey =
    definition.kind === "percentage"
      ? definition.denominatorKey
      : definition.key;
  const primary = findStat(team, primaryKey);
  const paired =
    definition.kind === "paired"
      ? findStat(team, definition.pairedKey)
      : definition.kind === "percentage"
        ? findStat(team, definition.numeratorKey)
        : undefined;
  let value: string;
  let coverageDescription: string;
  if (definition.kind === "paired") {
    value = `${formatStat(primary)} (${formatStat(paired)})`;
    coverageDescription = `${primary?.label ?? definition.label}: ${primary?.recordedMatches ?? 0} recorded matches / ${primary?.playedMatches ?? team.stats[0]?.playedMatches ?? 0} matches played; ${paired?.label ?? definition.label}: ${paired?.recordedMatches ?? 0} recorded matches / ${paired?.playedMatches ?? team.stats[0]?.playedMatches ?? 0} matches played`;
  } else if (definition.kind === "percentage") {
    const numerator = paired?.value;
    const denominator = primary?.value;
    value =
      typeof numerator !== "number" ||
      typeof denominator !== "number" ||
      denominator === 0
        ? "—"
        : `${Number(((numerator / denominator) * 100).toFixed(1))}%`;
    coverageDescription = `${paired?.label ?? definition.label}: ${paired?.recordedMatches ?? 0} recorded matches / ${paired?.playedMatches ?? team.stats[0]?.playedMatches ?? 0} matches played; ${primary?.label ?? definition.label}: ${primary?.recordedMatches ?? 0} recorded matches / ${primary?.playedMatches ?? team.stats[0]?.playedMatches ?? 0} matches played`;
  } else {
    value = formatStat(primary);
    coverageDescription = `${primary?.recordedMatches ?? 0} recorded matches / ${primary?.playedMatches ?? team.stats[0]?.playedMatches ?? 0} matches played`;
  }
  const sources = definition.kind === "single" ? [primary] : [primary, paired];
  const coverage = sources.map(
    (
      stat: Stat | undefined,
    ): { recordedMatches: number; playedMatches: number } => ({
      recordedMatches: stat?.recordedMatches ?? 0,
      playedMatches: stat?.playedMatches ?? team.stats[0]?.playedMatches ?? 0,
    }),
  );
  return {
    value,
    recordedMatches: Math.min(
      ...coverage.map(
        (entry: { recordedMatches: number; playedMatches: number }): number =>
          entry.recordedMatches,
      ),
    ),
    playedMatches: Math.max(
      ...coverage.map(
        (entry: { recordedMatches: number; playedMatches: number }): number =>
          entry.playedMatches,
      ),
    ),
    coverageDescription,
  };
}
function StatValue({ team, definition }: StatValueProps): ReactElement {
  const display = getCellDisplay(team, definition);
  return (
    <td>
      <span>{display.value}</span>{" "}
      <small className="stat-coverage" aria-label={display.coverageDescription}>
        <span aria-hidden="true">· </span>
        {display.recordedMatches}/{display.playedMatches}
      </small>
    </td>
  );
}
export function TeamStatsPanel({
  query,
  active,
}: TeamStatsPanelProps): ReactElement | null {
  const [selection, setSelection] = useState<string[] | null>(null);
  const [showAllStats, setShowAllStats] = useState<boolean>(false);
  const primary = useRef<HTMLSelectElement>(null);
  const teams = [...(query.data?.teams ?? [])].sort(
    (a: Team, b: Team): number =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  const initial =
    teams.find((team: Team): boolean =>
      team.stats.some((stat: Stat): boolean => stat.recordedMatches > 0),
    ) ?? teams[0];
  const selectedIds = selection ?? (initial ? [initial.entrantId] : []);
  if (selection === null && query.data) setSelection(selectedIds);
  const selected = selectedIds.flatMap((id: string): Team[] => {
    const team = teams.find((entry: Team): boolean => entry.entrantId === id);
    return team ? [team] : [];
  });
  const available = teams.filter(
    (team: Team): boolean =>
      !selected.some(
        (entry: Team): boolean => entry.entrantId === team.entrantId,
      ),
  );
  if (!active) return null;
  return (
    <section className="panel team-stats-panel" aria-label="Team stats">
      {query.isPending ? (
        <p role="status">Loading team stats…</p>
      ) : query.error ? (
        <div role="alert">
          <p>Could not load team stats. {errorMessage(query.error)}</p>
          <button
            className="button secondary small"
            type="button"
            onClick={(): void => {
              void query.refetch();
            }}
          >
            Retry team stats
          </button>
        </div>
      ) : !teams.length ? (
        <p>No teams are available for stats yet.</p>
      ) : (
        <>
          <div className="team-stats-selectors">
            <Field label="Team">
              <select
                ref={primary}
                value={selected[0]?.entrantId ?? ""}
                onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
                  const id = event.currentTarget.value;
                  const rest = selected
                    .slice(1)
                    .map((team: Team): string => team.entrantId);
                  setSelection(
                    id
                      ? [
                          id,
                          ...rest.filter(
                            (entry: string): boolean => entry !== id,
                          ),
                        ]
                      : rest,
                  );
                }}
              >
                <option value="">Choose a team</option>
                {teams.map((team: Team): ReactElement => (
                  <option key={team.entrantId} value={team.entrantId}>
                    {team.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Compare with">
              <select
                value=""
                disabled={!selected.length || !available.length}
                onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
                  const id = event.currentTarget.value;
                  if (
                    id &&
                    available.some(
                      (team: Team): boolean => team.entrantId === id,
                    )
                  )
                    setSelection([
                      ...selected.map((team: Team): string => team.entrantId),
                      id,
                    ]);
                }}
              >
                <option value="">
                  {!available.length ? "All teams selected" : "Add a team"}
                </option>
                {available.map((team: Team): ReactElement => (
                  <option key={team.entrantId} value={team.entrantId}>
                    {team.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="team-stats-selection">
            {selected.length > 0 && (
              <ul className="team-stats-chips" aria-label="Selected teams">
                {selected.map((team: Team): ReactElement => (
                  <li key={team.entrantId}>
                    <StatsHint
                      label={`Show full team name: ${team.name}`}
                      description={team.name}
                    >
                      {chipName(team.name)}
                    </StatsHint>
                    <button
                      type="button"
                      aria-label={`Remove ${team.name}`}
                      onClick={(): void => {
                        setSelection(
                          selected
                            .filter(
                              (entry: Team): boolean =>
                                entry.entrantId !== team.entrantId,
                            )
                            .map((entry: Team): string => entry.entrantId),
                        );
                        primary.current?.focus();
                      }}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="team-stats-information">
              <StatsHint
                label="Stats information"
                description="Counts are totals; possession is an average. Coverage shows recorded matches / matches played. — means not recorded."
              >
                <Info size={16} aria-hidden="true" />
              </StatsHint>
            </div>
          </div>
          {!teams.some((team: Team): boolean =>
            team.stats.some((stat: Stat): boolean => stat.recordedMatches > 0),
          ) && (
            <p>
              No match stats have been recorded yet. Add optional stats when
              saving a match result.
            </p>
          )}
          {!selected.length ? (
            <p role="status">Choose a team to see its stats.</p>
          ) : (
            <>
              {selected.length === 1 &&
                !selected[0].stats.some(
                  (stat: Stat): boolean => stat.recordedMatches > 0,
                ) && (
                  <p role="status">
                    No match stats have been recorded for the selected team.
                  </p>
                )}

              <div className="team-stats-table-actions">
                <button
                  className="button secondary small"
                  type="button"
                  aria-expanded={showAllStats}
                  aria-controls="team-stats-rows"
                  onClick={(): void => setShowAllStats(!showAllStats)}
                >
                  {showAllStats ? "Show key stats" : "Show all stats"}
                </button>
              </div>
              <div
                className="table-scroll team-comparison-scroll"
                role="region"
                aria-label="Team stats table"
                tabIndex={0}
              >
                <table
                  className={`team-comparison-table ${selected.length > 1 ? "comparing" : ""}`}
                >
                  <caption className="sr-only">
                    {selected.length === 1
                      ? `Team stats: ${selected[0].name}`
                      : "Team stats comparison"}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Stat</th>
                      {selected.map((team: Team): ReactElement => (
                        <th scope="col" key={team.entrantId}>
                          {team.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody id="team-stats-rows">
                    {[
                      ...featuredDefinitions,
                      ...(showAllStats ? additionalDefinitions : []),
                    ].map((definition: StatDefinition): ReactElement => (
                      <tr key={`${definition.kind}-${definition.label}`}>
                        <th scope="row">{definition.label}</th>
                        {selected.map((team: Team): ReactElement => (
                          <StatValue
                            key={team.entrantId}
                            team={team}
                            definition={definition}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
