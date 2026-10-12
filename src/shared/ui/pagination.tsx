import type { ReactElement } from "react";
export interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
  pending?: boolean;
  label?: string;
}
export function Pagination({
  page,
  limit,
  total,
  onPage,
  pending = false,
  label = "Results",
}: PaginationProps): ReactElement {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <nav aria-label={`${label} pagination`} className="pagination">
      <button
        type="button"
        className="button secondary small"
        disabled={pending || page <= 1}
        onClick={(): void => onPage(page - 1)}
      >
        Previous
      </button>
      <span role="status">
        Page {page.toLocaleString()} of {pages.toLocaleString()} ·{" "}
        {total.toLocaleString()} {label.toLowerCase()}
      </span>
      <button
        type="button"
        className="button secondary small"
        disabled={pending || page >= pages}
        onClick={(): void => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
