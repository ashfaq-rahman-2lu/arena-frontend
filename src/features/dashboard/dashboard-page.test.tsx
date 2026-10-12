import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api, TournamentFilters } from "../../shared/api/arena-api";
import { Dashboard } from "./dashboard-page";
test("dashboard uses server pages and filters while retaining owner-wide totals", async (): Promise<void> => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  cache.setQueryData(["session"], {
    csrf: "csrf",
    user: {
      id: "owner",
      name: "Admin",
      email: "admin@example.test",
      hasPassword: true,
      googleLinked: false,
    },
    googleEnabled: false,
  });
  const list = vi
    .spyOn(api, "list")
    .mockImplementation(
      async (
        filters: TournamentFilters,
      ): Promise<Awaited<ReturnType<typeof api.list>>> => ({
        items: [],
        total: 45,
        page: filters?.page ?? 1,
        limit: 20,
        totals: {
          tournaments: 45,
          active: 30,
          draft: 10,
          completed: 5,
          entrants: 180,
        },
      }),
    );
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("45")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 2 }),
    expect.any(AbortSignal),
  );
  await userEvent.click(screen.getByRole("button", { name: "In play" }));
  expect(list).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 1, status: "ACTIVE" }),
    expect.any(AbortSignal),
  );
  expect(screen.getByRole("button", { name: "In play" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  list.mockRestore();
  cache.clear();
});
