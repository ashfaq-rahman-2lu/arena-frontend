import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api } from "../../shared/api/arena-api";
import { queryKeys } from "../../shared/api/query-keys";
import { tournament } from "../../test/fixtures";
import { SetupPage } from "./setup-page";
test("setup retains team edits after navigation is kept", async (): Promise<void> => {
  const session = {
    csrf: "csrf",
    user: {
      id: "owner",
      name: "Admin",
      email: "admin@example.test",
      hasPassword: true,
      googleLinked: false,
    },
    googleEnabled: false,
  };
  vi.spyOn(api, "session").mockResolvedValue(session);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["session"], session);
  const router = createMemoryRouter(
    [
      { path: "/new", element: <SetupPage /> },
      { path: "/dashboard", element: <p>Dashboard</p> },
    ],
    { initialEntries: ["/new"] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await userEvent.type(
    screen.getByRole("textbox", { name: "Tournament name" }),
    "My league",
  );
  await userEvent.click(
    screen.getByRole("link", { name: "Back to dashboard" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  const team = screen.getByRole("textbox", { name: "Team 1 name" });
  await userEvent.type(team, "Alpha");
  expect(team).toHaveValue("Alpha");
  client.clear();
});
test("background status changes keep a dirty setup draft available for review", async (): Promise<void> => {
  const session = {
    csrf: "csrf",
    user: {
      id: "owner",
      name: "Admin",
      email: "admin@example.test",
      hasPassword: true,
      googleLinked: false,
    },
    googleEnabled: false,
  };
  vi.spyOn(api, "session").mockResolvedValue(session);
  vi.spyOn(api, "get").mockResolvedValue({ ...tournament, status: "DRAFT" });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["session"], session);
  const router = createMemoryRouter(
    [
      { path: "/manage/:id/setup", element: <SetupPage /> },
      { path: "/manage/:id", element: <p>Management</p> },
    ],
    { initialEntries: ["/manage/tournament-id/setup"] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const name = await screen.findByRole("textbox", { name: "Tournament name" });
  await userEvent.clear(name);
  await userEvent.type(name, "Unsaved name");
  await act(async (): Promise<void> => {
    client.setQueryData(queryKeys.detail("owner", "tournament-id"), {
      ...tournament,
      status: "ACTIVE",
      revision: 2,
    });
  });
  expect(screen.getByRole("textbox", { name: "Tournament name" })).toHaveValue(
    "Unsaved name",
  );
  client.clear();
});
