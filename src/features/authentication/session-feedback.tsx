import type { UseQueryResult } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import type { ReactElement } from "react";
import type { ApiError, Session } from "../../shared/api/arena-api";

interface SessionFeedbackProps {
  session: UseQueryResult<Session, ApiError>;
  variant?: "page" | "inline";
}

export function SessionFeedback({
  session,
  variant = "page",
}: SessionFeedbackProps): ReactElement {
  const feedback =
    session.isFetching || session.isPending ? (
      <div
        className={variant === "page" ? "loading" : "session-inline"}
        role="status"
      >
        <LoaderCircle className="spin" aria-hidden="true" />
        <span>Starting server…</span>
      </div>
    ) : (
      <div
        className={variant === "page" ? "empty error-panel" : "session-inline"}
      >
        <div role="alert">
          {variant === "page" ? (
            <h1>Couldn’t connect to Arena</h1>
          ) : (
            <span>Connection unavailable.</span>
          )}
          {variant === "page" && (
            <p>The server may still be starting. Please try again.</p>
          )}
        </div>
        <button
          type="button"
          className="button secondary"
          onClick={(): void => {
            void session.refetch();
          }}
        >
          Retry
        </button>
      </div>
    );
  return variant === "inline" ? (
    feedback
  ) : (
    <main id="main-content" className="container">
      {feedback}
    </main>
  );
}
