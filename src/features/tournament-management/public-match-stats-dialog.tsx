import { useQuery, type QueryFunctionContext } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { api, type PublicMatchStats } from "../../shared/api/arena-api";
import { queryKeys } from "../../shared/api/query-keys";
import { Modal, Spinner } from "../../shared/ui/primitives";

interface PublicMatchStatsDialogProps {
  publicId: string;
  matchId: string;
  homeName: string;
  awayName: string;
  onClose: () => void;
}

type MatchStat = PublicMatchStats["stats"][number];
interface MatchStatRow extends Omit<MatchStat, "key"> {
  key: string;
}
interface AccuracyDefinition {
  key: string;
  label: string;
  numeratorKey: MatchStat["key"];
  denominatorKey: MatchStat["key"];
}
const accuracyDefinitions: AccuracyDefinition[] = [
  {
    key: "shotAccuracy",
    label: "Shot accuracy",
    numeratorKey: "shotsOnTarget",
    denominatorKey: "shots",
  },
  {
    key: "passAccuracy",
    label: "Pass accuracy",
    numeratorKey: "successfulPasses",
    denominatorKey: "passes",
  },
];

function accuracy(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (
    typeof numerator !== "number" ||
    typeof denominator !== "number" ||
    denominator === 0
  )
    return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function matchStatRows(stats: MatchStat[]): MatchStatRow[] {
  const rows: MatchStatRow[] = [...stats];
  for (const definition of accuracyDefinitions) {
    const numerator = stats.find(
      (stat: MatchStat): boolean => stat.key === definition.numeratorKey,
    );
    const denominator = stats.find(
      (stat: MatchStat): boolean => stat.key === definition.denominatorKey,
    );
    const sourceIndex = Math.max(
      rows.findIndex(
        (row: MatchStatRow): boolean => row.key === definition.numeratorKey,
      ),
      rows.findIndex(
        (row: MatchStatRow): boolean => row.key === definition.denominatorKey,
      ),
    );
    rows.splice(sourceIndex < 0 ? rows.length : sourceIndex + 1, 0, {
      key: definition.key,
      label: definition.label,
      unit: "percent",
      home: accuracy(numerator?.home, denominator?.home),
      away: accuracy(numerator?.away, denominator?.away),
    });
  }
  return rows;
}

function formatValue(value: number | null, unit: "percent" | "count"): string {
  if (value === null) return "—";
  return unit === "percent" ? `${value}%` : String(value);
}

export function PublicMatchStatsDialog({
  publicId,
  matchId,
  homeName,
  awayName,
  onClose,
}: PublicMatchStatsDialogProps): ReactElement {
  const query = useQuery({
    queryKey: queryKeys.publicMatchStats(publicId, matchId),
    queryFn: ({ signal }: QueryFunctionContext): Promise<PublicMatchStats> =>
      api.publicMatchStats(publicId, matchId, signal),
    retry: false,
  });

  return (
    <Modal
      title={`Match stats: ${homeName} vs ${awayName}`}
      onClose={onClose}
      className="public-match-stats-dialog"
    >
      {query.isPending ? (
        <Spinner />
      ) : query.error ? (
        <div>
          <p role="alert" className="inline-error">
            Could not load match stats.
          </p>
          <button
            className="button secondary"
            type="button"
            disabled={query.isFetching}
            onClick={(): void => {
              void query.refetch();
            }}
          >
            Retry
          </button>
        </div>
      ) : query.data?.stats.length ? (
        <div
          className="match-stats-table-scroll"
          role="region"
          aria-label="Match stats table"
          tabIndex={0}
        >
          <table className="match-stats-table">
            <thead>
              <tr>
                <th scope="col">Stat</th>
                <th scope="col">Home · {homeName}</th>
                <th scope="col">Away · {awayName}</th>
              </tr>
            </thead>
            <tbody>
              {matchStatRows(query.data.stats).map(
                (stat: MatchStatRow): ReactElement => (
                  <tr key={stat.key}>
                    <th scope="row">{stat.label}</th>
                    <td>{formatValue(stat.home, stat.unit)}</td>
                    <td>{formatValue(stat.away, stat.unit)}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No match stats were recorded for this match.</p>
      )}
    </Modal>
  );
}
