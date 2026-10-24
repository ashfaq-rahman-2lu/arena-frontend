import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from "react";
import type { Entrant, Match, Tournament } from "../../shared/api/arena-api";
import { Field, Modal } from "../../shared/ui/primitives";
import { MatchEditor } from "../score-editing/match-editor";
import { pairFixtures, type ResultTeamPair } from "./result-entry-model";

interface SelectedResultFixture {
  match: Match;
  tournament: Tournament;
}
interface ResultEntryProps {
  tournament: Tournament;
  onSaved: (tournament: Tournament) => void;
  onClose: () => void;
}
interface ResultPickerProps {
  tournament: Tournament;
  pair: ResultTeamPair;
  focusMatchId: string;
  onPairChange: (pair: ResultTeamPair) => void;
  onSelect: (match: Match) => void;
  onClose: () => void;
}
function ResultPicker({
  tournament: t,
  pair,
  focusMatchId,
  onPairChange,
  onSelect,
  onClose,
}: ResultPickerProps): ReactElement {
  const choices = useRef<HTMLDivElement>(null);
  const entrants = [...t.entrants].sort((a: Entrant, b: Entrant): number =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
  const fixtures = pairFixtures(t, pair);
  useEffect((): void => {
    if (!focusMatchId) return;
    Array.from(
      choices.current?.querySelectorAll<HTMLButtonElement>(
        "button[data-match-id]",
      ) ?? [],
    )
      .find(
        (button: HTMLButtonElement): boolean =>
          button.dataset.matchId === focusMatchId,
      )
      ?.focus();
  }, [focusMatchId]);
  const name = (id: string): string =>
    t.entrants.find((entrant: Entrant): boolean => entrant.id === id)?.name ??
    "Team unavailable";
  return (
    <Modal title="Enter result" onClose={onClose}>
      <div className="result-picker">
        <div className="form-row">
          <Field label="Home team">
            <select
              value={pair.homeId}
              onChange={(event: ChangeEvent<HTMLSelectElement>): void => {
                const homeId = event.currentTarget.value;
                onPairChange({
                  homeId,
                  awayId: homeId === pair.awayId ? "" : pair.awayId,
                });
              }}
            >
              <option value="">Choose a team</option>
              {entrants.map((entrant: Entrant): ReactElement => (
                <option key={entrant.id} value={entrant.id}>
                  {entrant.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Away team">
            <select
              value={pair.awayId}
              onChange={(event: ChangeEvent<HTMLSelectElement>): void =>
                onPairChange({ ...pair, awayId: event.currentTarget.value })
              }
            >
              <option value="">Choose a team</option>
              {entrants.map((entrant: Entrant): ReactElement => (
                <option
                  key={entrant.id}
                  value={entrant.id}
                  disabled={entrant.id === pair.homeId}
                >
                  {entrant.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p>
          Shows both directions between these teams. Each fixture keeps its
          scheduled home and away order.
        </p>
        <div ref={choices} className="result-picker-matches">
          {pair.homeId && pair.awayId ? (
            fixtures.length ? (
              <>
                <p role="status">
                  {fixtures.length}{" "}
                  {fixtures.length === 1 ? "match" : "matches"} found. Select a
                  fixture.
                </p>
                {fixtures.map((fixture: Match): ReactElement => {
                  const stage =
                    fixture.stage === "GROUP"
                      ? (t.groups.find(
                          (group: Tournament["groups"][number]): boolean =>
                            group.id === fixture.scope,
                        )?.name ?? "Groups")
                      : fixture.stage === "KNOCKOUT"
                        ? "Knockout"
                        : "League";
                  const scored =
                    fixture.homeScore !== null && fixture.awayScore !== null;
                  return (
                    <button
                      type="button"
                      className="fixture-choice"
                      key={fixture.id}
                      data-match-id={fixture.id}
                      aria-label={`Select fixture: ${name(fixture.homeId)} vs ${name(fixture.awayId)}, ${stage}, round ${fixture.round}, leg ${fixture.leg}`}
                      onClick={(): void => onSelect(fixture)}
                    >
                      <span className="fixture-choice-context">
                        {stage} · Round {fixture.round} · Leg {fixture.leg}
                      </span>
                      <strong>
                        {name(fixture.homeId)}{" "}
                        <span aria-hidden="true">vs</span>{" "}
                        {name(fixture.awayId)}
                      </strong>
                      <span>
                        {scored
                          ? `${fixture.homeScore} : ${fixture.awayScore} · Saved result · Edit`
                          : "To play · Enter result"}
                      </span>
                    </button>
                  );
                })}
              </>
            ) : (
              <p role="status">
                No scheduled matches between these teams. Choose another pair or
                wait for their fixtures to be created.
              </p>
            )
          ) : (
            <p role="status">Select two teams to find their matches.</p>
          )}
        </div>
      </div>
      <div className="modal-actions">
        <button type="button" className="button secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
export function ResultEntry({
  tournament: t,
  onSaved,
  onClose,
}: ResultEntryProps): ReactElement {
  const [pair, setPair] = useState<ResultTeamPair>({ homeId: "", awayId: "" });
  const [selected, setSelected] = useState<SelectedResultFixture | null>(null);
  const [focusMatchId, setFocusMatchId] = useState<string>("");
  const current =
    selected && selected.tournament.revision > t.revision
      ? selected.tournament
      : t;
  const next = selected
    ? pairFixtures(current, pair).find(
        (match: Match): boolean =>
          match.id !== selected.match.id && match.homeScore === null,
      )
    : undefined;
  if (selected)
    return (
      <MatchEditor
        key={selected.match.id}
        t={current}
        match={selected.match}
        onSaved={onSaved}
        onClose={(): void => {
          setFocusMatchId(selected.match.id);
          setSelected(null);
        }}
        onCompleted={onClose}
        onNext={
          next
            ? (result: Tournament): void => {
                const following = pairFixtures(result, pair).find(
                  (match: Match): boolean =>
                    match.id !== selected.match.id && match.homeScore === null,
                );
                if (following)
                  setSelected({ match: following, tournament: result });
                else onClose();
              }
            : undefined
        }
      />
    );
  return (
    <ResultPicker
      tournament={t}
      pair={pair}
      focusMatchId={focusMatchId}
      onPairChange={setPair}
      onSelect={(match: Match): void => setSelected({ match, tournament: t })}
      onClose={onClose}
    />
  );
}
