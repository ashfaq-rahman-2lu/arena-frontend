import type { TournamentFilters } from "./arena-api";
export const queryKeys = {
  session: (): readonly string[] => ["session"],
  private: (ownerId: string): readonly string[] => ["private", ownerId],
  dashboard: (
    ownerId: string,
    filters: TournamentFilters,
  ): readonly unknown[] => ["private", ownerId, "dashboard", filters],
  detail: (ownerId: string, id: string): readonly string[] => [
    "private",
    ownerId,
    "tournament",
    id,
  ],
  history: (
    ownerId: string,
    id: string,
    revision: number,
    page: number,
  ): readonly unknown[] => [
    "private",
    ownerId,
    "history",
    id,
    revision,
    page,
    20,
  ],
  preview: (
    ownerId: string,
    id: string,
    revision: number,
    page: number,
  ): readonly unknown[] => [
    "private",
    ownerId,
    "preview",
    id,
    revision,
    page,
    20,
  ],
  public: (publicId: string): readonly string[] => [
    "public",
    "tournament",
    publicId,
  ],
  publicMatchStats: (publicId: string, matchId: string): readonly string[] => [
    "public",
    "match-stats",
    publicId,
    matchId,
  ],
  following: (userId: string, page: number): readonly unknown[] => [
    "private",
    userId,
    "following",
    page,
  ],
  followingStatus: (userId: string, publicId: string): readonly unknown[] => [
    "private",
    userId,
    "following-status",
    publicId,
  ],
};
