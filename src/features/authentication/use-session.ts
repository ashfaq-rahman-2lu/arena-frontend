import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { api, ApiError, Session } from "../../shared/api/arena-api";
import { queryKeys } from "../../shared/api/query-keys";
import { recoverSession } from "./session-recovery";
export function useSession(): UseQueryResult<Session, ApiError> {
  return useQuery({
    queryKey: queryKeys.session(),
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<Session> =>
      recoverSession(
        (requestSignal: AbortSignal): Promise<Session> =>
          api.session(requestSignal),
        signal,
      ),
    staleTime: 60000,
    retry: false,
    networkMode: "always",
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
