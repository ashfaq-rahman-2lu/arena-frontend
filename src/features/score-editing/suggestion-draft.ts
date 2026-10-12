export type DraftScores = {
  home: string;
  away: string;
  homeTiebreak: string;
  awayTiebreak: string;
  winner: string;
};
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
