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
        <div className="match-stats-table-scroll">
          <table className="match-stats-table">
            <thead>
              <tr>
                <th scope="col">Stat</th>
                <th scope="col">Home · {homeName}</th>
                <th scope="col">Away · {awayName}</th>
              </tr>
            </thead>
            <tbody>
              {query.data.stats.map(
                (stat: PublicMatchStats["stats"][number]): ReactElement => (
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
