import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { api, ApiError, Session } from "../../shared/api/arena-api";
import { queryKeys } from "../../shared/api/query-keys";
export function useSession(): UseQueryResult<Session, ApiError> {
  return useQuery({
    queryKey: queryKeys.session(),
    queryFn: api.session,
    staleTime: 60000,
    retry: false,
  });
}
