import type { ImportEntrant } from "../../shared/api/arena-api";
import { type DraftEntrant, newEntrant } from "./setup-draft";
export interface ImportResult {
  entrants: DraftEntrant[];
  skipped: string[];
}
export function importTeams(
  current: DraftEntrant[],
  sourceId: string,
  selected: ImportEntrant[],
): ImportResult {
  const source = current.find(
    (e: DraftEntrant): boolean => !!e.importSourceId,
  )?.importSourceId;
  if (source && source !== sourceId)
    throw new Error("Import from one source; remove imported rows to switch.");
  const entrants = current.filter(
    (e: DraftEntrant): boolean => !!(e.name.trim() || e.aliases.trim()),
  );
  const names = new Set(
    entrants.map((e: DraftEntrant): string =>
      e.name.trim().toLocaleLowerCase("en-US"),
    ),
  );
  const ids = new Set(
    entrants.map((e: DraftEntrant): string | undefined => e.importEntrantId),
  );
  const skipped: string[] = [];
  for (const team of selected) {
    const name = team.name.trim();
    const key = name.toLocaleLowerCase("en-US");
    if (names.has(key) || ids.has(team.id)) {
      skipped.push(team.name);
      continue;
    }
    names.add(key);
    ids.add(team.id);
    entrants.push({
      ...newEntrant(),
      name,
      aliases: team.aliases.join(", "),
      importSourceId: sourceId,
      importEntrantId: team.id,
    });
  }
  if (entrants.length > 256)
    throw new Error("Use at most 256 teams. Select fewer teams to import.");
  return { entrants, skipped };
}
