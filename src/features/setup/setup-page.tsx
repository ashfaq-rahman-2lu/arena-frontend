import { ArrowLeft, Plus, Save, Shuffle, Trash2 } from "lucide-react";
import { ChangeEvent, FormEvent, ReactElement, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  api,
  ApiError,
  errorMessage,
  Tournament,
} from "../../shared/api/arena-api";
import {
  useCompetition,
  useTournamentMutation,
} from "../../shared/api/query-hooks";
import { DirtyDraftGuard } from "../../shared/hooks/use-dirty-draft";
import { ConflictReview } from "../../shared/ui/conflict-review";
import {
  ErrorState,
  Field,
  Spinner,
  TeamMark,
  useSession,
  useToast,
} from "../../shared/ui/primitives";
import {
  DraftEntrant,
  draftFromTournament,
  DraftGroup,
  FieldErrors,
  newEntrant,
  newGroup,
  newSetupDraft,
  SetupDraft,
  validateSetupDraft,
} from "./setup-draft";
interface SetupFormProps {
  initial: Tournament | null;
  ownerId: string;
}
export function SetupPage(): ReactElement {
  const { id = "" } = useParams();
  const session = useSession();
  const ownerId = session.data?.user?.id ?? "";
  const existing = useCompetition(true, ownerId, id, "");
  if (session.isPending || (id && ownerId && existing.isPending))
    return <Spinner />;
  if (session.error) return <ErrorState error={session.error} />;
  if (!ownerId)
    return (
      <Navigate
        to={`/auth/login?returnTo=${encodeURIComponent(id ? `/manage/${id}/setup` : "/new")}`}
        replace
      />
    );
  if (id && existing.error) return <ErrorState error={existing.error} />;
  if (existing.data && existing.data.status !== "DRAFT")
    return <Navigate to={`/manage/${id}`} replace />;
  return (
    <SetupForm
      key={`${ownerId}:${id || "new"}`}
      initial={id ? (existing.data ?? null) : null}
      ownerId={ownerId}
    />
  );
}
function SetupForm({ initial, ownerId }: SetupFormProps): ReactElement {
  const navigate = useNavigate(),
    toast = useToast();
  const mutation = useTournamentMutation(ownerId);
  const [draft, setDraft] = useState<SetupDraft>((): SetupDraft =>
    initial ? draftFromTournament(initial) : newSetupDraft(),
  );
  const [baseline, setBaseline] = useState(JSON.stringify(draft)),
    leave = useRef(false);
  const [revision, setRevision] = useState(initial?.revision ?? 0);
  const [errors, setErrors] = useState<FieldErrors>({}),
    [error, setError] = useState(""),
    [bulk, setBulk] = useState(""),
    [latest, setLatest] = useState<Tournament | null>(null),
    [reviewed, setReviewed] = useState(false);
  const dirty = JSON.stringify(draft) !== baseline;
  const update = <K extends keyof SetupDraft>(
    key: K,
    value: SetupDraft[K],
  ): void => {
    setDraft((old: SetupDraft): SetupDraft => ({ ...old, [key]: value }));
    setReviewed(false);
  };
  const entrant = (id: string, patch: Partial<DraftEntrant>): void =>
    update(
      "entrants",
      draft.entrants.map((entry: DraftEntrant): DraftEntrant =>
        entry.clientId === id ? { ...entry, ...patch } : entry,
      ),
    );
  const group = (id: string, patch: Partial<DraftGroup>): void =>
    update(
      "groups",
      draft.groups.map((entry: DraftGroup): DraftGroup =>
        entry.clientId === id ? { ...entry, ...patch } : entry,
      ),
    );
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (mutation.isPending || (latest && !reviewed)) return;
    const validation = validateSetupDraft(
      draft,
      latest ?? initial ?? undefined,
    );
    if (!validation.valid) {
      setErrors(validation.errors);
      setError("Correct the highlighted fields before saving.");
      const field = Object.keys(validation.errors)[0];
      document.getElementById(field)?.focus();
      return;
    }
    setErrors({});
    setError("");
    try {
      const saved = await mutation.mutateAsync({
        run: (): Promise<Tournament> =>
          initial
            ? api.update(initial.id, {
                ...validation.payload,
                expectedRevision: revision,
              })
            : api.create(validation.payload),
      });
      leave.current = true;
      toast("Draft saved. Review your fixtures before starting.");
      navigate(`/manage/${saved.id}`);
    } catch (failure: unknown) {
      setError(errorMessage(failure));
      if (
        initial &&
        failure instanceof ApiError &&
        failure.code === "REVISION_CONFLICT"
      ) {
        try {
          setLatest(await api.get(initial.id));
          setReviewed(false);
        } catch (refreshError: unknown) {
          setError(errorMessage(refreshError));
        }
      }
    }
  };
  const randomize = (): void => {
    if (!draft.groups.length) return;
    const order = [...draft.entrants];
    for (let index = order.length - 1; index > 0; index--) {
      const other = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
      [order[index], order[other]] = [order[other], order[index]];
    }
    const groups = draft.groups;
    update(
      "entrants",
      order.map((entry: DraftEntrant, index: number): DraftEntrant => ({
        ...entry,
        groupId: groups[index % groups.length].clientId,
      })),
    );
    toast("Groups shuffled. Review the assignments below.");
  };
  return (
    <main id="main-content" className="container setup-page">
      <DirtyDraftGuard dirty={dirty} allowNavigation={leave} />
      <Link
        to={initial ? `/manage/${initial.id}` : "/dashboard"}
        className="back-link"
      >
        <ArrowLeft aria-hidden="true" size={15} /> Back to{" "}
        {initial ? "tournament" : "dashboard"}
      </Link>
      <div className="page-heading">
        <div>
          <h1>{initial ? "Fine-tune your arena." : "Set the stage."}</h1>
          <p>Your squad. Your format. Your rules.</p>
        </div>
      </div>
      <form onSubmit={submit} noValidate className="setup-form">
        <div className="setup-main">
          <section className="panel">
            <h2>The basics</h2>
            <Field label="Tournament name" error={errors.name}>
              <input
                id="name"
                value={draft.name}
                maxLength={120}
                onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                  update("name", event.currentTarget.value)
                }
              />
            </Field>
            <fieldset>
              <legend>Choose your game</legend>
              <div className="choice-grid">
                {(["EFOOTBALL", "CODM"] as const).map(
                  (game: SetupDraft["game"]): ReactElement => (
                    <label
                      className={`choice ${draft.game === game ? "selected" : ""}`}
                      key={game}
                    >
                      <input
                        type="radio"
                        name="game"
                        checked={draft.game === game}
                        onChange={(): void => update("game", game)}
                      />
                      <strong>
                        {game === "EFOOTBALL"
                          ? "eFootball"
                          : "Call of Duty: Mobile"}
                      </strong>
                    </label>
                  ),
                )}
              </div>
            </fieldset>
          </section>
          <section className="panel">
            <h2>Your format</h2>
            <fieldset>
              <legend>Competition format</legend>
              <div className="choice-grid">
                {(["LEAGUE", "WORLD_CUP"] as const).map(
                  (format: SetupDraft["format"]): ReactElement => (
                    <label
                      className={`choice ${draft.format === format ? "selected" : ""}`}
                      key={format}
                    >
                      <input
                        type="radio"
                        name="format"
                        checked={draft.format === format}
                        onChange={(): void => update("format", format)}
                      />
                      <strong>
                        {format === "LEAGUE" ? "League" : "Groups + knockout"}
                      </strong>
                    </label>
                  ),
                )}
              </div>
            </fieldset>
            <div className="form-row">
              <Field label="Round robin fixtures">
                <select
                  value={draft.legs}
                  onChange={(event: ChangeEvent<HTMLSelectElement>): void =>
                    update("legs", event.currentTarget.value === "2" ? 2 : 1)
                  }
                >
                  <option value="1">Play each opponent once</option>
                  <option value="2">Play each opponent twice</option>
                </select>
              </Field>
              <div className="points-fields">
                {(["winPoints", "drawPoints", "lossPoints"] as const).map(
                  (
                    key: "winPoints" | "drawPoints" | "lossPoints",
                  ): ReactElement => (
                    <Field
                      key={key}
                      label={
                        key === "winPoints"
                          ? "Win"
                          : key === "drawPoints"
                            ? "Draw"
                            : "Loss"
                      }
                      error={errors[key]}
                    >
                      <input
                        id={key}
                        type="number"
                        min={0}
                        max={1000}
                        value={draft[key]}
                        onChange={(
                          event: ChangeEvent<HTMLInputElement>,
                        ): void => update(key, event.currentTarget.value)}
                      />
                    </Field>
                  ),
                )}
              </div>
            </div>
          </section>
          <section className="panel">
            <h2>Bring your squad</h2>
            <p>Team names or gamer names. No player accounts needed.</p>
            {errors.entrants && <p role="alert">{errors.entrants}</p>}
            <div className="entrant-list">
              {draft.entrants.map(
                (entry: DraftEntrant, index: number): ReactElement => (
                  <div className="entrant-row" key={entry.clientId}>
                    <TeamMark name={entry.name} index={index} />
                    <div className="entrant-fields">
                      <Field
                        label={`Team ${index + 1} name`}
                        error={errors[`entrant-${entry.clientId}`]}
                      >
                        <input
                          id={`entrant-${entry.clientId}`}
                          value={entry.name}
                          maxLength={80}
                          onChange={(
                            event: ChangeEvent<HTMLInputElement>,
                          ): void =>
                            entrant(entry.clientId, {
                              name: event.currentTarget.value,
                            })
                          }
                        />
                      </Field>
                      <Field
                        label={`Team ${index + 1} in-game names`}
                        hint="Optional; separate names with commas."
                      >
                        <input
                          value={entry.aliases}
                          onChange={(
                            event: ChangeEvent<HTMLInputElement>,
                          ): void =>
                            entrant(entry.clientId, {
                              aliases: event.currentTarget.value,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={
                        draft.entrants.length <= 2 || mutation.isPending
                      }
                      aria-label={`Remove team ${index + 1}`}
                      onClick={(): void =>
                        update(
                          "entrants",
                          draft.entrants.filter(
                            (other: DraftEntrant): boolean =>
                              other.clientId !== entry.clientId,
                          ),
                        )
                      }
                    >
                      <Trash2 aria-hidden="true" size={17} />
                    </button>
                  </div>
                ),
              )}
            </div>
            <button
              type="button"
              className="button secondary small"
              disabled={draft.entrants.length >= 256}
              onClick={(): void =>
                update("entrants", [...draft.entrants, newEntrant()])
              }
            >
              <Plus aria-hidden="true" size={15} /> Add team
            </button>
            <details className="bulk-import">
              <summary>Add several teams at once</summary>
              <Field label="One team name per line">
                <textarea
                  value={bulk}
                  rows={4}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>): void =>
                    setBulk(event.currentTarget.value)
                  }
                />
              </Field>
              <button
                type="button"
                className="button secondary small"
                onClick={(): void => {
                  const names = bulk
                    .split("\n")
                    .map((name: string): string => name.trim())
                    .filter(Boolean);
                  const entries = [
                    ...draft.entrants.filter((entry: DraftEntrant): boolean =>
                      Boolean(entry.name.trim()),
                    ),
                    ...names.map((name: string): DraftEntrant => ({
                      ...newEntrant(),
                      name,
                    })),
                  ];
                  if (entries.length > 256) {
                    setError("Use at most 256 teams.");
                    return;
                  }
                  update("entrants", entries);
                  setBulk("");
                }}
              >
                Add teams
              </button>
            </details>
          </section>
          {draft.format === "WORLD_CUP" && (
            <section className="panel">
              <h2>Set your groups</h2>
              {errors.groups && <p role="alert">{errors.groups}</p>}
              <div className="group-setup">
                {draft.groups.map((entry: DraftGroup): ReactElement => (
                  <div className="form-row" key={entry.clientId}>
                    <Field
                      label="Group name"
                      error={errors[`group-${entry.clientId}`]}
                    >
                      <input
                        id={`group-${entry.clientId}`}
                        value={entry.name}
                        maxLength={80}
                        onChange={(
                          event: ChangeEvent<HTMLInputElement>,
                        ): void =>
                          group(entry.clientId, {
                            name: event.currentTarget.value,
                          })
                        }
                      />
                    </Field>
                    <Field label={`Teams advancing from ${entry.name}`}>
                      <input
                        type="number"
                        min={1}
                        max={256}
                        value={entry.qualifierCount}
                        onChange={(
                          event: ChangeEvent<HTMLInputElement>,
                        ): void =>
                          group(entry.clientId, {
                            qualifierCount: event.currentTarget.value,
                          })
                        }
                      />
                    </Field>
                    <button
                      type="button"
                      className="icon-button"
                      disabled={draft.groups.length <= 1}
                      aria-label={`Remove ${entry.name}`}
                      onClick={(): void => {
                        setDraft((old: SetupDraft): SetupDraft => ({
                          ...old,
                          groups: old.groups.filter(
                            (other: DraftGroup): boolean =>
                              other.clientId !== entry.clientId,
                          ),
                          entrants: old.entrants.map(
                            (other: DraftEntrant): DraftEntrant =>
                              other.groupId === entry.clientId
                                ? { ...other, groupId: null }
                                : other,
                          ),
                        }));
                      }}
                    >
                      <Trash2 aria-hidden="true" size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="action-row">
                <button
                  type="button"
                  className="button secondary small"
                  disabled={draft.groups.length >= 128}
                  onClick={(): void =>
                    update("groups", [
                      ...draft.groups,
                      newGroup(`Group ${draft.groups.length + 1}`),
                    ])
                  }
                >
                  Add group
                </button>
                <button
                  type="button"
                  className="button secondary small"
                  onClick={randomize}
                >
                  <Shuffle aria-hidden="true" size={15} /> Distribute randomly
                </button>
              </div>
              <div className="group-assignments">
                {draft.entrants.map(
                  (entry: DraftEntrant, index: number): ReactElement => (
                    <div key={entry.clientId}>
                      <span>{entry.name || `Team ${index + 1}`}</span>
                      <Field
                        label={`Group for ${entry.name || `team ${index + 1}`}`}
                      >
                        <select
                          value={entry.groupId ?? ""}
                          onChange={(
                            event: ChangeEvent<HTMLSelectElement>,
                          ): void =>
                            entrant(entry.clientId, {
                              groupId: event.currentTarget.value || null,
                            })
                          }
                        >
                          <option value="">Choose group</option>
                          {draft.groups.map(
                            (other: DraftGroup): ReactElement => (
                              <option
                                value={other.clientId}
                                key={other.clientId}
                              >
                                {other.name}
                              </option>
                            ),
                          )}
                        </select>
                      </Field>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
          {latest && !reviewed && (
            <ConflictReview
              local={draft}
              latest={draftFromTournament(latest)}
              onUseLatest={(): void => {
                const value = draftFromTournament(latest);
                setDraft(value);
                setBaseline(JSON.stringify(value));
                setRevision(latest.revision);
                setLatest(null);
                setError("");
              }}
              onReapply={(): void => {
                const validation = validateSetupDraft(draft, latest);
                if (!validation.valid) {
                  setErrors(validation.errors);
                  setError("Correct invalid teams or rules before reapplying.");
                  return;
                }
                setRevision(latest.revision);
                setReviewed(true);
                setError(
                  "Draft reapplied. Review the fields, then save separately.",
                );
              }}
            />
          )}
          {error && (
            <div role="alert" className="inline-error">
              {error}
              {mutation.error instanceof ApiError &&
                mutation.error.status === 401 && (
                  <Link
                    to={`/auth/login?returnTo=${encodeURIComponent(initial ? `/manage/${initial.id}/setup` : "/new")}`}
                  >
                    Sign in to continue
                  </Link>
                )}
            </div>
          )}
          <div className="setup-bottom">
            <Link className="quiet-link" to="/dashboard">
              Cancel
            </Link>
            <button
              type="submit"
              className="button"
              disabled={mutation.isPending || Boolean(latest && !reviewed)}
            >
              <Save aria-hidden="true" size={17} />
              {mutation.isPending ? "Saving…" : "Save & review fixtures"}
            </button>
          </div>
        </div>
        <aside className="setup-summary">
          <h2>Your arena at a glance</h2>
          <h3>{draft.name || "The next rivalry"}</h3>
          <p>
            {draft.entrants.length} teams ·{" "}
            {draft.format === "LEAGUE" ? "League" : "Groups + knockout"}
          </p>
          <p>
            Fixtures are flexible. Play any match in the active stage, in any
            order.
          </p>
          <p>
            Once you start, teams and competition rules are locked. Results can
            still be corrected.
          </p>
        </aside>
      </form>
    </main>
  );
}
