import { TournamentTools } from "./tournament-tools";
import { KnockoutBoard } from "./knockout-board";
import { KnockoutPairing } from "./knockout-pairing";
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
  ArrowLeft,
  ArrowRight,
  Check,
  History,
  Pencil,
  Play,
  Settings2,
  ShieldCheck,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
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
  StatusBadge,
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
  const tab = params.get("tab") ?? "overview";
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
      if (["team", "status", "stage"].includes(name))
        next.set("fixturesPage", "1");
      return next;
    });
  };
  const setTab = (value: string): void => setParam("tab", value);
  const fixturePage = Math.max(1, Number(params.get("fixturesPage")) || 1);
  const historyPage = Math.max(1, Number(params.get("historyPage")) || 1);
  const [dialogBase, setDialogBase] = useState<Tournament | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [actionError, setActionError] = useState(""),
    [conflicted, setConflicted] = useState(false),
    [dialogRevision, setDialogRevision] = useState<number | null>(null);
  const [selected, setSelected] = useState<Match | null>(null),
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
    ),
    finished = t.matches.filter(
      (m: Match): boolean => m.homeScore !== null,
    ).length,
    champion = t.entrants.find((e: Entrant): boolean => e.id === t.championId);
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
            <div className="panel-head">
              <h3>{group?.name || "League standings"}</h3>
              {group && (
                <span className="mono muted">
                  TOP {group.qualifierCount} ADVANCE
                </span>
              )}
            </div>
            <div
              className="table-scroll"
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
                    <th scope="col" title="Played">
                      P
                    </th>
                    <th scope="col" title="Wins">
                      W
                    </th>
                    <th scope="col" title="Draws">
                      D
                    </th>
                    <th scope="col" title="Losses">
                      L
                    </th>
                    <th scope="col" title="Score for">
                      SF
                    </th>
                    <th scope="col" title="Score against">
                      SA
                    </th>
                    <th scope="col" title="Score difference">
                      SD
                    </th>
                    <th scope="col">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map(
                    (
                      r: components["schemas"]["Standing"],
                      i: number,
                    ): React.JSX.Element => (
                      <tr
                        key={r.entrantId}
                        className={`${group && i < group.qualifierCount ? "qualifier" : ""} ${i === 0 ? "leader" : ""}`}
                      >
                        <td className="rank-cell">
                          {r.rank.toString().padStart(2, "0")}
                        </td>
                        <td>
                          <div className="table-team">
                            <TeamMark
                              name={r.name}
                              index={t.entrants.findIndex(
                                (e: Entrant): boolean => e.id === r.entrantId,
                              )}
                            />
                            <strong>{r.name}</strong>
                            {r.tieSignature &&
                              !r.tieResolved &&
                              r.played > 0 && (
                                <span
                                  className="tie-label"
                                  title="Still tied on points, difference and score for"
                                >
                                  TIED
                                </span>
                              )}
                          </div>
                        </td>
                        <td>{r.played}</td>
                        <td>{r.won}</td>
                        <td>{r.drawn}</td>
                        <td>{r.lost}</td>
                        <td>{r.scoreFor}</td>
                        <td>{r.scoreAgainst}</td>
                        <td>
                          {r.difference > 0 ? "+" : ""}
                          {r.difference}
                        </td>
                        <td className="points-cell">{r.points}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-note">
              {t.winPoints} points for a win · {t.drawPoints} for a draw ·{" "}
              {t.lossPoints} for a loss
              {group ? " · Highlighted places qualify" : ""}
            </div>
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
            <span>{played ? "Edit" : "Add result"}</span>
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
      <Link className="back-link" to={admin ? "/dashboard" : "/"}>
        <ArrowLeft size={15} />{" "}
        {admin ? "My tournaments" : "Find another tournament"}
      </Link>
      <div className="tournament-heading">
        <div>
          <div className="eyebrow">
            {t.game === "EFOOTBALL" ? "eFOOTBALL" : "CALL OF DUTY: MOBILE"}{" "}
            <span>/</span>{" "}
            {t.format === "LEAGUE"
              ? "ROUND ROBIN LEAGUE"
              : t.format === "KNOCKOUT"
                ? "ONLY KNOCKOUT"
                : "GROUP + KNOCKOUT"}
          </div>
          <h1>{t.name}</h1>
          <div className="tournament-meta">
            <StatusBadge status={t.status} />
            <span className="mono">ID: {t.publicId}</span>
            {admin ? (
              <span>
                <ShieldCheck size={14} /> Admin view
              </span>
            ) : (
              <span>Public view · refreshes every 15s</span>
            )}
          </div>
        </div>
        <div className="action-row">
          {admin && t.game === "EFOOTBALL" && !t.statsEnabled && (
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={enableStats}
            >
              Enable match stats
            </button>
          )}
          {admin && t.statsEnabled && (
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={archiveStats}
            >
              Archive stats
            </button>
          )}
          <ShareButton code={t.publicId} />
          {admin && (
            <Link className="text-button" to={`/t/${t.publicId}`}>
              <ArrowUpRightIcon /> Public page
            </Link>
          )}
        </div>
      </div>
      {admin && (
        <TournamentTools
          key={`${ownerId}:${t.id}`}
          t={t}
          ownerId={ownerId}
          onSaved={saved}
        />
      )}
      {champion && (
        <div className="champion-banner">
          <Trophy size={34} />
          <div>
            <div className="eyebrow">THE ARENA HAS A CHAMPION</div>
            <h2>{champion.name}</h2>
          </div>
          <span className="mono">WELL PLAYED.</span>
        </div>
      )}
      <div className="tournament-stats">
        <div>
          <Users size={19} />
          <strong>{t.entrants.length}</strong>
          <span>Teams</span>
        </div>
        <div>
          <Swords size={19} />
          <strong>{t.matches.length}</strong>
          <span>Fixtures</span>
        </div>
        <div>
          <Check size={19} />
          <strong>{finished}</strong>
          <span>Played</span>
        </div>
        <div className="completion-stat">
          <div>
            <span>Fixtures scored</span>
            <strong>
              {t.matches.length
                ? Math.round((finished / t.matches.length) * 100)
                : 0}
              %
            </strong>
          </div>
          <div className="progress">
            <span
              style={{
                width: `${t.matches.length ? (finished / t.matches.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>
      {admin && t.status === "DRAFT" && (
        <div className="stage-banner">
          <div>
            <h3>Your arena is ready to take shape.</h3>
            <p>
              Review the matchups before starting. Teams and rules lock when
              play begins.
            </p>
          </div>
          <div className="action-row">
            <Link
              className="button secondary small"
              to={`/manage/${t.id}/setup`}
            >
              <Settings2 size={15} /> Edit setup
            </Link>
            <button
              className="button small"
              onClick={(): void => {
                setDialogRevision(t.revision);
                setDialogBase(t);
                setConflicted(false);
                setActionError("");
                setDialogBase(t);
                setConflicted(false);
                setActionError("");
                setShowPreview(true);
              }}
            >
              Review & start <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
      {admin &&
        t.format === "WORLD_CUP" &&
        t.status !== "DRAFT" &&
        !t.qualification && (
          <div className="stage-banner">
            <div>
              <h3>
                {t.qualificationPreview
                  ? "Your qualifiers are ready."
                  : "The group stage is in play."}
              </h3>
              <p>
                {t.qualificationPreview
                  ? "Review the advancing teams, then build the first knockout round."
                  : "Finish all group fixtures and resolve ties across qualification places."}
              </p>
            </div>
            {t.qualificationPreview && (
              <button
                className="button small"
                onClick={(): void => {
                  setDialogRevision(t.revision);
                  setDialogBase(t);
                  setConflicted(false);
                  setActionError("");
                  setDialogBase(t);
                  setConflicted(false);
                  setActionError("");
                  setShowQualification(true);
                }}
              >
                Review qualifiers <ArrowRight size={15} />
              </button>
            )}
          </div>
        )}
      {admin && t.knockoutEligibility && t.rounds[0]?.method !== "FIXED" && (
        <div className="stage-banner">
          <div>
            <h3>Build knockout round {t.knockoutEligibility.round}.</h3>
            <p>
              {t.knockoutEligibility.entrantIds.length} teams remain. Choose
              their opponents
              {t.knockoutEligibility.byeCount
                ? ` and assign ${t.knockoutEligibility.byeCount} byes`
                : ""}
              .
            </p>
          </div>
          <button
            className="button small"
            onClick={(): void => {
              setDialogRevision(t.revision);
              setDialogBase(t);
              setConflicted(false);
              setActionError("");
              setDialogBase(t);
              setConflicted(false);
              setActionError("");
              setShowPairing(true);
            }}
          >
            Choose pairings <ArrowRight size={15} />
          </button>
        </div>
      )}
      <div
        className="tabs tournament-tabs"
        role="tablist"
        aria-label="Tournament sections"
      >
        {[
          ["overview", "Overview"],
          ["fixtures", "Fixtures"],
          ...(t.format !== "KNOCKOUT" ? [["standings", "Standings"]] : []),
          ...(t.format !== "LEAGUE" ? [["knockout", "Knockout"]] : []),
          ["teams", "Teams"],
          ...(t.statsEnabled ? [["stats", "Team stats"]] : []),
          ...(admin ? [["history", "Revision history"]] : []),
        ].map(([value, label]: string[]): React.JSX.Element => (
          <button
            role="tab"
            id={`tab-${value}`}
            aria-controls={`panel-${value}`}
            aria-selected={tab === value}
            tabIndex={tab === value ? 0 : -1}
            onKeyDown={(
              event: React.KeyboardEvent<HTMLButtonElement>,
            ): void => {
              const controls = Array.from(
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
                  '[role="tab"]',
                ) ?? [],
              );
              const index = controls.indexOf(event.currentTarget);
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % controls.length
                  : event.key === "ArrowLeft"
                    ? (index + controls.length - 1) % controls.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? controls.length - 1
                        : -1;
              if (next >= 0) {
                event.preventDefault();
                controls[next].click();
                controls[next].focus();
              }
            }}
            className={tab === value ? "active" : ""}
            onClick={(): void => setTab(value)}
            key={value}
          >
            {label}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        tabIndex={0}
      >
        {tab === "overview" && (
          <div className="overview-grid">
            <div>
              {t.format === "KNOCKOUT" ? (
                <KnockoutBoard t={t} admin={admin} onSelect={setSelected} />
              ) : (
                renderStandings()
              )}
            </div>
            <aside className="panel competition-note">
              <div className="eyebrow">THE GAME PLAN</div>
              <h3>
                {t.format === "KNOCKOUT"
                  ? "Win the tie. Advance to the final."
                  : t.format === "LEAGUE"
                    ? "Every opponent. Every point."
                    : "Win your place. Then survive."}
              </h3>
              <p>
                {t.format === "KNOCKOUT"
                  ? `${t.knockoutLegs} match(es) per knockout tie; ${t.knockoutFinalLegs} in the final. Each round finishes before the next begins.`
                  : `${t.legs === 1 ? "Single" : "Double"} round robin${t.format === "WORLD_CUP" ? " within each group" : ""}. Matches can be played in any order within the active stage.`}
              </p>
              {t.groups.length > 0 && (
                <div className="group-summary">
                  {t.groups.map(
                    (g: components["schemas"]["Group"]): React.JSX.Element => (
                      <div key={g.id}>
                        <span>{g.name}</span>
                        <strong>Top {g.qualifierCount}</strong>
                      </div>
                    ),
                  )}
                </div>
              )}
              <div className="summary-rule" />
              <p>
                Ranked by points, score difference, then score for. Admins
                resolve any remaining ties.
              </p>
              <button
                className="text-button lime-text"
                onClick={(): void => setTab("fixtures")}
              >
                See every fixture <ArrowRight size={15} />
              </button>
            </aside>
          </div>
        )}
        {tab === "standings" && <div>{renderStandings()}</div>}
        {tab === "stats" && t.statsEnabled && (
          <section className="panel team-stats-panel" aria-label="Team stats">
            {statsQuery.isPending ? (
              <p role="status">Loading team stats…</p>
            ) : statsQuery.error ? (
              <p role="alert">
                Could not load team stats. {errorMessage(statsQuery.error)}
              </p>
            ) : !statsQuery.data?.teams.some(
                (team: TeamStats["teams"][number]): boolean =>
                  team.stats.some(
                    (
                      stat: TeamStats["teams"][number]["stats"][number],
                    ): boolean => stat.recordedMatches > 0,
                  ),
              ) ? (
              <p>
                No match stats have been recorded yet. Add optional stats when
                saving a match result.
              </p>
            ) : (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label="Tournament team stats"
              >
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Team</th>
                      {statsQuery.data.teams[0]?.stats.map(
                        (
                          stat: TeamStats["teams"][number]["stats"][number],
                        ): React.JSX.Element => (
                          <th scope="col" key={stat.key}>
                            {stat.label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {statsQuery.data.teams.map(
                      (team: TeamStats["teams"][number]): React.JSX.Element => (
                        <tr key={team.entrantId}>
                          <th scope="row">{team.name}</th>
                          {team.stats.map(
                            (
                              stat: TeamStats["teams"][number]["stats"][number],
                            ): React.JSX.Element => (
                              <td key={stat.key}>
                                {stat.value === null
                                  ? "—"
                                  : `${stat.value}${stat.unit === "percent" ? "%" : ""}`}
                                <small className="stat-coverage">
                                  {stat.recordedMatches}/{stat.playedMatches}{" "}
                                  matches
                                </small>
                              </td>
                            ),
                          )}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
        {tab === "fixtures" && (
          <section className="fixtures-section">
            <div className="list-toolbar">
              <div className="eyebrow">
                {matchList.length} MATCHUPS · PLAY AT YOUR PACE
              </div>
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
              <div className="fixture-list">
                {matchList
                  .slice((fixturePage - 1) * 50, fixturePage * 50)
                  .map(fixtureRow)}
              </div>
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
          <KnockoutBoard t={t} admin={admin} onSelect={setSelected} />
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
        {tab === "fixtures" && (
          <Pagination
            page={fixturePage}
            limit={50}
            total={matchList.length}
            onPage={(next: number): void =>
              setParam("fixturesPage", String(next))
            }
            label="Fixtures"
          />
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
      {selected && (
        <Suspense fallback={<Spinner />}>
          <MatchEditor
            t={t}
            match={selected}
            onClose={(): void => setSelected(null)}
            onSaved={saved}
          />
        </Suspense>
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
function ArrowUpRightIcon(): React.JSX.Element {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    >
      <path d="M3 13 13 3M4 3h9v9" />
    </svg>
  );
}
