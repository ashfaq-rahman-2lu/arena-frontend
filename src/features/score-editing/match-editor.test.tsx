import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api, ApiError, Suggestion } from "../../shared/api/arena-api";
import { match, tournament } from "../../test/fixtures";
import { MatchEditor } from "./match-editor";
test("clearing a saved result requires confirmation and keeps the editor on cancellation", async (): Promise<void> => {
  const confirmation = vi.spyOn(window, "confirm").mockReturnValue(false);
  const preview = vi.spyOn(api, "impact").mockResolvedValue({
    requiresReset: false,
    reason: null,
    roundIds: [],
    matchIds: [],
    resetQualification: false,
    impactToken: "token",
    tournamentRevision: 1,
  });
  const result = vi.spyOn(api, "result").mockResolvedValue(tournament);
  const close = vi.fn();
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <MatchEditor
          t={tournament}
          match={match}
          onClose={close}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Clear result" }));
  expect(confirmation).toHaveBeenCalled();
  expect(preview).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  confirmation.mockRestore();
  preview.mockRestore();
  result.mockRestore();
  cache.clear();
});
test("a failed save retains scores and the dialog for a separate retry", async (): Promise<void> => {
  const preview = vi
    .spyOn(api, "impact")
    .mockRejectedValue(new Error("Connection failed. Retry."));
  const close = vi.fn();
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <MatchEditor
          t={tournament}
          match={match}
          onClose={close}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Connection failed",
  );
  expect(screen.getByRole("spinbutton", { name: "Alpha score" })).toHaveValue(
    2,
  );
  expect(close).not.toHaveBeenCalled();
  preview.mockRestore();
  cache.clear();
});
test("late extraction preserves typed fields; replacing a file cancels and ignores the old suggestion", async (): Promise<void> => {
  let release: ((suggestion: Suggestion) => void) | undefined;
  let signal: AbortSignal | undefined;
  const extraction = vi
    .spyOn(api, "extract")
    .mockImplementation(
      (_id: string, _file: File, active?: AbortSignal): Promise<Suggestion> => {
        signal = active;
        return new Promise<Suggestion>(
          (resolve: (suggestion: Suggestion) => void): void => {
            release = resolve;
          },
        );
      },
    );
  const revoked = vi.spyOn(URL, "revokeObjectURL");
  const cache = new QueryClient();
  const view = render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <MatchEditor
          t={tournament}
          match={match}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.upload(
    screen.getByLabelText("Scorecard image"),
    new File(["image"], "first.png", { type: "image/png" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Read scorecard" }));
  const home = screen.getByRole("spinbutton", { name: "Alpha score" });
  await userEvent.clear(home);
  await userEvent.type(home, "9");
  await userEvent.upload(
    screen.getByLabelText("Scorecard image"),
    new File(["replacement"], "second.png", { type: "image/png" }),
  );
  expect(signal?.aborted).toBe(true);
  if (!release) throw new Error("Missing extraction request");
  release({
    matched: true,
    observedSides: [
      { name: "Alpha", score: 4, tiebreak: null },
      { name: "Beta", score: 0, tiebreak: null },
    ],
    homeScore: 4,
    awayScore: 0,
    homeTiebreak: null,
    awayTiebreak: null,
    warnings: [],
  });
  await waitFor((): void => {
    expect(home).toHaveValue(9);
  });
  expect(screen.queryByText(/Suggested scores filled/)).not.toBeInTheDocument();
  view.unmount();
  expect(revoked).toHaveBeenCalledTimes(2);
  expect(extraction).toHaveBeenCalledTimes(1);
  cache.clear();
});
test("ambiguous suggestions require an explicit mapping and retain zero scores", async (): Promise<void> => {
  vi.spyOn(api, "extract").mockResolvedValue({
    matched: false,
    observedSides: [
      { name: null, score: 0, tiebreak: null },
      { name: null, score: 4, tiebreak: null },
    ],
    homeScore: null,
    awayScore: null,
    homeTiebreak: null,
    awayTiebreak: null,
    warnings: [],
  });
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <MatchEditor
          t={tournament}
          match={match}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.upload(
    screen.getByLabelText("Scorecard image"),
    new File(["image"], "score.png", { type: "image/png" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Read scorecard" }));
  const apply = await screen.findByRole("button", {
    name: "Apply mapped scores",
  });
  expect(apply).toBeDisabled();
  await userEvent.selectOptions(
    screen.getByRole("combobox", { name: /Which side/ }),
    "reverse",
  );
  await userEvent.click(apply);
  expect(screen.getByRole("spinbutton", { name: "Beta score" })).toHaveValue(0);
  cache.clear();
});
test("editing after a correction preview requires a fresh token", async (): Promise<void> => {
  const preview = vi
    .spyOn(api, "impact")
    .mockResolvedValueOnce({
      requiresReset: true,
      reason: "Later rounds will reset",
      roundIds: ["r"],
      matchIds: ["later"],
      resetQualification: false,
      impactToken: "old-token",
      tournamentRevision: 1,
    })
    .mockResolvedValueOnce({
      requiresReset: true,
      reason: "Later rounds will reset",
      roundIds: ["r"],
      matchIds: ["later"],
      resetQualification: false,
      impactToken: "new-token",
      tournamentRevision: 1,
    });
  const result = vi.spyOn(api, "result").mockResolvedValue(tournament);
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <MatchEditor
          t={tournament}
          match={match}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  await screen.findByRole("button", { name: /Confirm correction/ });
  const home = screen.getByRole("spinbutton", { name: "Alpha score" });
  await userEvent.clear(home);
  await userEvent.type(home, "3");
  expect(
    screen.queryByRole("button", { name: /Confirm correction/ }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  await userEvent.click(
    await screen.findByRole("button", { name: /Confirm correction/ }),
  );
  await waitFor((): void =>
    expect(result).toHaveBeenCalledWith(
      "match-id",
      expect.objectContaining({ impactToken: "new-token", homeScore: 3 }),
    ),
  );
  expect(preview).toHaveBeenCalledTimes(2);
  cache.clear();
});
test("leaving a dirty score draft requires a choice and nested dialogs release scroll locking", async (): Promise<void> => {
  const cache = new QueryClient();
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <MatchEditor
          t={tournament}
          match={match}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      ),
    },
    { path: "/away", element: <p>Away</p> },
  ]);
  render(
    <QueryClientProvider client={cache}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await userEvent.type(
    screen.getByRole("spinbutton", { name: "Alpha score" }),
    "3",
  );
  await act(async (): Promise<void> => {
    await router.navigate("/away");
  });
  expect(
    await screen.findByRole("dialog", { name: "Discard unsaved changes?" }),
  ).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Discard and leave" }),
  );
  expect(await screen.findByText("Away")).toBeVisible();
  expect(document.body.style.overflow).toBe("");
  cache.clear();
});
test("an active extraction fills only untouched fields", async (): Promise<void> => {
  let release: ((value: Suggestion) => void) | undefined;
  vi.spyOn(api, "extract").mockImplementation(
    (_id: string, _file: File, _signal?: AbortSignal): Promise<Suggestion> =>
      new Promise<Suggestion>((resolve: (value: Suggestion) => void): void => {
        release = resolve;
      }),
  );
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <MatchEditor
          t={tournament}
          match={match}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.upload(
    screen.getByLabelText("Scorecard image"),
    new File(["image"], "read.png", { type: "image/png" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Read scorecard" }));
  const home = screen.getByRole("spinbutton", { name: "Alpha score" });
  await userEvent.clear(home);
  await userEvent.type(home, "9");
  if (!release) throw new Error("Missing request");
  await act(async (): Promise<void> => {
    release?.({
      matched: true,
      observedSides: [
        { name: "Alpha", score: 4, tiebreak: null },
        { name: "Beta", score: 5, tiebreak: null },
      ],
      homeScore: 4,
      awayScore: 5,
      homeTiebreak: null,
      awayTiebreak: null,
      warnings: [],
    });
  });
  await screen.findByText(/Suggested scores filled/);
  expect(home).toHaveValue(9);
  expect(screen.getByRole("spinbutton", { name: "Beta score" })).toHaveValue(5);
  cache.clear();
});
test("session expiry preserves scores and provides an internal sign-in path", async (): Promise<void> => {
  vi.spyOn(api, "impact").mockRejectedValue(
    new ApiError("Sign in to continue", 401, "UNAUTHENTICATED"),
  );
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <MatchEditor
          t={tournament}
          match={match}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  const link = await screen.findByRole("link", { name: /Sign in/ });
  expect(link.getAttribute("href")).toMatch(/^\/auth\/login\?returnTo=/);
  expect(screen.getByRole("spinbutton", { name: "Alpha score" })).toHaveValue(
    2,
  );
  cache.clear();
});
test("stale scores need review and a fresh correction preview with latest revisions", async (): Promise<void> => {
  const preview = vi
    .spyOn(api, "impact")
    .mockRejectedValueOnce(
      new ApiError("Review latest", 409, "REVISION_CONFLICT"),
    )
    .mockResolvedValueOnce({
      requiresReset: true,
      reason: "Reset later rounds",
      roundIds: ["r"],
      matchIds: ["later"],
      resetQualification: false,
      impactToken: "fresh",
      tournamentRevision: 2,
    });
  vi.spyOn(api, "get").mockResolvedValue({
    ...tournament,
    revision: 2,
    matches: [{ ...match, revision: 2 }],
  });
  const result = vi
    .spyOn(api, "result")
    .mockResolvedValue({ ...tournament, revision: 3 });
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <MatchEditor
          t={tournament}
          match={match}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Reapply draft" }),
  );
  expect(preview).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  await userEvent.click(
    await screen.findByRole("button", { name: "Confirm correction & reset" }),
  );
  await waitFor((): void => {
    expect(result).toHaveBeenCalledWith(
      "match-id",
      expect.objectContaining({
        expectedRevision: 2,
        expectedTournamentRevision: 2,
        impactToken: "fresh",
      }),
    );
  });
  cache.clear();
});
test("invalid empty scores mark and focus the first field without starting a request", async (): Promise<void> => {
  const preview = vi.spyOn(api, "impact");
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <MatchEditor
          t={tournament}
          match={match}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const home = screen.getByRole("spinbutton", { name: "Alpha score" });
  await userEvent.clear(home);
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  expect(home).toHaveAttribute("aria-invalid", "true");
  expect(home).toHaveFocus();
  expect(preview).not.toHaveBeenCalled();
  cache.clear();
});
