import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronDown,
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
  useId,
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
import { Field, Modal, useToast } from "../../shared/ui/primitives";
import {
  aggregateDraft,
  resultPayload,
  ScoreValidationError,
  scoresFromMatch,
} from "./score-draft";
import {
  matchStatsPayload,
  statsFromMatch,
  type MatchStatDraft,
} from "./match-stats-draft";
import {
  DraftScores,
  mergeSuggestedScores,
  swapDraftScores,
} from "./suggestion-draft";
export interface MatchEditorProps {
  t: Tournament;
  match: Match;
  onClose: () => void;
  onSaved: (t: Tournament) => void;
  onNext?: (t: Tournament) => void;
  onCompleted?: () => void;
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
      advance: boolean;
    }
  | { status: "failure"; error: string; expired: boolean }
  | { status: "conflict"; latest: MatchSnapshot | null; error: string };
type ExtractionState =
  | { status: "idle" }
  | { status: "reading"; requestId: number }
  | { status: "suggested"; suggestion: Suggestion; reversed: boolean }
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
  onNext,
  onCompleted,
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
    scoresFromMatch(match, t),
  );
  const [statsDraft, setStatsDraft] = useState<MatchStatDraft[]>(
    (): MatchStatDraft[] => statsFromMatch(match.stats ?? null),
  );
  const statsId = useId();
  const [statsOpen, setStatsOpen] = useState<boolean>((): boolean =>
    statsDraft.some(
      (stat: MatchStatDraft): boolean => stat.home !== "" || stat.away !== "",
    ),
  );
  const [initial, setInitial] = useState(
    JSON.stringify({ scores, statsDraft }),
  );
  const scorecardInput = useRef<HTMLInputElement>(null);
  const [swapAnnouncement, setSwapAnnouncement] = useState("");
  const [state, setState] = useState<SaveState>({ status: "editing" }),
    [extraction, setExtraction] = useState<ExtractionState>({ status: "idle" }),
    [upload, setUpload] = useState<UploadDraft | null>(null),
    [mapping, setMapping] = useState("");
  const touched = useRef<Set<keyof DraftScores>>(new Set()),
    manuallyTouched = useRef<Set<keyof DraftScores>>(new Set()),
    touchedStats = useRef<Set<string>>(new Set()),
    mounted = useRef(true),
    requestId = useRef(0),
    abort = useRef<AbortController | null>(null),
    url = useRef(""),
    busy = useRef(false);
  const aggregate = aggregateDraft(base.t, base.match, scores);
  const decisionHome = aggregate
    ? base.t.entrants.find(
        (e: Tournament["entrants"][number]): boolean =>
          e.id === aggregate.tie.homeId,
      )
    : home;
  const decisionAway = aggregate
    ? base.t.entrants.find(
        (e: Tournament["entrants"][number]): boolean =>
          e.id === aggregate.tie.awayId,
      )
    : away;
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
  const dirty = JSON.stringify({ scores, statsDraft }) !== initial;
  const fingerprint = JSON.stringify([
    scores,
    statsDraft,
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
    manuallyTouched.current.add(key);
    setFieldError(null);
    setScores((old: DraftScores): DraftScores => ({
      ...old,
      [key]: value,
      ...(aggregate && (key === "home" || key === "away") && old[key] !== value
        ? { winner: "", homeTiebreak: "", awayTiebreak: "" }
        : {}),
    }));
    if (state.status !== "conflict") setState({ status: "editing" });
  };
  const swapResults = (): void => {
    if (
      !home ||
      !away ||
      pending ||
      busy.current ||
      extraction.status === "reading"
    )
      return;
    const next = swapDraftScores(scores, {
      homeId: home.id,
      awayId: away.id,
      aggregate: aggregate !== null,
    });
    for (const key of [
      "home",
      "away",
      "homeTiebreak",
      "awayTiebreak",
      "winner",
    ] as const) {
      touched.current.add(key);
      manuallyTouched.current.delete(key);
    }
    setScores(next);
    setStatsDraft((old: MatchStatDraft[]): MatchStatDraft[] =>
      old.map((stat: MatchStatDraft): MatchStatDraft => ({
        ...stat,
        home: stat.away,
        away: stat.home,
      })),
    );
    statsDraft.forEach((stat: MatchStatDraft): void => {
      touchedStats.current.add(`${stat.key}.home`);
      touchedStats.current.add(`${stat.key}.away`);
    });
    setFieldError(null);
    if (state.status !== "conflict") setState({ status: "editing" });
    setExtraction((old: ExtractionState): ExtractionState =>
      old.status === "suggested" ? { ...old, reversed: !old.reversed } : old,
    );
    setMapping((old: string): string =>
      old === "" ? "" : old === "reverse" ? "normal" : "reverse",
    );
    setSwapAnnouncement(
      `Results swapped. ${home.name}: ${next.home || "empty"}. ${away.name}: ${next.away || "empty"}.${aggregate ? " Review the aggregate decision." : " Review before saving."}`,
    );
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
      setExtraction((old: ExtractionState): ExtractionState =>
        old.status === "suggested" ? { ...old, reversed } : old,
      );
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
    if (aggregate) {
      values.homeTiebreak = null;
      values.awayTiebreak = null;
    }
    setScores((old: DraftScores): DraftScores =>
      mergeSuggestedScores(old, values, touched.current),
    );
    if (
      suggestion.stats?.some(
        (stat: NonNullable<Suggestion["stats"]>[number]): boolean =>
          stat.home !== null || stat.away !== null,
      )
    )
      setStatsOpen(true);
    const reverseStats =
      reversed ?? (extraction.status === "suggested" && extraction.reversed);
    setStatsDraft((old: MatchStatDraft[]): MatchStatDraft[] =>
      old.map((stat: MatchStatDraft): MatchStatDraft => {
        const suggested = suggestion.stats?.find(
          (candidate: NonNullable<Suggestion["stats"]>[number]): boolean =>
            candidate.key === stat.key,
        );
        if (!suggested) return stat;
        const homeValue = reverseStats ? suggested.away : suggested.home;
        const awayValue = reverseStats ? suggested.home : suggested.away;
        return {
          ...stat,
          home:
            touchedStats.current.has(`${stat.key}.home`) || homeValue === null
              ? stat.home
              : String(homeValue),
          away:
            touchedStats.current.has(`${stat.key}.away`) || awayValue === null
              ? stat.away
              : String(awayValue),
        };
      }),
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
    setSwapAnnouncement("");
    setMapping("");
  };
  const read = async (): Promise<void> => {
    if (!upload || pending) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const active = ++requestId.current;
    manuallyTouched.current.forEach((key: keyof DraftScores): void => {
      touched.current.delete(key);
    });
    manuallyTouched.current.clear();
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
      setExtraction({ status: "suggested", suggestion, reversed: false });
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
  const save = async (
    body: ResultInput,
    advance: boolean = false,
  ): Promise<void> => {
    setState({ status: "saving" });
    const result = await saveMutation.mutateAsync(body);
    if (!mounted.current) return;
    onSaved(result);
    setInitial(JSON.stringify({ scores, statsDraft }));
    toast(
      body.homeScore === null
        ? "Result cleared"
        : "Result saved. Standings updated.",
    );
    if (advance && onNext) onNext(result);
    else (onCompleted ?? onClose)();
  };
  const submit = async (
    clear: boolean = false,
    advance: boolean = false,
  ): Promise<void> => {
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
      const body = resultPayload(
        scores,
        base.match,
        base.t.revision,
        clear,
        base.t,
      );
      if (base.t.statsEnabled && !clear)
        body.stats = matchStatsPayload(statsDraft);
      const impact = await previewMutation.mutateAsync(body);
      if (!mounted.current) return;
      if (impact.requiresReset)
        setState({
          status: "confirming",
          impact,
          payload: body,
          fingerprint,
          advance,
        });
      else await save(body, advance);
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
      await save(
        {
          ...confirmation.payload,
          confirmReset: true,
          impactToken: confirmation.impact.impactToken,
        },
        confirmation.advance,
      );
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
  const canSwap =
    [scores.home, scores.away, scores.homeTiebreak, scores.awayTiebreak].some(
      (value: string): boolean => value !== "",
    ) ||
    (suggestion?.stats ?? []).some(
      (stat: NonNullable<Suggestion["stats"]>[number]): boolean =>
        stat.home !== null || stat.away !== null,
    );
  return (
    <Modal
      className="score-editor-modal"
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
        <div className="match-editor-body">
          <div className="match-context">
            <span>
              Round {match.round} ·{" "}
              {match.stage === "KNOCKOUT" ? "Knockout" : "Round robin"}
            </span>
            <span>Play in any order</span>
          </div>
          <div className="scoreboard-input">
            <h3 className="score-team-home">{home.name}</h3>
            <label className="sr-only" htmlFor={`${match.id}-home`}>
              {home.name} score
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={2147483647}
              step={1}
              id={`${match.id}-home`}
              value={scores.home}
              aria-invalid={fieldError?.field === "home" || undefined}
              aria-describedby={
                fieldError?.field === "home"
                  ? `${match.id}-score-error`
                  : undefined
              }
              onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                change("home", event.currentTarget.value)
              }
            />
            <span className="score-separator" aria-hidden="true">
              :
            </span>
            <label className="sr-only" htmlFor={`${match.id}-away`}>
              {away.name} score
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={2147483647}
              step={1}
              id={`${match.id}-away`}
              value={scores.away}
              aria-invalid={fieldError?.field === "away" || undefined}
              aria-describedby={
                fieldError?.field === "away"
                  ? `${match.id}-score-error`
                  : undefined
              }
              onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                change("away", event.currentTarget.value)
              }
            />
            <h3 className="score-team-away">{away.name}</h3>
          </div>
          {(fieldError?.field === "home" || fieldError?.field === "away") && (
            <p
              className="score-error inline-error"
              id={`${match.id}-score-error`}
              role="alert"
            >
              {fieldError.message}
            </p>
          )}
          <div className="swap-results">
            <button
              type="button"
              className="button secondary small"
              onClick={swapResults}
              disabled={!canSwap || pending || extraction.status === "reading"}
            >
              <ArrowLeftRight aria-hidden="true" size={16} /> Swap results
            </button>
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className={swapAnnouncement ? "" : "sr-only"}
            >
              {swapAnnouncement}
            </p>
          </div>
          {aggregate && (
            <p role="status">
              Aggregate: {decisionHome?.name} {aggregate.homeAggregate} –{" "}
              {aggregate.awayAggregate} {decisionAway?.name}.{" "}
              {match.leg === 1
                ? "Both legs must finish before a team advances."
                : "No away-goals rule applies."}
            </p>
          )}
          {match.stage === "KNOCKOUT" &&
            (aggregate
              ? aggregate.canDecide
              : scores.home !== "" &&
                scores.away !== "" &&
                scores.home === scores.away) && (
              <div className="tiebreak-box">
                <Field
                  label={
                    aggregate
                      ? "Winner of the tied aggregate"
                      : "Winner of the tied match"
                  }
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
                    <option value={decisionHome?.id}>
                      {decisionHome?.name}
                    </option>
                    <option value={decisionAway?.id}>
                      {decisionAway?.name}
                    </option>
                  </select>
                </Field>
                <div className="form-row">
                  <Field
                    label={`${decisionHome?.name} tiebreak (optional)`}
                    error={
                      fieldError?.field === "homeTiebreak"
                        ? fieldError.message
                        : undefined
                    }
                  >
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      id={`${match.id}-homeTiebreak`}
                      value={scores.homeTiebreak}
                      onChange={(event: ChangeEvent<HTMLInputElement>): void =>
                        change("homeTiebreak", event.currentTarget.value)
                      }
                    />
                  </Field>
                  <Field
                    label={`${decisionAway?.name} tiebreak (optional)`}
                    error={
                      fieldError?.field === "awayTiebreak"
                        ? fieldError.message
                        : undefined
                    }
                  >
                    <input
                      type="number"
                      inputMode="numeric"
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
          {t.game === "EFOOTBALL" && (
            <section className="upload-section" aria-label="Scorecard import">
              <div className="scorecard-actions">
                <button
                  type="button"
                  className="button secondary small"
                  disabled={pending}
                  onClick={(): void => scorecardInput.current?.click()}
                >
                  <Upload size={17} aria-hidden="true" /> Import scorecard
                </button>
                <button
                  type="button"
                  className="button secondary small"
                  disabled={
                    !upload || pending || extraction.status === "reading"
                  }
                  onClick={read}
                >
                  {extraction.status === "reading" ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="spin"
                      size={17}
                    />
                  ) : (
                    <ScanLine aria-hidden="true" size={17} />
                  )}
                  {extraction.status === "reading"
                    ? "Reading scorecard…"
                    : "Read scorecard"}
                </button>
                <input
                  ref={scorecardInput}
                  className="sr-only"
                  tabIndex={-1}
                  aria-label="Scorecard image"
                  type="file"
                  disabled={pending}
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseFile}
                />
              </div>
              {upload && (
                <>
                  <p className="scorecard-filename">{upload.file.name}</p>
                  <img
                    className="scorecard-preview"
                    width={480}
                    height={180}
                    src={upload.url}
                    alt="Uploaded match scorecard"
                  />
                </>
              )}
              {extraction.status === "reading" && (
                <p role="status">
                  Reading the scorecard. You can keep editing or replace the
                  file.
                </p>
              )}
              {extraction.status === "failure" && (
                <p className="inline-error" role="alert">
                  {extraction.error}
                </p>
              )}
              {suggestion &&
                (!suggestion.matched || suggestion.warnings.length > 0) && (
                  <div className="extraction-review">
                    {!suggestion.matched && (
                      <p role="status">Map the observed sides to your teams.</p>
                    )}
                    {suggestion.warnings.length > 0 &&
                      extraction.status === "suggested" &&
                      extraction.reversed && (
                        <p className="warning-text">
                          Warnings describe the original screenshot sides.
                        </p>
                      )}
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
                              (
                                side: Suggestion["observedSides"][number],
                              ): string =>
                                `${side.name ?? "Unreadable name"} (${side.score ?? "?"})`,
                            )
                            .join(" vs ")}
                        </p>
                        <Field label="Which side is the first team?">
                          <select
                            value={mapping}
                            onChange={(
                              event: ChangeEvent<HTMLSelectElement>,
                            ): void => setMapping(event.currentTarget.value)}
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
            </section>
          )}
          {base.t.statsEnabled && (
            <section className="match-stats-editor" aria-label="Match stats">
              <button
                type="button"
                className="match-stats-toggle"
                aria-expanded={statsOpen}
                aria-controls={statsId}
                onClick={(): void => setStatsOpen(!statsOpen)}
              >
                <span>Add match statistics (optional)</span>
                <ChevronDown size={18} aria-hidden="true" />
              </button>
              <p className="muted">Only scores are required.</p>
              <div id={statsId} hidden={!statsOpen}>
                <div className="match-stat-fields">
                  {statsDraft.map((stat: MatchStatDraft): ReactElement => (
                    <div
                      className="match-stat-row"
                      role="group"
                      aria-label={stat.label}
                      key={stat.key}
                    >
                      <Field label={home.name}>
                        <input
                          aria-label={`${home.name} ${stat.label}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={stat.unit === "percent" ? 100 : 9999}
                          step={1}
                          value={stat.home}
                          onChange={(
                            event: ChangeEvent<HTMLInputElement>,
                          ): void => {
                            const value = event.currentTarget.value;
                            touchedStats.current.add(`${stat.key}.home`);
                            setStatsDraft(
                              (old: MatchStatDraft[]): MatchStatDraft[] =>
                                old.map(
                                  (entry: MatchStatDraft): MatchStatDraft =>
                                    entry.key === stat.key
                                      ? {
                                          ...entry,
                                          home: value,
                                        }
                                      : entry,
                                ),
                            );
                          }}
                        />
                      </Field>
                      <span className="match-stat-name">
                        {stat.label}
                        {stat.unit === "percent" ? " (%)" : ""}
                      </span>
                      <Field label={away.name}>
                        <input
                          aria-label={`${away.name} ${stat.label}`}
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={stat.unit === "percent" ? 100 : 9999}
                          step={1}
                          value={stat.away}
                          onChange={(
                            event: ChangeEvent<HTMLInputElement>,
                          ): void => {
                            const value = event.currentTarget.value;
                            touchedStats.current.add(`${stat.key}.away`);
                            setStatsDraft(
                              (old: MatchStatDraft[]): MatchStatDraft[] =>
                                old.map(
                                  (entry: MatchStatDraft): MatchStatDraft =>
                                    entry.key === stat.key
                                      ? {
                                          ...entry,
                                          away: value,
                                        }
                                      : entry,
                                ),
                            );
                          }}
                        />
                      </Field>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
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
                  ? scoresFromMatch(state.latest.match, state.latest.t)
                  : "Fixture unavailable"
              }
              error={state.error}
              onUseLatest={(): void => {
                if (!state.latest) return;
                setBase(state.latest);
                const value = scoresFromMatch(
                  state.latest.match,
                  state.latest.t,
                );
                setScores(value);
                setInitial(JSON.stringify(value));
                touched.current.clear();
                manuallyTouched.current.clear();
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
                    false,
                    state.latest.t,
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
                {confirmation.impact.matchIds.length} downstream fixtures will
                be removed. Their results remain in history.
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
        </div>
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
          {onNext && (
            <button
              type="button"
              className="button secondary"
              disabled={
                pending ||
                extraction.status === "reading" ||
                Boolean(confirmation) ||
                state.status === "conflict"
              }
              onClick={(): Promise<void> => submit(false, true)}
            >
              Save & next match
            </button>
          )}
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
