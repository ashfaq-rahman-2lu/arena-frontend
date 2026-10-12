import type { ReactElement } from "react";
export interface ConflictReviewProps {
  local: unknown;
  latest: unknown;
  onUseLatest: () => void;
  onReapply: () => void;
  error?: string;
  pending?: boolean;
}
export function ConflictReview({
  local,
  latest,
  onUseLatest,
  onReapply,
  error,
  pending,
}: ConflictReviewProps): ReactElement {
  return (
    <section className="conflict-review" aria-labelledby="conflict-heading">
      <h3 id="conflict-heading">
        This tournament changed while you were editing
      </h3>
      <p>
        Review your draft against the latest values. Reapply keeps your input
        for a separate save.
      </p>
      <div className="conflict-values">
        <div>
          <h4>Your draft</h4>
          <pre>{JSON.stringify(local, null, 2)}</pre>
        </div>
        <div>
          <h4>Latest saved values</h4>
          <pre>{JSON.stringify(latest, null, 2)}</pre>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="action-row">
        <button
          type="button"
          className="button secondary"
          disabled={pending}
          onClick={onUseLatest}
        >
          Use latest
        </button>
        <button
          type="button"
          className="button"
          disabled={pending}
          onClick={onReapply}
        >
          Reapply draft
        </button>
      </div>
    </section>
  );
}
