import type { Setup, Tournament } from "../../shared/api/arena-api";
export interface DraftEntrant {
  importSourceId?: string;
  importEntrantId?: string;
  clientId: string;
  id?: string;
  name: string;
  aliases: string;
  groupId: string | null;
}
export interface DraftGroup {
  clientId: string;
  name: string;
  qualifierCount: string;
}
export interface SetupDraft {
  name: string;
  game: "EFOOTBALL" | "CODM";
  format: Setup["format"];
  knockoutLegs: 1 | 2;
  knockoutFinalLegs: 1 | 2;
  legs: 1 | 2;
  winPoints: string;
  drawPoints: string;
  lossPoints: string;
  entrants: DraftEntrant[];
  groups: DraftGroup[];
}
export interface FieldErrors {
  [field: string]: string;
}
export type SetupValidation =
  { valid: true; payload: Setup } | { valid: false; errors: FieldErrors };
export function parseInteger(
  value: string,
  min: number,
  max: number,
): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max
    ? number
    : null;
}
export function validateSetupDraft(
  draft: SetupDraft,
  latest?: Tournament,
): SetupValidation {
  const errors: FieldErrors = {};
  const name = draft.name.trim();
  if (name.length < 2 || name.length > 120)
    errors.name = "Use a tournament name from 2 to 120 characters.";
  if (latest && latest.status !== "DRAFT")
    errors.name = "This tournament has started. Setup is locked.";
  if (draft.knockoutFinalLegs > draft.knockoutLegs)
    errors.knockoutFinalLegs = "Final legs cannot exceed knockout legs.";
  const numeric: Record<"winPoints" | "drawPoints" | "lossPoints", number> = {
    winPoints: 0,
    drawPoints: 0,
    lossPoints: 0,
  };
  for (const key of ["winPoints", "drawPoints", "lossPoints"] as const) {
    const value =
      draft.format === "KNOCKOUT"
        ? key === "winPoints"
          ? 3
          : key === "drawPoints"
            ? 1
            : 0
        : parseInteger(draft[key], 0, 1000);
    if (value === null) errors[key] = "Enter a whole number from 0 to 1,000.";
    else numeric[key] = value;
  }
  if (draft.entrants.length < 2 || draft.entrants.length > 256)
    errors.entrants = "Add between 2 and 256 teams.";
  const names = new Set<string>();
  const entrants: Setup["entrants"] = draft.entrants.map(
    (entrant: DraftEntrant): Setup["entrants"][number] => {
      const trimmed = entrant.name.trim(),
        key = trimmed.toLocaleLowerCase("en-US");
      const field = `entrant-${entrant.clientId}`;
      if (!trimmed || trimmed.length > 80)
        errors[field] = "Use a team name from 1 to 80 characters.";
      else if (names.has(key)) errors[field] = "Team names must be unique.";
      names.add(key);
      const aliases = entrant.aliases
        .split(",")
        .map((alias: string): string => alias.trim())
        .filter(Boolean);
      if (
        aliases.length > 10 ||
        aliases.some((alias: string): boolean => alias.length > 80) ||
        new Set(aliases.map((alias: string): string => alias.toLowerCase()))
          .size !== aliases.length
      )
        errors[field] =
          "Use at most 10 unique in-game names, each up to 80 characters.";
      if (
        entrant.id &&
        latest &&
        !latest.entrants.some(
          (other: Tournament["entrants"][number]): boolean =>
            other.id === entrant.id,
        )
      )
        errors[field] =
          "This team was removed. Remove it and add it again before reapplying.";
      const groupIndex = draft.groups.findIndex(
        (group: DraftGroup): boolean => group.clientId === entrant.groupId,
      );
      if (draft.format === "WORLD_CUP" && groupIndex < 0)
        errors[field] = "Choose a group for every team.";
      return {
        ...(entrant.id ? { id: entrant.id } : {}),
        name: trimmed,
        aliases,
        groupIndex: draft.format === "WORLD_CUP" ? groupIndex : null,
      };
    },
  );
  const groups: Setup["groups"] = [];
  const groupNames = new Set<string>();
  if (draft.format === "WORLD_CUP") {
    if (!draft.groups.length || draft.groups.length > 128)
      errors.groups = "Add between 1 and 128 groups.";
    draft.groups.forEach((group: DraftGroup, index: number): void => {
      const size = entrants.filter(
        (entrant: Setup["entrants"][number]): boolean =>
          entrant.groupIndex === index,
      ).length;
      const count = parseInteger(group.qualifierCount, 1, 256);
      const trimmed = group.name.trim();
      if (
        !trimmed ||
        trimmed.length > 80 ||
        groupNames.has(trimmed.toLowerCase())
      )
        errors[`group-${group.clientId}`] =
          "Use a unique group name from 1 to 80 characters.";
      if (size < 2 || count === null || count > size)
        errors[`group-${group.clientId}`] =
          "Each group needs at least two teams and a valid qualifier count.";
      groupNames.add(trimmed.toLowerCase());
      groups.push({ name: trimmed, qualifierCount: count ?? 0 });
    });
    if (
      groups.reduce(
        (sum: number, group: Setup["groups"][number]): number =>
          sum + group.qualifierCount,
        0,
      ) < 2
    )
      errors.groups = "At least two teams must qualify.";
  }
  if (Object.keys(errors).length) return { valid: false, errors };
  return {
    valid: true,
    payload: {
      name,
      game: draft.game,
      format: draft.format,
      legs: draft.format === "KNOCKOUT" ? 1 : draft.legs,
      knockoutLegs: draft.knockoutLegs,
      knockoutFinalLegs: draft.knockoutFinalLegs,
      ...(draft.format === "KNOCKOUT"
        ? { winPoints: 3, drawPoints: 1, lossPoints: 0 }
        : numeric),
      entrants,
      groups,
    },
  };
}
export function newEntrant(): DraftEntrant {
  return {
    clientId: crypto.randomUUID(),
    name: "",
    aliases: "",
    groupId: null,
  };
}
export function newGroup(name: string = "Group A"): DraftGroup {
  return { clientId: crypto.randomUUID(), name, qualifierCount: "2" };
}
export function newSetupDraft(): SetupDraft {
  return {
    name: "",
    game: "EFOOTBALL",
    format: "LEAGUE",
    knockoutLegs: 1,
    knockoutFinalLegs: 1,
    legs: 1,
    winPoints: "3",
    drawPoints: "1",
    lossPoints: "0",
    entrants: [newEntrant(), newEntrant()],
    groups: [newGroup()],
  };
}
export function draftFromTournament(t: Tournament): SetupDraft {
  return {
    name: t.name,
    game: t.game === "CODM" ? "CODM" : "EFOOTBALL",
    format: t.format,
    knockoutLegs: t.knockoutLegs === 2 ? 2 : 1,
    knockoutFinalLegs: t.knockoutFinalLegs === 2 ? 2 : 1,
    legs: t.legs === 2 ? 2 : 1,
    winPoints: String(t.winPoints),
    drawPoints: String(t.drawPoints),
    lossPoints: String(t.lossPoints),
    entrants: t.entrants.map(
      (entrant: Tournament["entrants"][number]): DraftEntrant => ({
        clientId: entrant.id,
        id: entrant.id,
        name: entrant.name,
        aliases: entrant.aliases.join(", "),
        groupId: entrant.groupId,
      }),
    ),
    groups: t.groups.length
      ? t.groups.map((group: Tournament["groups"][number]): DraftGroup => ({
          clientId: group.id,
          name: group.name,
          qualifierCount: String(group.qualifierCount),
        }))
      : [newGroup()],
  };
}
