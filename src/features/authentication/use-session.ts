import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { api, ApiError, Session } from "../../shared/api/arena-api";
import { queryKeys } from "../../shared/api/query-keys";
export function useSession(): UseQueryResult<Session, ApiError> {
  return useQuery({
    queryKey: queryKeys.session(),
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<Session> =>
      api.session(signal),
    staleTime: 60000,
    retry: false,
    networkMode: "always",
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
