import {
  QueryFunctionContext,
  useMutation,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  api,
  ApiError,
  FixturePage,
  HistoryPage,
  Tournament,
  TournamentFilters,
  TournamentPage,
} from "./arena-api";
import { queryKeys } from "./query-keys";
export interface TournamentJob {
  run: () => Promise<Tournament>;
}
export function useDashboard(
  ownerId: string,
  filters: TournamentFilters,
): UseQueryResult<TournamentPage, ApiError> {
  return useQuery({
    queryKey: queryKeys.dashboard(ownerId, filters),
    queryFn: ({ signal }: QueryFunctionContext): Promise<TournamentPage> =>
      api.list(filters, signal),
    enabled: Boolean(ownerId),
    retry: false,
  });
}
export function useCompetition(
  admin: boolean,
  ownerId: string,
  id: string,
  publicId: string,
): UseQueryResult<Tournament, ApiError> {
  return useQuery({
    queryKey: admin
      ? queryKeys.detail(ownerId, id)
      : queryKeys.public(publicId),
    queryFn: ({ signal }: QueryFunctionContext): Promise<Tournament> =>
      admin ? api.get(id, signal) : api.public(publicId, signal),
    enabled: admin ? Boolean(ownerId && id) : Boolean(publicId),
    refetchInterval: admin ? false : 15000,
    refetchIntervalInBackground: false,
    retry: false,
  });
}
export function useHistory(
  ownerId: string,
  id: string,
  revision: number,
  page: number,
  enabled: boolean,
): UseQueryResult<HistoryPage, ApiError> {
  return useQuery({
    queryKey: queryKeys.history(ownerId, id, revision, page),
    queryFn: ({ signal }: QueryFunctionContext): Promise<HistoryPage> =>
      api.history(id, page, 20, signal),
    enabled: Boolean(ownerId && id && enabled),
    retry: false,
  });
}
export function usePreview(
  ownerId: string,
  id: string,
  revision: number,
  page: number,
  enabled: boolean,
): UseQueryResult<FixturePage, ApiError> {
  return useQuery({
    queryKey: queryKeys.preview(ownerId, id, revision, page),
    queryFn: ({ signal }: QueryFunctionContext): Promise<FixturePage> =>
      api.preview(id, page, 20, signal),
    enabled: Boolean(ownerId && id && enabled),
    retry: false,
  });
}
export function useTournamentMutation(
  ownerId: string,
): UseMutationResult<Tournament, ApiError, TournamentJob> {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: (job: TournamentJob): Promise<Tournament> => job.run(),
    retry: false,
    onSuccess: async (tournament: Tournament): Promise<void> => {
      cache.setQueryData(queryKeys.detail(ownerId, tournament.id), tournament);
      await Promise.all([
        cache.invalidateQueries({ queryKey: queryKeys.private(ownerId) }),
        cache.invalidateQueries({ queryKey: ["session"] }),
        cache.invalidateQueries({
          queryKey: queryKeys.public(tournament.publicId),
        }),
      ]);
    },
  });
}
