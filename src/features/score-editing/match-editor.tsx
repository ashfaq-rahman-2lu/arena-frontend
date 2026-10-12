import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  LoaderCircle,
  RotateCcw,
  ScanLine,
  Upload,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  api,
  ApiError,
  errorMessage,
  Impact,
  Match,
  ResultInput,
  Suggestion,
  Tournament,
} from "../../shared/api/arena-api";
import { DraftNavigationBoundary } from "../../shared/hooks/use-dirty-draft";
import { ConflictReview } from "../../shared/ui/conflict-review";
import { Field, Modal, TeamMark, useToast } from "../../shared/ui/primitives";
import {
  resultPayload,
  ScoreValidationError,
  scoresFromMatch,
} from "./score-draft";
import { DraftScores, mergeSuggestedScores } from "./suggestion-draft";
export interface MatchEditorProps {
  t: Tournament;
  match: Match;
  onClose: () => void;
  onSaved: (t: Tournament) => void;
}
interface MatchSnapshot {
  t: Tournament;
  match: Match;
}
interface UploadDraft {
  file: File;
  url: string;
}
type SaveState =
  | { status: "editing" }
  | { status: "previewing" }
  | { status: "saving" }
  | {
      status: "confirming";
      impact: Impact;
      payload: ResultInput;
      fingerprint: string;
    }
  | { status: "failure"; error: string; expired: boolean }
  | { status: "conflict"; latest: MatchSnapshot | null; error: string };
type ExtractionState =
  | { status: "idle" }
  | { status: "reading"; requestId: number }
  | { status: "suggested"; suggestion: Suggestion }
  | { status: "failure"; error: string };
