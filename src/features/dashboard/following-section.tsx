import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BookmarkX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errorMessage, FollowingPage } from "../../shared/api/arena-api";
import { queryKeys } from "../../shared/api/query-keys";
import { Pagination } from "../../shared/ui/pagination";
import { StatusBadge, Spinner } from "../../shared/ui/primitives";
interface FollowingSectionProps {
  userId: string;
}
export function FollowingSection({
  userId,
}: FollowingSectionProps): React.JSX.Element {
  const [page, setPage] = useState(1);
  const cache = useQueryClient();
  const queryKey = queryKeys.following(userId, page);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }: { signal: AbortSignal }): Promise<FollowingPage> =>
      api.following(page, 20, signal),
    enabled: Boolean(userId),
    retry: false,
  });
  const unfollow = useMutation({
    mutationFn: (publicId: string): Promise<void> => api.unfollow(publicId),
    onSuccess: async (_data: void, publicId: string): Promise<void> => {
      if (page > 1 && query.data?.items.length === 1) setPage(page - 1);
      await cache.invalidateQueries({
        queryKey: ["private", userId, "following"],
      });
      await cache.invalidateQueries({
        queryKey: queryKeys.followingStatus(userId, publicId),
      });
    },
  });
  return (
    <section className="following-section" aria-labelledby="following-heading">
      <div className="section-heading">
        <div>
          <span className="eyebrow">PUBLIC TOURNAMENTS</span>
          <h2 id="following-heading">Following</h2>
        </div>
      </div>
      {query.isPending ? (
        <Spinner />
      ) : query.error ? (
        <p role="alert">{errorMessage(query.error)}</p>
      ) : query.data?.items.length ? (
        <>
          <div className="tournament-grid">
            {query.data.items.map(
              (item: FollowingPage["items"][number]): React.JSX.Element => (
                <article
                  className="tournament-card following-card"
                  key={item.publicId}
                >
                  <Link
                    to={`/t/${item.publicId}`}
                    className="following-card-link"
                  >
                    <div className="card-top">
                      <StatusBadge status={item.status} />
                      <ArrowUpRight size={20} />
                    </div>
                    <span className="game-label">
                      {item.game === "EFOOTBALL"
                        ? "eFOOTBALL"
                        : "CALL OF DUTY: MOBILE"}
                    </span>
                    <h3>{item.name}</h3>
                    <p>{item.format}</p>
                    <span className="mono">{item.publicId}</span>
                  </Link>
                  <button
                    className="text-button muted"
                    disabled={unfollow.isPending}
                    onClick={(): void => unfollow.mutate(item.publicId)}
                  >
                    <BookmarkX size={15} /> Unfollow
                  </button>
                </article>
              ),
            )}
          </div>
          <Pagination
            page={page}
            limit={20}
            total={query.data.total}
            pending={query.isFetching}
            onPage={setPage}
            label="Followed tournaments"
          />
        </>
      ) : (
        <div className="empty">
          <h3>You aren’t following any tournaments yet.</h3>
          <p>Find a public tournament and follow it to keep it close.</p>
          <Link className="button" to="/">
            Find tournaments
          </Link>
        </div>
      )}
      {unfollow.error && <p role="alert">{errorMessage(unfollow.error)}</p>}
    </section>
  );
}
