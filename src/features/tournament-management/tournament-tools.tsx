import { DraftNavigationBoundary } from "../../shared/hooks/use-dirty-draft";
import {
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
} from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  errorMessage,
  type EntrantsAddition,
  type Tournament,
} from "../../shared/api/arena-api";
import { useTournamentMutation } from "../../shared/api/query-hooks";
import { Field, Modal, ModalCancel } from "../../shared/ui/primitives";
import { newEntrant, type DraftEntrant } from "../setup/setup-draft";
export interface TournamentToolsProps {
  t: Tournament;
  ownerId: string;
  onSaved: (t: Tournament) => void;
}
type EditMode = "NAME" | "TEAMS";
interface TournamentChangeProps extends TournamentToolsProps {
  mode: EditMode;
  onClose: () => void;
}
type EditState =
  | { status: "editing" }
  | { status: "saving" }
  | { status: "review"; latest: Tournament };
function canAdd(t: Tournament): boolean {
  return (
    t.status !== "DRAFT" &&
    (t.format === "LEAGUE" ||
      (t.format === "WORLD_CUP" &&
        t.currentStage === "GROUP" &&
        !t.qualification))
  );
}
export function TournamentTools({
  t,
  ownerId,
  onSaved,
}: TournamentToolsProps): ReactElement {
  const [mode, setMode] = useState<EditMode | null>(null);
  return (
    <div className="tournament-tools">
      <button
        type="button"
        className="button secondary small"
        onClick={(): void => setMode("NAME")}
      >
        Edit tournament name
      </button>
      {canAdd(t) && (
        <button
          type="button"
          className="button secondary small"
          onClick={(): void => setMode("TEAMS")}
        >
          Add teams
        </button>
      )}
      {mode && (
        <TournamentChange
          t={t}
          ownerId={ownerId}
          onSaved={onSaved}
          mode={mode}
          onClose={(): void => setMode(null)}
        />
      )}
    </div>
  );
}
function TournamentChange({
  t,
  ownerId,
  onSaved,
  mode,
  onClose,
}: TournamentChangeProps): ReactElement {
  const mutation = useTournamentMutation(ownerId);
  const [base, setBase] = useState(t),
    [name, setName] = useState(t.name),
    [teams, setTeams] = useState<DraftEntrant[]>([newEntrant()]),
    [state, setState] = useState<EditState>({ status: "editing" }),
    [error, setError] = useState(""),
    [expired, setExpired] = useState(false);
  const pending = state.status === "saving";
  const dirty =
    mode === "NAME"
      ? name !== t.name
      : teams.some(
          (e: DraftEntrant): boolean => !!(e.name || e.aliases || e.groupId),
        );
  const changed = (id: string, patch: Partial<DraftEntrant>): void =>
    setTeams((rows: DraftEntrant[]): DraftEntrant[] =>
      rows.map((e: DraftEntrant): DraftEntrant =>
        e.clientId === id ? { ...e, ...patch } : e,
      ),
    );
  const count =
    base.format === "LEAGUE"
      ? teams.length * base.entrants.length +
        (teams.length * (teams.length - 1)) / 2
      : base.groups.reduce(
          (total: number, g: Tournament["groups"][number]): number => {
            const n = teams.filter(
              (e: DraftEntrant): boolean => e.groupId === g.id,
            ).length;
            return (
              total +
              n *
                base.entrants.filter(
                  (e: Tournament["entrants"][number]): boolean =>
                    e.groupId === g.id,
                ).length +
              (n * (n - 1)) / 2
            );
          },
          0,
        );
  const save = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (state.status !== "editing" || mutation.isPending) return;
    setError("");
    const names = new Set(
      base.entrants.map((e: Tournament["entrants"][number]): string =>
        e.name.toLocaleLowerCase("en-US"),
      ),
    );
    const entrants: EntrantsAddition["entrants"] = [];
    if (mode === "NAME") {
      if (name.trim().length < 2 || name.trim().length > 120) {
        setError("Use a tournament name from 2 to 120 characters.");
        return;
      }
    } else {
      if (!canAdd(base)) {
        setError("Participant additions are locked for this stage.");
        return;
      }
      if (base.entrants.length + teams.length > 256) {
        setError("Use at most 256 teams.");
        return;
      }
      for (const e of teams) {
        const key = e.name.trim().toLocaleLowerCase("en-US");
        const aliases = e.aliases
          .split(",")
          .map((s: string): string => s.trim())
          .filter(Boolean);
        if (!key || e.name.trim().length > 80 || names.has(key)) {
          setError("Use unique team names from 1 to 80 characters.");
          return;
        }
        if (
          aliases.length > 10 ||
          aliases.some((s: string): boolean => s.length > 80)
        ) {
          setError("Use at most 10 in-game names, each up to 80 characters.");
          return;
        }
        if (
          base.format === "WORLD_CUP" &&
          !base.groups.some(
            (g: Tournament["groups"][number]): boolean => g.id === e.groupId,
          )
        ) {
          setError("Choose an existing group for every team.");
          return;
        }
        names.add(key);
        entrants.push({
          name: e.name.trim(),
          aliases,
          groupId: base.format === "WORLD_CUP" ? e.groupId : null,
        });
      }
    }
    setState({ status: "saving" });
    try {
      const result = await mutation.mutateAsync({
        run: (): Promise<Tournament> =>
          mode === "NAME"
            ? api.renameTournament(base.id, name.trim(), base.revision)
            : api.addEntrants(base.id, {
                entrants,
                expectedRevision: base.revision,
              }),
      });
      onSaved(result);
      onClose();
    } catch (e: unknown) {
      setError(errorMessage(e));
      setState({ status: "editing" });
      setExpired(e instanceof ApiError && e.status === 401);
      if (e instanceof ApiError && e.code === "REVISION_CONFLICT") {
        try {
          const latest = await api.get(base.id);
          setState({ status: "review", latest });
        } catch (refresh: unknown) {
          setError(errorMessage(refresh));
        }
      }
    }
  };
  return (
    <Modal
      title={mode === "NAME" ? "Edit tournament name" : "Add teams"}
      onClose={onClose}
      pending={pending}
      dirty={
        mode === "NAME"
          ? name !== t.name
          : teams.some(
              (e: DraftEntrant): boolean =>
                !!(e.name || e.aliases || e.groupId),
            )
      }
    >
      <DraftNavigationBoundary dirty={dirty || pending} />
      <form onSubmit={save}>
        {error && (
          <p role="alert" className="inline-error">
            {error}
            {expired && (
              <Link
                to={`/auth/login?returnTo=${encodeURIComponent(`/manage/${t.id}`)}`}
              >
                Sign in to continue
              </Link>
            )}
          </p>
        )}
        {state.status === "review" && (
          <div className="panel">
            <p>
              This tournament changed. Latest name: {state.latest.name};{" "}
              {state.latest.entrants.length} teams; stage:{" "}
              {state.latest.currentStage}. Review before saving again.
            </p>
            <button
              type="button"
              className="button secondary small"
              onClick={(): void => {
                setBase(state.latest);
                setState({ status: "editing" });
                setError("");
              }}
            >
              Reapply draft
            </button>
          </div>
        )}
        <fieldset disabled={pending}>
          <legend className="sr-only">
            {mode === "NAME" ? "Tournament name" : "New teams"}
          </legend>
          {mode === "NAME" ? (
            <Field label="Tournament name">
              <input
                value={name}
                maxLength={120}
                required
                onChange={(e: ChangeEvent<HTMLInputElement>): void =>
                  setName(e.currentTarget.value)
                }
              />
            </Field>
          ) : (
            <>
              <p>
                Existing teams and fixtures stay in place. New matches are
                appended after existing rounds.
              </p>
              {base.status === "COMPLETED" && (
                <p>
                  This league will reopen and its champion will be cleared until
                  the new fixtures finish.
                </p>
              )}
              {teams.map((team: DraftEntrant, index: number): ReactElement => (
                <div key={team.clientId} className="panel new-team-row">
                  <Field label={`New team ${index + 1} name`}>
                    <input
                      required
                      maxLength={80}
                      value={team.name}
                      onChange={(e: ChangeEvent<HTMLInputElement>): void =>
                        changed(team.clientId, { name: e.currentTarget.value })
                      }
                    />
                  </Field>
                  <Field
                    label={`New team ${index + 1} in-game names`}
                    hint="Optional; separate names with commas."
                  >
                    <input
                      value={team.aliases}
                      onChange={(e: ChangeEvent<HTMLInputElement>): void =>
                        changed(team.clientId, {
                          aliases: e.currentTarget.value,
                        })
                      }
                    />
                  </Field>
                  {base.format === "WORLD_CUP" && (
                    <Field label={`New team ${index + 1} group`}>
                      <select
                        required
                        value={team.groupId ?? ""}
                        onChange={(e: ChangeEvent<HTMLSelectElement>): void =>
                          changed(team.clientId, {
                            groupId: e.currentTarget.value,
                          })
                        }
                      >
                        <option value="">Choose a group</option>
                        {base.groups.map(
                          (g: Tournament["groups"][number]): ReactElement => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ),
                        )}
                      </select>
                    </Field>
                  )}
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={teams.length === 1}
                    onClick={(): void =>
                      setTeams((rows: DraftEntrant[]): DraftEntrant[] =>
                        rows.filter(
                          (e: DraftEntrant): boolean =>
                            e.clientId !== team.clientId,
                        ),
                      )
                    }
                  >
                    Remove new team {index + 1}
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="button secondary small"
                disabled={base.entrants.length + teams.length >= 256}
                onClick={(): void =>
                  setTeams((rows: DraftEntrant[]): DraftEntrant[] => [
                    ...rows,
                    newEntrant(),
                  ])
                }
              >
                Add another team
              </button>
              <p role="status">
                {teams.length} new teams · {count * base.legs} new matches
              </p>
            </>
          )}
        </fieldset>
        <div className="modal-actions">
          <ModalCancel disabled={pending} />
          <button
            type="submit"
            className="button"
            disabled={state.status !== "editing" || mutation.isPending}
          >
            {pending
              ? "Saving…"
              : mode === "NAME"
                ? "Save name"
                : "Add teams and schedule matches"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
