import { Pagination } from "../../shared/ui/pagination";
import { useQuery, type QueryFunctionContext } from "@tanstack/react-query";
import { useState, type ChangeEvent, type ReactElement } from "react";
import {
  api,
  errorMessage,
  type ImportEntrant,
  type TournamentPage,
} from "../../shared/api/arena-api";
import { useDashboard } from "../../shared/api/query-hooks";
import { Field } from "../../shared/ui/primitives";
import { importTeams } from "./import-draft";
import type { DraftEntrant } from "./setup-draft";
interface TeamImportProps {
  ownerId: string;
  entrants: DraftEntrant[];
  onImport: (entrants: DraftEntrant[]) => void;
  disabled: boolean;
}
export function TeamImport({
  ownerId,
  entrants,
  onImport,
  disabled,
}: TeamImportProps): ReactElement {
  const [page, setPage] = useState(1),
    [source, setSource] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const locked = entrants.find(
    (e: DraftEntrant): boolean => !!e.importSourceId,
  )?.importSourceId;
  const sourceId = locked ?? source;
  const sources = useDashboard(ownerId, { page, limit: 20 });
  const teams = useQuery({
    queryKey: ["private", ownerId, "import", sourceId],
    enabled: !!sourceId,
    retry: false,
    queryFn: async ({
      signal,
    }: QueryFunctionContext): Promise<ImportEntrant[]> => {
      const first = await api.entrants(sourceId, 1, signal);
      const items = [...first.items];
      for (let p = 2; p <= Math.ceil(first.total / first.limit); p++) {
        const next = await api.entrants(sourceId, p, signal);
        items.push(...next.items);
      }
      return items;
    },
  });
  const imported = new Set(
    entrants
      .filter((e: DraftEntrant): boolean => e.importSourceId === sourceId)
      .map((e: DraftEntrant): string | undefined => e.importEntrantId),
  );
  const available = (teams.data ?? []).filter(
    (e: ImportEntrant): boolean => !imported.has(e.id),
  );
  return (
    <details className="bulk-import">
      <summary>Import teams from your tournament</summary>
      <Field label="Source tournament">
        <select
          value={sourceId}
          disabled={disabled || !!locked || sources.isPending}
          onChange={(e: ChangeEvent<HTMLSelectElement>): void => {
            setSource(e.currentTarget.value);
            setSelected([]);
            setError("");
            setNotice("");
          }}
        >
          <option value="">Select a tournament</option>
          {sources.data?.items.map(
            (t: TournamentPage["items"][number]): ReactElement => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ),
          )}
          {locked &&
            !sources.data?.items.some(
              (t: TournamentPage["items"][number]): boolean => t.id === locked,
            ) && <option value={locked}>Selected source tournament</option>}
        </select>
      </Field>
      {sources.data && !sources.data.total && (
        <p>No tournaments available to import.</p>
      )}
      {sources.data && (
        <Pagination
          page={page}
          limit={20}
          total={sources.data.total}
          pending={sources.isFetching || !!locked}
          onPage={setPage}
          label="Source tournaments"
        />
      )}
      {locked && (
        <p>
          Imports use one source. Remove its imported team rows to change
          source.
        </p>
      )}
      {(sources.error || teams.error || error) && (
        <p role="alert">
          {error || errorMessage(sources.error ?? teams.error)}
        </p>
      )}
      {sourceId && teams.isPending && <p role="status">Loading teams…</p>}
      {teams.data && (
        <>
          <button
            type="button"
            className="button secondary small"
            disabled={disabled || !available.length}
            onClick={(): void =>
              setSelected(available.map((e: ImportEntrant): string => e.id))
            }
          >
            Select all teams
          </button>
          <button
            type="button"
            className="button secondary small"
            disabled={disabled}
            onClick={(): void => setSelected([])}
          >
            Clear selection
          </button>
          <div className="import-team-list">
            {teams.data.map((team: ImportEntrant): ReactElement => (
              <label key={team.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(team.id) && !imported.has(team.id)}
                  disabled={disabled || imported.has(team.id)}
                  onChange={(e: ChangeEvent<HTMLInputElement>): void => {
                    const checked = e.currentTarget.checked;
                    setSelected((ids: string[]): string[] =>
                      checked
                        ? [...ids, team.id]
                        : ids.filter((id: string): boolean => id !== team.id),
                    );
                  }}
                />
                {team.name}
                {imported.has(team.id) ? " · Imported" : ""}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="button secondary small"
            disabled={disabled || !selected.length}
            onClick={(): void => {
              try {
                const result = importTeams(
                  entrants,
                  sourceId,
                  teams.data.filter((t: ImportEntrant): boolean =>
                    selected.includes(t.id),
                  ),
                );
                onImport(result.entrants);
                setNotice(
                  result.skipped.length
                    ? `Skipped duplicate teams: ${result.skipped.join(", ")}`
                    : "Teams imported. Review names and group assignments.",
                );
                setSelected([]);
                setError("");
              } catch (e: unknown) {
                setError(errorMessage(e));
              }
            }}
          >
            Import selected teams
          </button>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </details>
  );
}
