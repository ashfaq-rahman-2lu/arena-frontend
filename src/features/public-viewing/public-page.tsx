import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck } from "lucide-react";
import type { ReactElement } from "react";
import { Link, useParams } from "react-router-dom";
import { api, errorMessage } from "../../shared/api/arena-api";
import { queryKeys } from "../../shared/api/query-keys";
import { useSession } from "../../shared/ui/primitives";
import { TournamentPage } from "../tournament-management/tournament-page";

/** Public routes reuse competition rendering while keeping all owner reads disabled. */
export function PublicPage(): ReactElement {
  const { publicId = "" } = useParams();
  const session = useSession();
  const userId = session.data?.user?.id ?? "";
  const cache = useQueryClient();
  const status = useQuery({
    queryKey: queryKeys.followingStatus(userId, publicId),
    queryFn: (): Promise<boolean> => api.isFollowing(publicId),
    enabled: Boolean(userId && publicId),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (): Promise<void> =>
      status.data ? api.unfollow(publicId) : api.follow(publicId),
    onSuccess: async (): Promise<void> => {
      await cache.invalidateQueries({
        queryKey: queryKeys.followingStatus(userId, publicId),
      });
      await cache.invalidateQueries({
        queryKey: ["private", userId, "following"],
      });
    },
  });
  return (
    <TournamentPage
      publicActions={
        <>
          {userId ? (
            status.error ? (
              <span role="alert">
                {errorMessage(status.error)} Refresh the page to try again.
              </span>
            ) : (
              <button
                className="button secondary"
                disabled={
                  status.isPending ||
                  mutation.isPending ||
                  status.data === undefined
                }
                onClick={(): void => mutation.mutate()}
              >
                {status.data ? (
                  <BookmarkCheck size={17} />
                ) : (
                  <Bookmark size={17} />
                )}
                {status.data ? "Unfollow tournament" : "Follow tournament"}
              </button>
            )
          ) : (
            !session.isPending && (
              <Link
                className="button secondary"
                to={`/auth/login?returnTo=${encodeURIComponent(`/t/${publicId}`)}`}
              >
                Sign in to follow
              </Link>
            )
          )}
          {mutation.error && (
            <span role="alert">{errorMessage(mutation.error)}</span>
          )}
        </>
      }
    />
  );
}
