import { apiUrl } from "../../shared/api/api-origin";
import type { QueryObserverResult } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Link2,
  LogOut,
  Plus,
  Search,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import type { components } from "../../generated/api";
import type { Entrant } from "../../shared/api/arena-api";
import {
  api,
  ApiError,
  errorMessage,
  Session,
  TournamentFilters,
} from "../../shared/api/arena-api";
import { useDashboard } from "../../shared/api/query-hooks";
import { queryKeys } from "../../shared/api/query-keys";
import { Pagination } from "../../shared/ui/pagination";
import {
  ErrorState,
  Spinner,
  StatusBadge,
  TeamMark,
  useSession,
  useToast,
} from "../../shared/ui/primitives";
export function Dashboard(): React.JSX.Element {
  const { data: session, isPending: sessionPending } = useSession();
  const toast = useToast(),
    cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const filter = params.get("status") ?? "ALL",
    search = params.get("search") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const filters: TournamentFilters = {
    page,
    limit: 20,
    search,
    ...(["ACTIVE", "DRAFT", "COMPLETED"].includes(filter)
      ? { status: filter as TournamentFilters["status"] }
      : {}),
  };
  const {
    data: tournaments,
    isPending,
    error,
    refetch,
    isFetching,
  } = useDashboard(session?.user?.id ?? "", filters);
  const change = (key: string, value: string): void => {
    setParams((old: URLSearchParams): URLSearchParams => {
      const next = new URLSearchParams(old);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.set("page", "1");
      return next;
    });
  };
  const logout = useMutation({
    mutationFn: api.logout,
    retry: false,
    onSuccess: async (data: Session): Promise<void> => {
      await cache.cancelQueries({ queryKey: ["private"] });
      cache.removeQueries({ queryKey: ["private"] });
      cache.setQueryData(queryKeys.session(), data);
    },
  });
  if (sessionPending) return <Spinner />;
  if (!session?.user) return <Navigate to="/auth/login" replace />;
  const shown = tournaments?.items ?? [],
    totals = tournaments?.totals;
  return (
    <main id="main-content" className="container dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR CONTROL ROOM</div>
          <h1>
            Hey, {session.user.name.split(" ")[0]}
            <span className="lime-text">.</span>
          </h1>
          <p>Here’s where your rivalries live.</p>
        </div>
        <Link to="/new" className="button">
          <Plus size={18} /> New tournament
        </Link>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <Trophy />
          <span>Total tournaments</span>
          <strong>{(totals?.tournaments ?? 0).toLocaleString()}</strong>
        </div>
        <div className="stat-card">
          <Swords />
          <span>In play</span>
          <strong>{(totals?.active ?? 0).toLocaleString()}</strong>
        </div>
        <div className="stat-card">
          <Users />
          <span>Teams in your arena</span>
          <strong>{(totals?.entrants ?? 0).toLocaleString()}</strong>
        </div>
      </div>
      <div className="list-toolbar">
        <div className="tabs">
          {[
            ["ALL", "All tournaments"],
            ["ACTIVE", "In play"],
            ["DRAFT", "Drafts"],
            ["COMPLETED", "Completed"],
          ].map(([value, label]: string[]): React.JSX.Element => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              aria-pressed={filter === value}
              onClick={(): void =>
                change("status", value === "ALL" ? "" : value)
              }
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search-input">
          <Search size={16} />
          <input
            aria-label="Search tournaments"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
              change("search", e.target.value)
            }
            placeholder="Find your league…"
          />
        </label>
      </div>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorState
          error={error}
          retry={(): Promise<
            QueryObserverResult<
              {
                items: components["schemas"]["TournamentSummary"][];
                total: number;
                page: number;
                limit: number;
                totals: components["schemas"]["DashboardTotals"];
              },
              ApiError
            >
          > => refetch()}
        />
      ) : shown.length ? (
        <div className="tournament-grid">
          {shown.map(
            (t: {
              id: string;
              publicId: string;
              name: string;
              game: string;
              format: string;
              status: string;
              createdAt: string;
              legs: number;
              revision: number;
              entrantCount: number;
              matchCount: number;
              completedMatchCount: number;
              entrantPreview: components["schemas"]["Entrant"][];
            }): React.JSX.Element => (
              <Link
                key={t.id}
                to={`/manage/${t.id}`}
                className="tournament-card"
              >
                <div className="card-top">
                  <StatusBadge status={t.status} />
                  <ArrowUpRight size={20} />
                </div>
                <span className="game-label">
                  {t.game === "EFOOTBALL"
                    ? "eFOOTBALL"
                    : "CALL OF DUTY: MOBILE"}
                </span>
                <h2>{t.name}</h2>
                <p>
                  {t.format === "LEAGUE"
                    ? "Round robin league"
                    : t.format === "KNOCKOUT"
                      ? "Only knockout"
                      : "Group + knockout"}{" "}
                  {t.format !== "KNOCKOUT" && (
                    <>· {t.legs === 2 ? "Double" : "Single"} round robin</>
                  )}
                </p>
                <div className="card-teams">
                  {t.entrantPreview.map(
                    (e: Entrant, i: number): React.JSX.Element => (
                      <TeamMark name={e.name} index={i} key={e.id} />
                    ),
                  )}
                  {t.entrantCount > 4 && (
                    <span className="extra-teams">+{t.entrantCount - 4}</span>
                  )}
                </div>
                <div className="card-bottom">
                  <span>
                    <Users size={14} /> {t.entrantCount} teams
                  </span>
                  <span className="mono">{t.publicId}</span>
                </div>
                <div className="progress">
                  <span
                    style={{
                      width: `${t.matchCount ? (t.completedMatchCount / t.matchCount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </Link>
            ),
          )}
        </div>
      ) : (
        <div className="empty">
          <Trophy size={36} />
          <h2>
            {totals?.tournaments
              ? "No tournaments here yet."
              : "Your first rivalry starts here."}
          </h2>
          <p>
            {totals?.tournaments
              ? "Try another filter or tournament name."
              : "Create a competition, add your squad, and let the games begin."}
          </p>
          <Link className="button" to="/new">
            <Plus size={17} /> Create a tournament
          </Link>
        </div>
      )}
      {tournaments && (
        <Pagination
          page={page}
          limit={20}
          total={tournaments.total}
          pending={isFetching}
          onPage={(next: number): void => change("page", String(next))}
          label="Tournaments"
        />
      )}
      {logout.error && (
        <div role="alert" className="inline-error">
          {errorMessage(logout.error)}
        </div>
      )}
      <div className="account-strip">
        <span>
          Signed in as <strong>{session.user.email}</strong>
        </span>
        <div>
          {session.googleEnabled && !session.user.googleLinked && (
            <a
              href={apiUrl("/api/v1/auth/google?link=1")}
              className="text-button"
            >
              <Link2 size={15} /> Link Google account
            </a>
          )}
          <button
            className="text-button muted"
            disabled={logout.isPending}
            onClick={(): void => {
              logout.mutate();
            }}
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