interface ExtractionRequest {
  file: File;
  signal: AbortSignal;
  matchId: string;
}
export function MatchEditor({
  t,
  match,
  onClose,
  onSaved,
}: MatchEditorProps): ReactElement {
  const home = t.entrants.find(
      (entrant: Tournament["entrants"][number]): boolean =>
        entrant.id === match.homeId,
    ),
    away = t.entrants.find(
      (entrant: Tournament["entrants"][number]): boolean =>
        entrant.id === match.awayId,
    );
  const toast = useToast();
  const [base, setBase] = useState<MatchSnapshot>({ t, match });
  const [fieldError, setFieldError] = useState<ScoreValidationError | null>(
    null,
  );
  const [scores, setScores] = useState<DraftScores>((): DraftScores =>
    scoresFromMatch(match),
  );
  const [initial, setInitial] = useState(JSON.stringify(scores));
  const [state, setState] = useState<SaveState>({ status: "editing" }),
    [extraction, setExtraction] = useState<ExtractionState>({ status: "idle" }),
    [upload, setUpload] = useState<UploadDraft | null>(null),
    [mapping, setMapping] = useState("");
  const touched = useRef<Set<keyof DraftScores>>(new Set()),
    mounted = useRef(true),
    requestId = useRef(0),
    abort = useRef<AbortController | null>(null),
    url = useRef(""),
    busy = useRef(false);
  const saveMutation = useMutation({
    mutationFn: (body: ResultInput): Promise<Tournament> =>
      api.result(match.id, body),
    retry: false,
  });
  const previewMutation = useMutation({
    mutationFn: (body: ResultInput): Promise<Impact> =>
      api.impact(match.id, body),
    retry: false,
  });
  const extractionMutation = useMutation({
    mutationFn: (request: ExtractionRequest): Promise<Suggestion> =>
      api.extract(request.matchId, request.file, request.signal),
    retry: false,
  });
  useEffect((): (() => void) => {
    mounted.current = true;
    return (): void => {
      mounted.current = false;
      abort.current?.abort();
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, []);
  const pending = state.status === "saving" || state.status === "previewing";
  const dirty = JSON.stringify(scores) !== initial;
  const fingerprint = JSON.stringify([
    scores,
    base.t.revision,
    base.match.revision,
    t.revision,
    match.revision,
  ]);
  const confirmation =
    state.status === "confirming" && state.fingerprint === fingerprint
      ? state
      : null;
  const change = (key: keyof DraftScores, value: string): void => {
    touched.current.add(key);
    setFieldError(null);
    setScores((old: DraftScores): DraftScores => ({ ...old, [key]: value }));
    if (state.status !== "conflict") setState({ status: "editing" });
  };
  const apply = (suggestion: Suggestion, reversed?: boolean): void => {
    let values = {
      home: suggestion.homeScore,
      away: suggestion.awayScore,
      homeTiebreak: suggestion.homeTiebreak,
      awayTiebreak: suggestion.awayTiebreak,
    };
    if (!suggestion.matched) {
      if (reversed === undefined) return;
      const sides = reversed
        ? [suggestion.observedSides[1], suggestion.observedSides[0]]
        : suggestion.observedSides;
      if (!sides[0] || !sides[1]) return;
      values = {
        home: sides[0].score,
        away: sides[1].score,
        homeTiebreak: sides[0].tiebreak,
        awayTiebreak: sides[1].tiebreak,
      };
    }
    setScores((old: DraftScores): DraftScores =>
      mergeSuggestedScores(old, values, touched.current),
    );
    setState({ status: "editing" });
  };
  const chooseFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (
      file.size > 10 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setExtraction({
        status: "failure",
        error: "Choose a JPEG, PNG or WebP image up to 10 MB.",
      });
      return;
    }
    requestId.current++;
    abort.current?.abort();
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = URL.createObjectURL(file);
    setUpload({ file, url: url.current });
    setExtraction({ status: "idle" });
    setMapping("");
  };
  const read = async (): Promise<void> => {
    if (!upload || pending) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const active = ++requestId.current;
    setExtraction({ status: "reading", requestId: active });
    try {
      const suggestion = await extractionMutation.mutateAsync({
        file: upload.file,
        signal: controller.signal,
        matchId: match.id,
      });
      if (
        !mounted.current ||
        requestId.current !== active ||
        controller.signal.aborted
      )
        return;
      setExtraction({ status: "suggested", suggestion });
      if (suggestion.matched) apply(suggestion);
    } catch (error: unknown) {
      if (
        mounted.current &&
        requestId.current === active &&
        !controller.signal.aborted
      )
        setExtraction({ status: "failure", error: errorMessage(error) });
    }
  };
  const fail = async (error: unknown): Promise<void> => {
    if (error instanceof ApiError && error.code === "REVISION_CONFLICT") {
      try {
        const latest = await api.get(t.id);
        const latestMatch = latest.matches.find(
          (entry: Match): boolean => entry.id === match.id,
        );
        setState({
          status: "conflict",
          latest: latestMatch ? { t: latest, match: latestMatch } : null,
          error: latestMatch
            ? ""
            : "This fixture was removed. Keep a copy of your draft, then close the editor.",
        });
      } catch (refreshError: unknown) {
        setState({
          status: "conflict",
          latest: null,
          error: errorMessage(refreshError),
        });
      }
    } else
      setState({
        status: "failure",
        error: errorMessage(error),
        expired: error instanceof ApiError && error.status === 401,
      });
  };
  const save = async (body: ResultInput): Promise<void> => {
    setState({ status: "saving" });
    const result = await saveMutation.mutateAsync(body);
    if (!mounted.current) return;
    onSaved(result);
    setInitial(JSON.stringify(scores));
    toast(
      body.homeScore === null
        ? "Result cleared"
        : "Result saved. Standings updated.",
    );
    onClose();
  };
  const submit = async (clear: boolean = false): Promise<void> => {
    if (busy.current || pending || state.status === "conflict") return;
    if (
      clear &&
      !window.confirm(
        "Clear this saved result? You can enter a new result afterward.",
      )
    )
      return;
    busy.current = true;
    setState({ status: "previewing" });
    try {
      setFieldError(null);
      const body = resultPayload(scores, base.match, base.t.revision, clear);
      const impact = await previewMutation.mutateAsync(body);
      if (!mounted.current) return;
      if (impact.requiresReset)
        setState({ status: "confirming", impact, payload: body, fingerprint });
      else await save(body);
    } catch (error: unknown) {
      if (error instanceof ScoreValidationError) {
        setFieldError(error);
        document.getElementById(`${match.id}-${error.field}`)?.focus();
      }
      if (mounted.current) await fail(error);
    } finally {
      busy.current = false;
    }
  };
  const confirm = async (): Promise<void> => {
    if (!confirmation || busy.current) return;
    busy.current = true;
    try {
      await save({
        ...confirmation.payload,
        confirmReset: true,
        impactToken: confirmation.impact.impactToken,
      });
    } catch (error: unknown) {
      await fail(error);
    } finally {
      busy.current = false;
    }
  };
  if (!home || !away)
    return (
      <Modal title="Fixture unavailable" onClose={onClose}>
        <p>One of these teams is no longer available.</p>
      </Modal>
    );
  const suggestion =
    extraction.status === "suggested" ? extraction.suggestion : null;
  return (
    <Modal
      title="Make the result official"
      onClose={onClose}
      dirty={dirty}
      pending={pending}
      wide
    >
      <DraftNavigationBoundary dirty={dirty} />
      <form
        className="match-editor"
        noValidate
        onSubmit={(event: FormEvent<HTMLFormElement>): void => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="match-context">
          <span>
            Round {match.round} ·{" "}
            {match.stage === "KNOCKOUT" ? "Knockout" : "Round robin"}
          </span>
          <span>Play in any order</span>
        </div>
        <div className="scoreboard-input">
          <div>
            <TeamMark name={home.name} />
            <h3>{home.name}</h3>
            <Field
              label={`${home.name} score`}
              error={
                fieldError?.field === "home" ? fieldError.message : undefined
              }
            >
              <input
                type="number"
                min={0}
                max={2147483647}
                step={1}
                id={`${match.id}-home`}
                value={scores.home}
                onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                  change("home", event.currentTarget.value)
                }
              />
            </Field>
          </div>
          <span className="score-separator" aria-hidden="true">
            :
          </span>
          <div>
            <TeamMark name={away.name} />
            <h3>{away.name}</h3>
            <Field
              label={`${away.name} score`}
              error={
                fieldError?.field === "away" ? fieldError.message : undefined
              }
            >
              <input
                type="number"
                min={0}
                max={2147483647}
                step={1}
                id={`${match.id}-away`}
                value={scores.away}
                onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                  change("away", event.currentTarget.value)
                }
              />
            </Field>
          </div>
        </div>
        {match.stage === "KNOCKOUT" &&
          scores.home !== "" &&
          scores.away !== "" &&
          scores.home === scores.away && (
            <div className="tiebreak-box">
              <Field
                label="Winner of the tied match"
                error={
                  fieldError?.field === "winner"
                    ? fieldError.message
                    : undefined
                }
              >
                <select
                  id={`${match.id}-winner`}
                  value={scores.winner}
                  onChange={(event: ChangeEvent<HTMLSelectElement>): void =>
                    change("winner", event.currentTarget.value)
                  }
                >
                  <option value="">Choose winner</option>
                  <option value={home.id}>{home.name}</option>
                  <option value={away.id}>{away.name}</option>
                </select>
              </Field>
              <div className="form-row">
                <Field
                  label={`${home.name} tiebreak (optional)`}
                  error={
                    fieldError?.field === "homeTiebreak"
                      ? fieldError.message
                      : undefined
                  }
                >
                  <input
                    type="number"
                    min={0}
                    id={`${match.id}-homeTiebreak`}
                    value={scores.homeTiebreak}
                    onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                      change("homeTiebreak", event.currentTarget.value)
                    }
                  />
                </Field>
                <Field
                  label={`${away.name} tiebreak (optional)`}
                  error={
                    fieldError?.field === "awayTiebreak"
                      ? fieldError.message
                      : undefined
                  }
                >
                  <input
                    type="number"
                    min={0}
                    id={`${match.id}-awayTiebreak`}
                    value={scores.awayTiebreak}
                    onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                      change("awayTiebreak", event.currentTarget.value)
                    }
                  />
                </Field>
              </div>
            </div>
          )}
        <div className="upload-section">
          <h3>
            <ScanLine aria-hidden="true" size={18} /> Have a scorecard?
          </h3>
          <p>Upload it to suggest scores, then review before saving.</p>
          <label className="upload-drop">
            <Upload aria-hidden="true" size={24} />
            <span>{upload?.file.name ?? "Choose a scorecard image"}</span>
            <small>JPEG, PNG or WebP · up to 10 MB</small>
            <input
              aria-label="Scorecard image"
              type="file"
              disabled={pending}
              accept="image/jpeg,image/png,image/webp"
              onChange={chooseFile}
            />
          </label>
          {upload && (
            <>
              <img
                className="scorecard-preview"
                width={480}
                height={180}
                src={upload.url}
                alt="Uploaded match scorecard"
              />
              <button
                type="button"
                className="button secondary full"
                disabled={pending || extraction.status === "reading"}
                onClick={read}
              >
                {extraction.status === "reading" ? (
                  <LoaderCircle aria-hidden="true" className="spin" size={17} />
                ) : (
                  <ScanLine aria-hidden="true" size={17} />
                )}{" "}
                {extraction.status === "reading"
                  ? "Reading scorecard…"
                  : "Read scorecard"}
              </button>
            </>
          )}
          {extraction.status === "reading" && (
            <p role="status">
              Reading the scorecard. You can keep editing or replace the file.
            </p>
          )}
          {extraction.status === "failure" && (
            <p className="inline-error" role="alert">
              {extraction.error}
            </p>
          )}
          {suggestion && (
            <div className="extraction-review">
              <p role="status">
                {suggestion.matched
                  ? "Suggested scores filled. Review them above."
                  : "Map the observed sides to your teams."}
              </p>
              {suggestion.warnings.map(
                (warning: string, index: number): ReactElement => (
                  <p className="warning-text" key={`${index}:${warning}`}>
                    {warning}
                  </p>
                ),
              )}
              {!suggestion.matched && (
                <>
                  <p>
                    {suggestion.observedSides
                      .map(
                        (side: Suggestion["observedSides"][number]): string =>
                          `${side.name ?? "Unreadable name"} (${side.score ?? "?"})`,
                      )
                      .join(" vs ")}
                  </p>
                  <Field label="Which side is the first team?">
                    <select
                      value={mapping}
                      onChange={(event: ChangeEvent<HTMLSelectElement>): void =>
                        setMapping(event.currentTarget.value)
                      }
                    >
                      <option value="">Choose the mapping</option>
                      <option value="normal">
                        First observed side is {home.name}
                      </option>
                      <option value="reverse">
                        First observed side is {away.name}
                      </option>
                    </select>
                  </Field>
                  <button
                    type="button"
                    className="button secondary small"
                    disabled={!mapping}
                    onClick={(): void =>
                      apply(suggestion, mapping === "reverse")
                    }
                  >
                    Apply mapped scores
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {state.status === "failure" && (
          <div className="inline-error" role="alert">
            {state.error}
            {state.expired && (
              <Link
                to={`/auth/login?returnTo=${encodeURIComponent(`/manage/${t.id}`)}`}
              >
                Sign in again
              </Link>
            )}
          </div>
        )}
        {state.status === "conflict" && (
          <ConflictReview
            local={scores}
            latest={
              state.latest
                ? scoresFromMatch(state.latest.match)
                : "Fixture unavailable"
            }
            error={state.error}
            onUseLatest={(): void => {
              if (!state.latest) return;
              setBase(state.latest);
              const value = scoresFromMatch(state.latest.match);
              setScores(value);
              setInitial(JSON.stringify(value));
              touched.current.clear();
              setState({ status: "editing" });
            }}
            onReapply={(): void => {
              if (!state.latest) return;
              try {
                if (
                  state.latest.match.homeId !== match.homeId ||
                  state.latest.match.awayId !== match.awayId
                )
                  throw new Error(
                    "The opponents changed. Use the latest fixture before editing.",
                  );
                resultPayload(
                  scores,
                  state.latest.match,
                  state.latest.t.revision,
                );
                setBase(state.latest);
                setState({ status: "editing" });
                toast("Draft reapplied. Review it and save separately.");
              } catch (error: unknown) {
                setState({ ...state, error: errorMessage(error) });
              }
            }}
          />
        )}
        {confirmation && (
          <div className="reset-preview">
            <h3>
              <AlertTriangle aria-hidden="true" size={19} /> This correction
              changes progression
            </h3>
            <p>{confirmation.impact.reason}</p>
            <p>
              {confirmation.impact.matchIds.length} downstream fixtures will be
              removed. Their results remain in history.
            </p>
            <div className="action-row">
              <button
                type="button"
                className="button danger"
                disabled={pending}
                onClick={confirm}
              >
                Confirm correction & reset
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={(): void => setState({ status: "editing" })}
              >
                Cancel reset
              </button>
            </div>
          </div>
        )}
        <div className="modal-actions">
          {base.match.homeScore !== null && (
            <button
              type="button"
              className="text-button muted"
              disabled={pending}
              onClick={(): Promise<void> => submit(true)}
            >
              <RotateCcw aria-hidden="true" size={15} /> Clear result
            </button>
          )}
          <div />
          <button
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={(): void => {
              if (!dirty || window.confirm("Discard unsaved scores?"))
                onClose();
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button"
            disabled={
              pending ||
              extraction.status === "reading" ||
              Boolean(confirmation) ||
              state.status === "conflict"
            }
          >
            {pending ? "Saving…" : "Save result"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
