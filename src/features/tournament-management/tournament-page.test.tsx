import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api, ApiError } from "../../shared/api/arena-api";
import { tournament } from "../../test/fixtures";
import { TournamentPage } from "./tournament-page";
test("a failed start retains the fixture dialog and shows a persistent error", async (): Promise<void> => {
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
  const get = vi
    .spyOn(api, "get")
    .mockResolvedValue({ ...tournament, status: "DRAFT", matches: [] });
  const preview = vi
    .spyOn(api, "preview")
    .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
  const start = vi
    .spyOn(api, "start")
    .mockRejectedValue(new Error("Could not start. Retry."));
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={["/manage/tournament-id"]}>
        <Routes>
          <Route path="/manage/:id" element={<TournamentPage admin />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: /Review & start/i }),
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Start tournament" }),
  );
  await waitFor((): void => expect(start).toHaveBeenCalled());
  expect(
    await screen.findByRole("dialog", { name: "Review your fixtures" }),
  ).toBeVisible();
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not start");
  get.mockRestore();
  preview.mockRestore();
  start.mockRestore();
  cache.clear();
});
test("tournament tabs support keyboard selection and identify their panel", async (): Promise<void> => {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const get = vi.spyOn(api, "public").mockResolvedValue(tournament);
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={["/t/ARENA2026"]}>
        <Routes>
          <Route path="/t/:publicId" element={<TournamentPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const overview = await screen.findByRole("tab", { name: "Overview" });
  overview.focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Fixtures" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  expect(screen.getByRole("tabpanel", { name: "Fixtures" })).toBeVisible();
  get.mockRestore();
  cache.clear();
});
test("stale rename retains the draft and needs explicit review before a separate save", async (): Promise<void> => {
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
  vi.spyOn(api, "session").mockResolvedValue({
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
  vi.spyOn(api, "get")
    .mockResolvedValueOnce(tournament)
    .mockResolvedValue({ ...tournament, revision: 2 });
  const rename = vi
    .spyOn(api, "rename")
    .mockRejectedValueOnce(
      new ApiError("Review latest", 409, "REVISION_CONFLICT"),
    )
    .mockResolvedValue({ ...tournament, revision: 3 });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={["/manage/tournament-id?tab=teams"]}>
        <Routes>
          <Route path="/manage/:id" element={<TournamentPage admin />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Edit Alpha" }),
  );
  const input = screen.getByRole("textbox", { name: "Team name" });
  await userEvent.clear(input);
  await userEvent.type(input, "Revised Alpha");
  await userEvent.click(screen.getByRole("button", { name: "Save team" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Reapply draft" }),
  );
  expect(rename).toHaveBeenCalledTimes(1);
  expect(input).toHaveValue("Revised Alpha");
  await userEvent.click(screen.getByRole("button", { name: "Save team" }));
  await waitFor((): void =>
    expect(rename).toHaveBeenLastCalledWith(
      "tournament-id",
      "home",
      "Revised Alpha",
      [],
      2,
    ),
  );
  cache.clear();
});
