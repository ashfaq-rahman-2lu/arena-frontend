import { TeamStatsPanel } from "./team-stats-panel";
import { TournamentHeader } from "./tournament-header";
import { TournamentNavigation } from "./tournament-navigation";
import { StandingsTable } from "./standings-table";
import { FixtureRounds } from "./fixture-rounds";
import { TournamentTools } from "./tournament-tools";
import { KnockoutBoard } from "./knockout-board";
import { KnockoutPairing } from "./knockout-pairing";
import { PublicMatchStatsDialog } from "./public-match-stats-dialog";
import type { PairingOptions } from "../../shared/api/arena-api";
interface TournamentPageProps {
  admin?: boolean;
}
import type {
  QueryFunctionContext,
  QueryObserverResult,
} from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Archive,
  ChartNoAxesCombined,
  Check,
  History,
  Pencil,
  Play,
  Settings2,
  Swords,
} from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import type { components } from "../../generated/api";
import type { Entrant } from "../../shared/api/arena-api";
import {
  api,
  ApiError,
  errorMessage,
  type Match,
  type TeamStats,
  type Tournament,
} from "../../shared/api/arena-api";
import {
  useCompetition,
  useHistory,
  usePreview,
  useTournamentMutation,
} from "../../shared/api/query-hooks";
import { queryKeys } from "../../shared/api/query-keys";
import { Pagination } from "../../shared/ui/pagination";
import {
  ErrorState,
  Modal,
  ShareButton,
  Spinner,
  TeamMark,
  useSession,
  useToast,
} from "../../shared/ui/primitives";
import {
  DialogFeedback,
  DialogRecoveryContext,
  RenameModal,
  TieModal,
} from "./management-dialogs";
const ResultEntry = lazy(
  async (): Promise<{
    default: typeof import("./result-entry").ResultEntry;
  }> => ({ default: (await import("./result-entry")).ResultEntry }),
);
const MatchEditor = lazy(
  async (): Promise<{
    default: typeof import("../score-editing/match-editor").MatchEditor;
  }> => ({
    default: (await import("../score-editing/match-editor")).MatchEditor,
  }),
);
export function TournamentPage({
  admin = false,
}: TournamentPageProps): React.JSX.Element {
  const { id, publicId } = useParams();
  const toast = useToast(),
    cache = useQueryClient();
  const session = useSession();
  const ownerId = session.data?.user?.id ?? "";
  const key = admin
    ? queryKeys.detail(ownerId, id ?? "")
    : queryKeys.public(publicId ?? "");
  const query = useCompetition(admin, ownerId, id ?? "", publicId ?? "");
  const mutation = useTournamentMutation(ownerId);
  const [params, setParams] = useSearchParams();
  const defaultTab =
    query.data?.format === "KNOCKOUT" ? "knockout" : "standings";
  const requestedTab = params.get("tab");
  const tab =
    !requestedTab || requestedTab === "overview" ? defaultTab : requestedTab;
  useEffect((): void => {
    if (!query.data || params.get("tab") !== "overview") return;
    const next = new URLSearchParams(params);
    next.set("tab", defaultTab);
    setParams(next, { replace: true });
  }, [query.data, params, setParams, defaultTab]);
  const statsQuery = useQuery({
    queryKey: [
      "team-stats",
      publicId ?? query.data?.publicId ?? "",
      query.data?.revision ?? 0,
    ],
    queryFn: ({
      signal,
    }: QueryFunctionContext): Promise<
      import("../../shared/api/arena-api").TeamStats
    > => api.teamStats(publicId ?? query.data?.publicId ?? "", signal),
    enabled: Boolean(query.data?.statsEnabled && tab === "stats"),
    retry: false,
  });
  const setParam = (name: string, value: string): void => {
    setParams((old: URLSearchParams): URLSearchParams => {
      const next = new URLSearchParams(old);
      next.set(name, value);
      if (["team", "status", "stage"].includes(name)) next.delete("round");
      return next;
    });
  };
  const setTab = (value: string): void => setParam("tab", value);
  const historyPage = Math.max(1, Number(params.get("historyPage")) || 1);
  const [dialogBase, setDialogBase] = useState<Tournament | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [actionError, setActionError] = useState(""),
    [conflicted, setConflicted] = useState(false),
    [dialogRevision, setDialogRevision] = useState<number | null>(null);
  const [resultEntry, setResultEntry] = useState<boolean>(false);
  const resultTriggerRef = useRef<HTMLButtonElement>(null);
  const closeResultEntry = (): void => {
    setResultEntry(false);
    resultTriggerRef.current?.focus();
  };
  const [selected, setSelected] = useState<Match | null>(null),
    [publicStatsMatch, setPublicStatsMatch] = useState<Match | null>(null),
    [showPreview, setShowPreview] = useState(false),
    [showPairing, setShowPairing] = useState(false),
    [showQualification, setShowQualification] = useState(false),
    [pending, setPending] = useState(false),
    [renameId, setRenameId] = useState("");
  const [tie, setTie] = useState<{
    scope: string;
    signature: string;
    order: string[];
  } | null>(null);
  const entrantFilter = params.get("team") ?? "",
    statusFilter = params.get("status") ?? "ALL",
    stageFilter = params.get("stage") ?? "ALL";
  const setEntrantFilter = (value: string): void => setParam("team", value),
    setStatusFilter = (value: string): void => setParam("status", value),
    setStageFilter = (value: string): void => setParam("stage", value);
  const preview = usePreview(
    ownerId,
    id ?? "",
    query.data?.revision ?? 0,
    previewPage,
    admin && showPreview && query.data?.status === "DRAFT",
  );
  const history = useHistory(
    ownerId,
    id ?? "",
    query.data?.revision ?? 0,
    historyPage,
    admin && tab === "history",
  );
  const saved = (tournament: Tournament): void => {
    cache.setQueryData(key, tournament);
    void Promise.all([
      cache.invalidateQueries({ queryKey: queryKeys.private(ownerId) }),
      cache.invalidateQueries({ queryKey: ["session"] }),
      cache.invalidateQueries({
        queryKey: queryKeys.public(tournament.publicId),
      }),
    ]).catch((error: unknown): void => toast(errorMessage(error), true));
  };
  const lock = useRef(false);
  const action = async (
    fn: () => Promise<Tournament>,
    message: string,
  ): Promise<boolean> => {
    if (lock.current || conflicted) return false;
    lock.current = true;
    setPending(true);
    setActionError("");
    try {
      const result = await mutation.mutateAsync({ run: fn });
      saved(result);
      toast(message);
      setDialogRevision(null);
      return true;
    } catch (error: unknown) {
      setActionError(errorMessage(error));
      if (error instanceof ApiError && error.code === "REVISION_CONFLICT") {
        setConflicted(true);
        await query.refetch();
      }
      return false;
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  const enableStats = async (): Promise<void> => {
    await action(
      (): Promise<Tournament> => api.enableStats(t.id, t.revision),
      "Match stats enabled.",
    );
  };
  const archiveStats = async (): Promise<void> => {
    try {
      const preview = await api.archiveStatsPreview(t.id);
      const accepted = window.confirm(
        `Permanently delete stats from ${preview.statsMatchCount} matches? Match results and standings will remain.`,
      );
      if (!accepted) return;
      await action(
        (): Promise<Tournament> =>
          api.archiveStats(t.id, {
            expectedRevision: preview.tournamentRevision,
            statsMatchCount: preview.statsMatchCount,
          }),
        "Match stats archived and storage slot freed.",
      );
    } catch (error: unknown) {
      setActionError(errorMessage(error));
    }
  };
  if (admin && session.isPending) return <Spinner />;
  if (admin && !ownerId)
    return (
      <Navigate
        to={`/auth/login?returnTo=${encodeURIComponent(`/manage/${id ?? ""}`)}`}
        replace
      />
    );
  if (query.isPending) return <Spinner />;
  if (query.error && !query.data)
    return (
      <main className="container">
        <ErrorState
          error={query.error}
          retry={(): Promise<QueryObserverResult<Tournament, ApiError>> =>
            query.refetch()
          }
        />
      </main>
    );
  const t = query.data;
  if (!t) return <Spinner />;
  const byId = new Map(
    t.entrants.map((e: Entrant): [string, Entrant] => [e.id, e]),
  );
  const name = (entrantId: string): string =>
    byId.get(entrantId)?.name || "Team";
  const matchList = t.matches.filter(
    (m: Match): boolean =>
      (!entrantFilter ||
        m.homeId === entrantFilter ||
        m.awayId === entrantFilter) &&
      (statusFilter === "ALL" ||
        (statusFilter === "PLAYED") === (m.homeScore !== null)) &&
      (stageFilter === "ALL" || m.stage === stageFilter),
  );
  const entryMatches = (value: Tournament): Match[] =>
    value.matches.filter(
      (entry: Match): boolean =>
        (!entrantFilter ||
          entry.homeId === entrantFilter ||
          entry.awayId === entrantFilter) &&
        (stageFilter === "ALL" || entry.stage === stageFilter) &&
        (!params.get("round") ||
          params.get("round") === "ALL" ||
          `${entry.stage}:${entry.round}` === params.get("round")),
    );
  const nextMatch = selected
    ? entryMatches(t).find(
        (entry: Match): boolean =>
          entry.id !== selected.id && entry.homeScore === null,
      )
    : undefined;
  const renderStandings = (): React.JSX.Element[] =>
    t.standings.map(
      (table: components["schemas"]["ScopeStanding"]): React.JSX.Element => {
        const group = t.groups.find(
            (g: components["schemas"]["Group"]): boolean =>
              g.id === table.scope,
          ),
          complete =
            t.matches.filter((m: Match): boolean => m.scope === table.scope)
              .length > 0 &&
            t.matches
              .filter((m: Match): boolean => m.scope === table.scope)
              .every((m: Match): boolean => m.homeScore !== null);
        return (
          <section className="panel standings-panel" key={table.scope}>
            <StandingsTable tournament={t} standings={table} group={group} />
            {admin &&
              complete &&
              !t.qualification &&
              [
                ...new Set(
                  table.rows
                    .filter(
                      (
                        r: components["schemas"]["Standing"],
                      ): boolean | "" | null =>
                        r.tieSignature && !r.tieResolved,
                    )
                    .map(
                      (r: components["schemas"]["Standing"]): string =>
                        r.tieSignature ?? "",
                    ),
                ),
              ].map((signature: string): React.JSX.Element => (
                <div className="tie-action" key={signature}>
                  <span>
                    {table.rows
                      .filter(
                        (r: components["schemas"]["Standing"]): boolean =>
                          r.tieSignature === signature,
                      )
                      .map(
                        (r: components["schemas"]["Standing"]): string =>
                          r.name,
                      )
                      .join(", ")}{" "}
                    are tied.
                  </span>
                  <button
                    className="text-button"
                    onClick={(): void => {
                      setDialogRevision(t.revision);
                      setDialogBase(t);
                      setConflicted(false);
                      setActionError("");
                      setTie({
                        scope: table.scope,
                        signature,
                        order: table.rows
                          .filter(
                            (r: components["schemas"]["Standing"]): boolean =>
                              r.tieSignature === signature,
                          )
                          .map(
                            (r: components["schemas"]["Standing"]): string =>
                              r.entrantId,
                          ),
                      });
                    }}
                  >
                    Decide order <ArrowRight size={14} />
                  </button>
                </div>
              ))}
          </section>
        );
      },
    );
  const openProgression = (
    dialog: "preview" | "qualification" | "pairing",
  ): void => {
    setDialogRevision(t.revision);
    setDialogBase(t);
    setConflicted(false);
    setActionError("");
    if (dialog === "preview") setShowPreview(true);
    else if (dialog === "qualification") setShowQualification(true);
    else setShowPairing(true);
  };
  const recovery: DialogRecoveryContext = {
    conflicted,
    error: actionError,
    signInPath:
      mutation.error instanceof ApiError && mutation.error.status === 401
        ? `/auth/login?returnTo=${encodeURIComponent(`/manage/${t.id}`)}`
        : undefined,
    latest: t,
    onRefresh: async (): Promise<void> => {
      setConflicted(true);
      await query.refetch();
    },
    onReapply: (): void => {
      setDialogRevision(t.revision);
      setConflicted(false);
      setActionError("Draft reapplied. Review and save separately.");
    },
    onLatest: (): void => {
      setShowPreview(false);
      setShowQualification(false);
      setShowPairing(false);
      setTie(null);
      setRenameId("");
      setConflicted(false);
      setActionError("");
      setDialogRevision(null);
    },
  };
  const fixtureRow = (m: Match): React.JSX.Element => {
    const played = m.homeScore !== null;
    return (
      <div className={`fixture-row ${played ? "played" : ""}`} key={m.id}>
        <span className="round-label mono">
          R{m.round}
          <small>
            {m.stage === "KNOCKOUT"
              ? "KO"
              : m.leg === 2
                ? "LEG 2"
                : t.groups.find(
                    (g: components["schemas"]["Group"]): boolean =>
                      g.id === m.scope,
                  )?.name || "LEAGUE"}
          </small>
        </span>
        <div className="fixture-team home">
          <span>{name(m.homeId)}</span>
          <TeamMark
            name={name(m.homeId)}
            index={t.entrants.findIndex(
              (e: Entrant): boolean => e.id === m.homeId,
            )}
          />
        </div>
        <span className={`fixture-score ${played ? "scored" : ""}`}>
          {played ? (
            <>
              {m.homeScore}
              <span>:</span>
              {m.awayScore}
            </>
          ) : (
            <span>VS</span>
          )}
          {m.homeTiebreak !== null && (
            <small>
              ({m.homeTiebreak} : {m.awayTiebreak})
            </small>
          )}
        </span>
        <div className="fixture-team away">
          <TeamMark
            name={name(m.awayId)}
            index={t.entrants.findIndex(
              (e: Entrant): boolean => e.id === m.awayId,
            )}
          />
          <span>{name(m.awayId)}</span>
        </div>
        {admin ? (
          <button
            aria-label={`${played ? "Edit result" : "Add result"}: ${name(m.homeId)} vs ${name(m.awayId)}, round ${m.round}`}
            className={`button small ${played ? "ghost" : "secondary"}`}
            onClick={(): void => setSelected(m)}
          >
            {played ? <Pencil size={13} /> : <PlusIcon />}
            <span>{played ? "Edit" : "Add"}</span>
          </button>
        ) : played && t.statsEnabled ? (
          <button
            type="button"
            className="button small ghost fixture-stats-trigger"
            aria-label={`View stats: ${name(m.homeId)} vs ${name(m.awayId)}`}
            onClick={(): void => setPublicStatsMatch(m)}
          >
            <ChartNoAxesCombined size={14} aria-hidden="true" />
            <span>View stats</span>
          </button>
        ) : (
          <span className={`fixture-state ${played ? "lime-text" : "muted"}`}>
            {played ? <Check size={16} /> : <span className="status-dot" />}
            <span>{played ? "Final" : "To play"}</span>
          </span>
        )}
      </div>
    );
  };
  return (
    <main id="main-content" className="container tournament-page">
      {query.error && query.data && (
        <p role="alert" className="inline-error">
          Refresh failed. Showing the last loaded state.{" "}
          {errorMessage(query.error)}
        </p>
      )}
      {actionError &&
        !showPreview &&
        !showQualification &&
        !showPairing &&
        !tie &&
        !renameId && (
          <p role="alert" className="inline-error">
            {actionError}
          </p>
        )}
      <TournamentHeader
        tournament={t}
        admin={admin}
        resultTriggerRef={resultTriggerRef}
        onEnter={
          admin && t.status !== "DRAFT" && t.matches.length > 0
            ? (): void => setResultEntry(true)
            : undefined
        }
        actions={
          <>
            {admin && (
              <>
                <TournamentTools
                  key={`${ownerId}:${t.id}`}
                  t={t}
                  ownerId={ownerId}
                  onSaved={saved}
                />
                {admin && t.game === "EFOOTBALL" && !t.statsEnabled && (
                  <button
                    className="button secondary"
                    type="button"
                    disabled={pending}
                    onClick={enableStats}
                  >
                    <ChartNoAxesCombined size={18} aria-hidden="true" /> Enable
                    match stats
                  </button>
                )}
                {admin && t.statsEnabled && (
                  <button
                    className="button secondary"
                    type="button"
                    disabled={pending}
                    onClick={archiveStats}
                  >
                    <Archive size={18} aria-hidden="true" /> Archive stats
                  </button>
                )}
              </>
            )}
            <ShareButton code={t.publicId} />
            {admin && (
              <Link
                className="text-button"
                to={`/t/${t.publicId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowUpRight size={18} aria-hidden="true" /> Public page
                <span className="sr-only"> (opens in a new tab)</span>
              </Link>
            )}
          </>
        }
      >
        {admin && (
          <div className="competition-progress-actions">
            {t.status === "DRAFT" && (
              <>
                <Link className="text-button" to={`/manage/${t.id}/setup`}>
                  <Settings2 aria-hidden="true" size={15} /> Edit setup
                </Link>
                <button
                  type="button"
                  className="button small"
                  onClick={(): void => openProgression("preview")}
                >
                  Review & start <ArrowRight aria-hidden="true" size={15} />
                </button>
              </>
            )}
            {t.format === "WORLD_CUP" &&
              t.status !== "DRAFT" &&
              !t.qualification &&
              t.qualificationPreview && (
                <button
                  type="button"
                  className="button secondary small"
                  onClick={(): void => openProgression("qualification")}
                >
                  Review qualifiers <ArrowRight aria-hidden="true" size={15} />
                </button>
              )}
            {t.knockoutEligibility && t.rounds[0]?.method !== "FIXED" && (
              <button
                type="button"
                className="button secondary small"
                onClick={(): void => openProgression("pairing")}
              >
                Choose pairings <ArrowRight aria-hidden="true" size={15} />
              </button>
            )}
          </div>
        )}
      </TournamentHeader>
      <TournamentNavigation
        tournament={t}
        admin={admin}
        active={tab}
        onChange={setTab}
      />
      <section
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        {tab === "standings" &&
          (t.status === "DRAFT" &&
          !t.standings.some(
            (standing: Tournament["standings"][number]): boolean =>
              standing.rows.length > 0,
          ) ? (
            <p className="panel">
              Standings will appear when the tournament starts.
            </p>
          ) : (
            <div>{renderStandings()}</div>
          ))}
        {t.statsEnabled && (
          <TeamStatsPanel
            key={`${admin ? ownerId : "public"}:${t.id}`}
            query={statsQuery}
            active={tab === "stats"}
          />
        )}
        {tab === "fixtures" && (
          <section className="fixtures-section">
            <div className="list-toolbar">
              <p className="fixtures-progress">
                {
                  t.matches.filter(
                    (fixture: Match): boolean => fixture.homeScore !== null,
                  ).length
                }
                /{t.matches.length} matches played
              </p>
              <div className="fixture-filters">
                <select
                  aria-label="Filter by team"
                  value={entrantFilter}
                  onChange={(
                    e: React.ChangeEvent<HTMLSelectElement, HTMLSelectElement>,
                  ): void => setEntrantFilter(e.target.value)}
                >
                  <option value="">All teams</option>
                  {t.entrants.map((e: Entrant): React.JSX.Element => (
                    <option value={e.id} key={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter fixture status"
                  value={statusFilter}
                  onChange={(
                    e: React.ChangeEvent<HTMLSelectElement, HTMLSelectElement>,
                  ): void => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All matches</option>
                  <option value="PENDING">To play</option>
                  <option value="PLAYED">Played</option>
                </select>
                {t.format === "WORLD_CUP" && (
                  <select
                    aria-label="Filter stage"
                    value={stageFilter}
                    onChange={(
                      e: React.ChangeEvent<
                        HTMLSelectElement,
                        HTMLSelectElement
                      >,
                    ): void => setStageFilter(e.target.value)}
                  >
                    <option value="ALL">All stages</option>
                    <option value="GROUP">Groups</option>
                    <option value="KNOCKOUT">Knockout</option>
                  </select>
                )}
              </div>
            </div>
            {matchList.length ? (
              <FixtureRounds
                key={`${entrantFilter}:${statusFilter}:${stageFilter}`}
                matches={matchList}
                selectedRound={params.get("round") ?? "ALL"}
                onRoundChange={(round: string): void =>
                  setParam("round", round)
                }
                renderMatch={fixtureRow}
              />
            ) : (
              <div className="empty">
                <Swords size={32} />
                <h3>
                  {t.status === "DRAFT"
                    ? "Fixtures arrive when you start."
                    : "No matches in this view."}
                </h3>
                <p>
                  {t.status === "DRAFT"
                    ? "An admin can review the generated fixtures before starting."
                    : "Try another filter."}
                </p>
              </div>
            )}
          </section>
        )}
        {tab === "knockout" && (
          <KnockoutBoard
            t={t}
            admin={admin}
            onSelect={setSelected}
            onViewStats={setPublicStatsMatch}
          />
        )}
        {tab === "teams" && (
          <div className="team-grid">
            {t.entrants.map((e: Entrant, i: number): React.JSX.Element => (
              <div className="team-card" key={e.id}>
                <TeamMark name={e.name} index={i} />
                <div>
                  <h3>{e.name}</h3>
                  <p>
                    {t.groups.find(
                      (g: components["schemas"]["Group"]): boolean =>
                        g.id === e.groupId,
                    )?.name || "League entrant"}
                  </p>
                  {e.aliases.length > 0 && (
                    <small>In game: {e.aliases.join(", ")}</small>
                  )}
                </div>
                {admin && (
                  <button
                    className="icon-button"
                    aria-label={`Edit ${e.name}`}
                    onClick={(): void => {
                      setDialogRevision(t.revision);
                      setDialogBase(t);
                      setConflicted(false);
                      setActionError("");
                      setDialogBase(t);
                      setConflicted(false);
                      setActionError("");
                      setRenameId(e.id);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {tab === "history" && admin && (
          <div className="panel">
            {history.isPending ? (
              <Spinner />
            ) : history.error ? (
              <ErrorState error={history.error} />
            ) : history.data?.items.length ? (
              history.data.items.map(
                (
                  h: components["schemas"]["HistoryEntry"],
                ): React.JSX.Element => (
                  <details className="history-item" key={h.id}>
                    <summary>
                      <History size={17} />
                      <strong>
                        {h.action === "RESET"
                          ? "Progression reset"
                          : h.action === "STATS_ARCHIVE"
                            ? "Match stats archived"
                            : h.action === "CLEAR"
                              ? "Result cleared"
                              : "Result saved"}
                      </strong>
                      <span>{new Date(h.createdAt).toLocaleString()}</span>
                    </summary>
                    <pre>
                      {JSON.stringify(
                        { before: h.before, after: h.after },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ),
              )
            ) : (
              <div className="empty">
                <History size={28} />
                <h3>No result revisions yet.</h3>
              </div>
            )}
          </div>
        )}
        {tab === "history" && history.data && (
          <Pagination
            page={historyPage}
            limit={20}
            total={history.data.total}
            pending={history.isFetching}
            onPage={(next: number): void =>
              setParam("historyPage", String(next))
            }
            label="History"
          />
        )}
      </section>
      {resultEntry && (
        <Suspense fallback={<Spinner />}>
          <ResultEntry
            tournament={t}
            onSaved={saved}
            onClose={closeResultEntry}
          />
        </Suspense>
      )}
      {selected && (
        <Suspense fallback={<Spinner />}>
          <MatchEditor
            key={selected.id}
            t={t}
            match={selected}
            onClose={(): void => setSelected(null)}
            onSaved={saved}
            onNext={
              nextMatch
                ? (result: Tournament): void => {
                    const next = entryMatches(result).find(
                      (entry: Match): boolean =>
                        entry.id !== selected.id && entry.homeScore === null,
                    );
                    setSelected(next ?? null);
                  }
                : undefined
            }
          />
        </Suspense>
      )}
      {publicStatsMatch && !admin && (
        <PublicMatchStatsDialog
          publicId={t.publicId}
          matchId={publicStatsMatch.id}
          homeName={name(publicStatsMatch.homeId)}
          awayName={name(publicStatsMatch.awayId)}
          onClose={(): void => setPublicStatsMatch(null)}
        />
      )}
      {showPreview && (
        <Modal
          title="Review your fixtures"
          onClose={(): void => setShowPreview(false)}
          wide
          pending={pending}
        >
          {actionError && (
            <p role="alert" className="inline-error">
              {actionError}
            </p>
          )}
          {conflicted && (
            <p>
              Review the latest tournament before a separate save.{" "}
              <button
                type="button"
                className="button secondary"
                onClick={(): void => {
                  setDialogRevision(t.revision);
                  setDialogBase(t);
                  setConflicted(false);
                  setActionError(
                    "Draft reapplied. Review and save separately.",
                  );
                }}
              >
                Reapply draft
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={(): void => {
                  setShowPreview(false);
                  setConflicted(false);
                  setDialogRevision(null);
                }}
              >
                Use latest
              </button>
            </p>
          )}
          <p className="muted">
            {t.format === "KNOCKOUT"
              ? "Start the tournament, then choose the opening pairings and any byes. The participant list locks at start."
              : "These matchups are flexible. Your players can play them in any order."}
          </p>
          {preview.isPending ? (
            <Spinner />
          ) : preview.error ? (
            <ErrorState error={preview.error} />
          ) : (
            <div className="preview-fixtures">
              {(preview.data?.items ?? []).map(
                (
                  m: components["schemas"]["Fixture"],
                  i: number,
                ): React.JSX.Element => (
                  <div key={`${m.scope}:${m.round}:${m.leg}:${m.pairingKey}`}>
                    <span className="mono muted">R{m.round}</span>
                    <strong>{name(m.homeId)}</strong>
                    <span>vs</span>
                    <strong>{name(m.awayId)}</strong>
                  </div>
                ),
              )}
            </div>
          )}
          {preview.data && (
            <Pagination
              page={previewPage}
              limit={20}
              total={preview.data.total}
              pending={preview.isFetching}
              onPage={setPreviewPage}
              label="Fixture preview"
            />
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={(): void => setShowPreview(false)}
            >
              Keep draft
            </button>
            <button
              className="button"
              disabled={pending || !!preview.error || preview.isPending}
              onClick={async (): Promise<void> => {
                const succeeded = await action(
                  (): Promise<Tournament> =>
                    api.start(t.id, dialogRevision ?? t.revision),
                  "Tournament started. Let the games begin.",
                );
                if (succeeded) setShowPreview(false);
              }}
            >
              <Play size={16} /> Start tournament
            </button>
          </div>
        </Modal>
      )}
      {showQualification && dialogBase?.qualificationPreview && (
        <Modal
          title="Confirm your qualifiers"
          onClose={(): void => setShowQualification(false)}
          pending={pending}
        >
          {conflicted && (
            <DialogFeedback
              recovery={{ ...recovery, error: "" }}
              local={dialogBase.qualificationPreview}
              latest={t.qualificationPreview}
              valid={
                JSON.stringify(dialogBase.qualificationPreview) ===
                JSON.stringify(t.qualificationPreview)
              }
            />
          )}
          {actionError && (
            <p role="alert" className="inline-error">
              {actionError}
            </p>
          )}
          {dialogBase.qualificationPreview.groups.map(
            (
              g: components["schemas"]["QualificationGroup"],
            ): React.JSX.Element => (
              <div className="qualification-group" key={g.groupId}>
                <h3>{g.name}</h3>
                {g.entrantIds.map((eid: string): React.JSX.Element => (
                  <div key={eid}>
                    <TeamMark name={name(eid)} />
                    <strong>{name(eid)}</strong>
                    <Check size={16} />
                  </div>
                ))}
              </div>
            ),
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={(): void => setShowQualification(false)}
            >
              Cancel
            </button>
            <button
              className="button"
              disabled={pending || conflicted}
              onClick={async (): Promise<void> => {
                const succeeded = await action(
                  (): Promise<Tournament> =>
                    api.qualify(t.id, dialogRevision ?? t.revision),
                  "Qualifiers confirmed. Choose your knockout pairings.",
                );
                if (succeeded) setShowQualification(false);
              }}
            >
              Confirm advancement <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {showPairing && dialogBase?.knockoutEligibility && (
        <KnockoutPairing
          t={dialogBase}
          recovery={recovery}
          onClose={(): void => setShowPairing(false)}
          onSave={async (
            pairs: [string, string][],
            byes: string[],
            options: PairingOptions,
          ): Promise<void> => {
            const succeeded = await action(
              (): Promise<Tournament> =>
                api.pair(
                  t.id,
                  pairs,
                  byes,
                  dialogRevision ?? t.revision,
                  options,
                ),
              "Knockout round created",
            );
            if (succeeded) setShowPairing(false);
          }}
        />
      )}
      {tie && (
        <TieModal
          t={dialogBase ?? t}
          recovery={recovery}
          tie={tie}
          onClose={(): void => setTie(null)}
          onSave={async (order: string[]): Promise<void> => {
            const succeeded = await action(
              (): Promise<Tournament> =>
                api.tie(
                  t.id,
                  tie.scope,
                  tie.signature,
                  order,
                  dialogRevision ?? t.revision,
                ),
              "Tie order saved",
            );
            if (succeeded) setTie(null);
          }}
        />
      )}
      {renameId && (
        <RenameModal
          t={dialogBase ?? t}
          recovery={recovery}
          entrantId={renameId}
          onClose={(): void => setRenameId("")}
          onSave={async (n: string, a: string[]): Promise<void> => {
            const succeeded = await action(
              (): Promise<Tournament> =>
                api.rename(t.id, renameId, n, a, dialogRevision ?? t.revision),
              "Team updated",
            );
            if (succeeded) setRenameId("");
          }}
        />
      )}
    </main>
  );
}
function PlusIcon(): React.JSX.Element {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M8 2v12M2 8h12" />
    </svg>
  );
}
