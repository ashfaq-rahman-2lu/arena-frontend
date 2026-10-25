import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RefreshStatus } from "./refresh-status";

test("shows a compact minute-only local time and an accessible icon-only refresh button", async (): Promise<void> => {
  const refresh = vi.fn<() => void>();
  render(
    <RefreshStatus
      updatedAt={Date.parse("2026-10-25T10:05:56Z")}
      fetching={false}
      failed={false}
      onRefresh={refresh}
    />,
  );
  const status = screen.getByRole("status");
  const time = status.querySelector("time");
  expect(time).toHaveTextContent(/^\d{1,2}:\d{2}(?:\s?[AP]M)?$/);
  expect(status).toHaveTextContent(/Updated .* · Every 1 min/);
  expect(status).not.toHaveTextContent(/GMT|UTC|:56/);
  const button = screen.getByRole("button", { name: "Refresh now" });
  expect(button).toHaveTextContent(/^$/);
  button.focus();
  await userEvent.keyboard("{Enter}");
  expect(refresh).toHaveBeenCalledOnce();
});

test("keeps pending and failed feedback compact while preserving refresh recovery", (): void => {
  const refresh = vi.fn<() => void>();
  const { rerender } = render(
    <RefreshStatus
      updatedAt={Date.parse("2026-10-25T10:05:56Z")}
      fetching
      failed={false}
      onRefresh={refresh}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    /Updating… .* · Every 1 min/,
  );
  expect(screen.getByRole("button", { name: "Refresh now" })).toBeDisabled();
  rerender(
    <RefreshStatus
      updatedAt={Date.parse("2026-10-25T10:05:56Z")}
      fetching={false}
      failed
      onRefresh={refresh}
    />,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    /Couldn’t refresh .* · Every 1 min/,
  );
  expect(screen.getByRole("button", { name: "Refresh now" })).toBeEnabled();
});
