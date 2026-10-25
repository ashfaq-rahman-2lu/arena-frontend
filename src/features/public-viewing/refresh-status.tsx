import type { ReactElement } from "react";
import { RotateCw } from "lucide-react";

interface RefreshStatusProps {
  updatedAt: number;
  fetching: boolean;
  failed: boolean;
  onRefresh: () => void;
}
export function RefreshStatus({
  updatedAt,
  fetching,
  failed,
  onRefresh,
}: RefreshStatusProps): ReactElement {
  const updated = new Date(updatedAt);
  return (
    <div className="public-refresh">
      <p role="status">
        {failed ? "Couldn’t refresh " : fetching ? "Updating… " : "Updated "}
        <time
          dateTime={updated.toISOString()}
          title="Last successful update (local time)"
        >
          {updated.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
        {" · Every 1 min"}
      </p>
      <button
        type="button"
        className="icon-button"
        aria-label="Refresh now"
        title="Refresh now"
        disabled={fetching}
        onClick={onRefresh}
      >
        <RotateCw size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
