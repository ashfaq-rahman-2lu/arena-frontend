import { ChevronDown } from "lucide-react";
import {
  useId,
  useState,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Match } from "../../shared/api/arena-api";

interface FixtureRound {
  key: string;
  label: string;
  stage: Match["stage"];
  number: number;
  matches: Match[];
}
interface FixtureRoundsProps {
  filterKey?: string;
  filters?: ReactNode;
  summary?: ReactNode;
  emptyContent?: ReactNode;
  matches: Match[];
  selectedRound: string;
  onRoundChange: (round: string) => void;
  renderMatch: (match: Match) => ReactElement;
}
interface RoundSectionProps {
  round: FixtureRound;
  open: boolean;
  onToggle: () => void;
  renderMatch: (match: Match) => ReactElement;
}
function RoundSection({
  round,
  open,
  onToggle,
  renderMatch,
}: RoundSectionProps): ReactElement {
  const contentId = useId();
  const played = round.matches.filter(
    (match: Match): boolean => match.homeScore !== null,
  ).length;
  return (
    <section className="fixture-round">
      <h3>
        <button
          type="button"
          className="round-heading"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={onToggle}
        >
          <span>{round.label}</span>
          <span className="round-progress">
            {played} of {round.matches.length} played{" "}
            <ChevronDown size={18} aria-hidden="true" />
          </span>
        </button>
      </h3>
      <div id={contentId} hidden={!open}>
        {open && (
          <div className="fixture-list">{round.matches.map(renderMatch)}</div>
        )}
      </div>
    </section>
  );
}
interface RoundListProps {
  resetKey: string;
  toolbar: ReactNode;
  summary?: ReactNode;
  emptyContent?: ReactNode;
  rounds: FixtureRound[];
  initialRound?: string;
  renderMatch: (match: Match) => ReactElement;
}
function RoundList({
  resetKey,
  toolbar,
  summary,
  emptyContent,
  rounds,
  initialRound,
  renderMatch,
}: RoundListProps): ReactElement {
  const [expanded, setExpanded] = useState<Set<string>>(
    new Set(initialRound ? [initialRound] : []),
  );
  const [previousKey, setPreviousKey] = useState<string>(resetKey);
  // Filter changes reset expansion without remounting the focused controls.
  if (previousKey !== resetKey) {
    setPreviousKey(resetKey);
    setExpanded(new Set(initialRound ? [initialRound] : []));
  }
  const allOpen = rounds.every((round: FixtureRound): boolean =>
    expanded.has(round.key),
  );
  return (
    <>
      <div className="fixtures-toolbar">
        <div className="fixture-filters">{toolbar}</div>
        {rounds.length > 1 && (
          <button
            className="button secondary small round-expand-all"
            type="button"
            onClick={(): void =>
              setExpanded(
                new Set(
                  allOpen
                    ? []
                    : rounds.map((round: FixtureRound): string => round.key),
                ),
              )
            }
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        )}
      </div>
      <div className="fixtures-filter-summary">{summary}</div>
      {!rounds.length && emptyContent}
      {rounds.map((round: FixtureRound): ReactElement => (
        <RoundSection
          key={round.key}
          round={round}
          open={expanded.has(round.key)}
          onToggle={(): void =>
            setExpanded((current: Set<string>): Set<string> => {
              const next = new Set(current);
              if (next.has(round.key)) next.delete(round.key);
              else next.add(round.key);
              return next;
            })
          }
          renderMatch={renderMatch}
        />
      ))}
    </>
  );
}
export function FixtureRounds({
  filterKey = "",
  filters,
  summary,
  emptyContent,
  matches,
  selectedRound,
  onRoundChange,
  renderMatch,
}: FixtureRoundsProps): ReactElement {
  const grouped = new Map<string, FixtureRound>();
  for (const match of matches) {
    const key = `${match.stage}:${match.round}`;
    let round = grouped.get(key);
    if (!round) {
      const stage =
        match.stage === "GROUP"
          ? "Groups"
          : match.stage === "KNOCKOUT"
            ? "Knockout"
            : "League";
      round = {
        key,
        label: `${stage} · Round ${match.round}`,
        stage: match.stage,
        number: match.round,
        matches: [],
      };
      grouped.set(key, round);
    }
    round.matches.push(match);
  }
  const rounds = [...grouped.values()].sort(
    (a: FixtureRound, b: FixtureRound): number =>
      Number(a.stage === "KNOCKOUT") - Number(b.stage === "KNOCKOUT") ||
      a.number - b.number,
  );
  const selection = grouped.has(selectedRound) ? selectedRound : "ALL";
  const visible =
    selection === "ALL"
      ? rounds
      : rounds.filter(
          (round: FixtureRound): boolean => round.key === selection,
        );
  const firstUnfinished =
    visible.find((round: FixtureRound): boolean =>
      round.matches.some((match: Match): boolean => match.homeScore === null),
    ) ?? visible[0];
  return (
    <div className="fixture-rounds">
      <RoundList
        resetKey={JSON.stringify([selection, filterKey])}
        toolbar={
          <>
            {filters}{" "}
            <select
              aria-label="Filter by round"
              value={selection}
              onChange={(event: ChangeEvent<HTMLSelectElement>): void =>
                onRoundChange(event.currentTarget.value)
              }
            >
              <option value="ALL">All rounds</option>
              {rounds.map((round: FixtureRound): ReactElement => (
                <option key={round.key} value={round.key}>
                  {round.label}
                </option>
              ))}
            </select>
          </>
        }
        summary={summary}
        emptyContent={emptyContent}
        rounds={visible}
        initialRound={firstUnfinished?.key}
        renderMatch={renderMatch}
      />
    </div>
  );
}
