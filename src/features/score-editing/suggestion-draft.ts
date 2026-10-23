export type DraftScores = {
  home: string;
  away: string;
  homeTiebreak: string;
  awayTiebreak: string;
  winner: string;
};
export interface SwapDraftContext {
  homeId: string;
  awayId: string;
  aggregate: boolean;
}
export function swapDraftScores(
  draft: DraftScores,
  context: SwapDraftContext,
): DraftScores {
  return {
    home: draft.away,
    away: draft.home,
    homeTiebreak: context.aggregate ? "" : draft.awayTiebreak,
    awayTiebreak: context.aggregate ? "" : draft.homeTiebreak,
    winner: context.aggregate
      ? ""
      : draft.winner === context.homeId
        ? context.awayId
        : draft.winner === context.awayId
          ? context.homeId
          : "",
  };
}
export function mergeSuggestedScores(
  old: DraftScores,
  values: Partial<Record<keyof DraftScores, number | null>>,
  touched: Set<string>,
): DraftScores {
  const next = { ...old };
  for (const [key, value] of Object.entries(values))
    if (value != null && !touched.has(key))
      next[key as keyof DraftScores] = String(value);
  return next;
}
