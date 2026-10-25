/** Open a team's complete schedule rather than carrying unrelated filters forward. */
export function teamFixturesSearch(entrantId: string): string {
  return `?${new URLSearchParams({ tab: "fixtures", team: entrantId }).toString()}`;
}
