import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom";
import { expect, test, vi } from "vitest";
import {
  api,
  ApiError,
  Match,
  Suggestion,
  Tournament,
} from "../../shared/api/arena-api";
import { match, tournament } from "../../test/fixtures";
import { MatchEditor } from "./match-editor";

function showSwapEditor(
  editorMatch: Match = match,
  editorTournament: Tournament = tournament,
): QueryClient {
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <MatchEditor
          t={editorTournament}
          match={editorMatch}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}
const swapSuggestion: Suggestion = {
  matched: true,
  homeScore: 1,
  awayScore: 2,
  homeTiebreak: null,
  awayTiebreak: null,
  observedSides: [
    { name: null, score: 1, tiebreak: null },
    { name: null, score: 2, tiebreak: null },
  ],
  warnings: [],
  stats: [
    {
      key: "possession",
      label: "Possession",
      home: 55,
      away: 45,
      unit: "percent",
    },
    { key: "offsides", label: "Offsides", home: null, away: 0, unit: "count" },
  ],
};
async function readSwapImage(name: string = "score.png"): Promise<void> {
  await userEvent.upload(
    screen.getByLabelText("Scorecard image"),
    new File(["image"], name, { type: "image/png" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Read scorecard" }));
}

test("swaps manual CODM scores including zero and empty values without saving", async (): Promise<void> => {
  const save = vi.spyOn(api, "result");
  const cache = showSwapEditor(match, { ...tournament, game: "CODM" });
  const home = screen.getByRole("spinbutton", { name: "Alpha score" });
  const away = screen.getByRole("spinbutton", { name: "Beta score" });
  const swap = screen.getByRole("button", {
    name: "Swap results",
  });
  await userEvent.click(swap);
  expect(home).toHaveValue(0);
  expect(away).toHaveValue(2);
  expect(screen.getByText(/Results swapped/)).toHaveAttribute("role", "status");
  await userEvent.click(swap);
  expect(home).toHaveValue(2);
  expect(away).toHaveValue(0);
  await userEvent.clear(home);
  await userEvent.click(swap);
  expect(home).toHaveValue(0);
  expect(away).toHaveValue(null);
  await userEvent.clear(home);
  expect(swap).toBeDisabled();
  expect(save).not.toHaveBeenCalled();
  cache.clear();
});

test("saves swapped scores only after Save result with the original match identity", async (): Promise<void> => {
  const preview = vi.spyOn(api, "impact").mockResolvedValue({
    requiresReset: false,
    reason: null,
    roundIds: [],
    matchIds: [],
    resetQualification: false,
    impactToken: "token",
    tournamentRevision: 1,
  });
  const save = vi.spyOn(api, "result").mockResolvedValue(tournament);
  const cache = showSwapEditor();
  await userEvent.click(screen.getByRole("button", { name: "Swap results" }));
  expect(preview).not.toHaveBeenCalled();
  expect(save).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  await waitFor((): void =>
    expect(save).toHaveBeenCalledWith(
      match.id,
      expect.objectContaining({
        homeScore: 0,
        awayScore: 2,
        expectedRevision: match.revision,
        expectedTournamentRevision: tournament.revision,
      }),
    ),
  );
  expect(screen.getByRole("spinbutton", { name: "Alpha score" })).toHaveValue(
    0,
  );
  expect(screen.getByRole("spinbutton", { name: "Beta score" })).toHaveValue(2);
  cache.clear();
});

test("swaps OCR scores and stat columns, restores them on a second swap, and resets new-image orientation", async (): Promise<void> => {
  vi.spyOn(api, "extract").mockResolvedValue(swapSuggestion);
  const cache = showSwapEditor();
  await readSwapImage();
  await screen.findByRole("table", { name: "Extracted match stats" });
  expect(
    screen.getByRole("columnheader", { name: "Home · Alpha" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("columnheader", { name: "Away · Beta" }),
  ).toBeInTheDocument();
  const swap = screen.getByRole("button", {
    name: "Swap results",
  });
  await userEvent.click(swap);
  expect(screen.getByRole("spinbutton", { name: "Alpha score" })).toHaveValue(
    2,
  );
  expect(screen.getByRole("spinbutton", { name: "Beta score" })).toHaveValue(1);
  expect(
    screen.getByRole("row", { name: "Possession 45% 55%" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("row", { name: "Offsides 0 Unreadable" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Screenshot sides reversed/)).toBeInTheDocument();
  await userEvent.click(swap);
  expect(
    screen.getByRole("row", { name: "Possession 55% 45%" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/Screenshot sides reversed/),
  ).not.toBeInTheDocument();
  await userEvent.click(swap);
  await readSwapImage("replacement.png");
  await screen.findByRole("row", { name: "Possession 55% 45%" });
  expect(
    screen.queryByText(/Screenshot sides reversed/),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("spinbutton", { name: "Alpha score" })).toHaveValue(
    2,
  );
  expect(screen.getByRole("spinbutton", { name: "Beta score" })).toHaveValue(1);
  cache.clear();
});

test("swaps single-match knockout tiebreaks and the selected winner", async (): Promise<void> => {
  const knockout: Match = {
    ...match,
    stage: "KNOCKOUT",
    homeScore: 1,
    awayScore: 1,
    homeTiebreak: 5,
    awayTiebreak: 4,
    winnerId: match.homeId,
  };
  const cache = showSwapEditor(knockout);
  await userEvent.click(screen.getByRole("button", { name: "Swap results" }));
  expect(
    screen.getByRole("spinbutton", { name: "Alpha tiebreak (optional)" }),
  ).toHaveValue(4);
  expect(
    screen.getByRole("spinbutton", { name: "Beta tiebreak (optional)" }),
  ).toHaveValue(5);
  expect(
    screen.getByRole("combobox", { name: "Winner of the tied match" }),
  ).toHaveValue(match.awayId);
  await userEvent.click(screen.getByRole("button", { name: "Swap results" }));
  expect(
    screen.getByRole("combobox", { name: "Winner of the tied match" }),
  ).toHaveValue(match.homeId);
  cache.clear();
});

test("recalculates two-leg aggregates and clears old aggregate decisions after swapping", async (): Promise<void> => {
  const first: Match = {
    ...match,
    id: "leg1",
    stage: "KNOCKOUT",
    knockoutTieId: "tie",
    homeScore: 2,
    awayScore: 0,
  };
  const second: Match = {
    ...first,
    id: "leg2",
    leg: 2,
    homeId: match.awayId,
    awayId: match.homeId,
  };
  const cup: Tournament = {
    ...tournament,
    format: "KNOCKOUT",
    matches: [first, second],
    knockoutTies: [
      {
        id: "tie",
        roundId: "r",
        slot: 0,
        homeId: match.homeId,
        awayId: match.awayId,
        legs: 2,
        homeAggregate: 2,
        awayAggregate: 2,
        homeTiebreak: 3,
        awayTiebreak: 4,
        winnerId: match.awayId,
      },
    ],
  };
  const preview = vi
    .spyOn(api, "impact")
    .mockRejectedValue(new Error("Stop before saving"));
  const cache = showSwapEditor(second, cup);
  expect(
    screen.getByRole("combobox", { name: "Winner of the tied aggregate" }),
  ).toHaveValue(match.awayId);
  await userEvent.click(screen.getByRole("button", { name: "Swap results" }));
  expect(screen.getByText(/Aggregate: Alpha 4 – 0 Beta/)).toBeInTheDocument();
  expect(
    screen.queryByRole("combobox", { name: "Winner of the tied aggregate" }),
  ).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  await waitFor((): void =>
    expect(preview).toHaveBeenCalledWith(
      "leg2",
      expect.objectContaining({
        homeScore: 0,
        awayScore: 2,
        homeTiebreak: null,
        awayTiebreak: null,
        winnerId: null,
      }),
    ),
  );
  await userEvent.click(screen.getByRole("button", { name: "Swap results" }));
  expect(
    screen.getByRole("spinbutton", { name: "Alpha tiebreak (optional)" }),
  ).toHaveValue(null);
  expect(
    screen.getByRole("spinbutton", { name: "Beta tiebreak (optional)" }),
  ).toHaveValue(null);
  expect(
    screen.getByRole("combobox", { name: "Winner of the tied aggregate" }),
  ).toHaveValue("");
  cache.clear();
});

test("disables swapping during extraction and preserves swapped scores from later OCR", async (): Promise<void> => {
  let release: ((value: Suggestion) => void) | undefined;
  vi.spyOn(api, "extract").mockImplementation(
    (_id: string, _file: File, _signal?: AbortSignal): Promise<Suggestion> =>
      new Promise<Suggestion>((resolve: (value: Suggestion) => void): void => {
        release = resolve;
      }),
  );
  const cache = showSwapEditor();
  const swap = screen.getByRole("button", {
    name: "Swap results",
  });
  await userEvent.click(swap);
  await readSwapImage();
  expect(swap).toBeDisabled();
  await act(async (): Promise<void> => {
    release?.(swapSuggestion);
  });
  await waitFor((): void => {
    expect(swap).toBeEnabled();
  });
  expect(screen.getByRole("spinbutton", { name: "Alpha score" })).toHaveValue(
    0,
  );
  expect(screen.getByRole("spinbutton", { name: "Beta score" })).toHaveValue(2);
  cache.clear();
});

test("swap clears validation errors and invalidates correction confirmation", async (): Promise<void> => {
  vi.spyOn(api, "impact").mockResolvedValue({
    requiresReset: true,
    reason: "Later rounds will reset",
    roundIds: ["r"],
    matchIds: ["later"],
    resetQualification: false,
    impactToken: "old-token",
    tournamentRevision: 1,
  });
  const save = vi.spyOn(api, "result");
  const cache = showSwapEditor();
  const home = screen.getByRole("spinbutton", { name: "Alpha score" });
  await userEvent.clear(home);
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  await waitFor((): void => {
    expect(home).toHaveAttribute("aria-invalid", "true");
  });
  await userEvent.click(screen.getByRole("button", { name: "Swap results" }));
  expect(home).not.toHaveAttribute("aria-invalid", "true");
  expect(screen.queryAllByRole("alert")).toHaveLength(0);
  await userEvent.type(
    screen.getByRole("spinbutton", { name: "Beta score" }),
    "2",
  );
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  await screen.findByRole("button", { name: /Confirm correction/ });
  await userEvent.click(screen.getByRole("button", { name: "Swap results" }));
  expect(
    screen.queryByRole("button", { name: /Confirm correction/ }),
  ).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  cache.clear();
});

test("disables swapping throughout preview and save requests", async (): Promise<void> => {
  let releasePreview:
    ((value: import("../../shared/api/arena-api").Impact) => void) | undefined;
  let releaseSave: ((value: Tournament) => void) | undefined;
  vi.spyOn(api, "impact").mockImplementation(
    (
      _id: string,
      _body: import("../../shared/api/arena-api").ResultInput,
    ): Promise<import("../../shared/api/arena-api").Impact> =>
      new Promise(
        (
          resolve: (value: import("../../shared/api/arena-api").Impact) => void,
        ): void => {
          releasePreview = resolve;
        },
      ),
  );
  vi.spyOn(api, "result").mockImplementation(
    (
      _id: string,
      _body: import("../../shared/api/arena-api").ResultInput,
    ): Promise<Tournament> =>
      new Promise((resolve: (value: Tournament) => void): void => {
        releaseSave = resolve;
      }),
  );
  const cache = showSwapEditor();
  const swap = screen.getByRole("button", {
    name: "Swap results",
  });
  await userEvent.click(screen.getByRole("button", { name: "Save result" }));
  expect(swap).toBeDisabled();
  await act(async (): Promise<void> => {
    releasePreview?.({
      requiresReset: false,
      reason: null,
      roundIds: [],
      matchIds: [],
      resetQualification: false,
      impactToken: "token",
      tournamentRevision: 1,
    });
  });
  expect(swap).toBeDisabled();
  await act(async (): Promise<void> => {
    releaseSave?.(tournament);
  });
  cache.clear();
});
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

test("shows extracted stats for both sides without saving them", async (): Promise<void> => {
  vi.spyOn(api, "extract").mockResolvedValue({
    matched: true,
    observedSides: [
      { name: null, score: 1, tiebreak: null },
      { name: null, score: 2, tiebreak: null },
    ],
    homeScore: 1,
    awayScore: 2,
    homeTiebreak: null,
    awayTiebreak: null,
    warnings: [],
    stats: [
      {
        key: "possession",
        label: "Possession",
        home: 55,
        away: 45,
        unit: "percent",
      },
      { key: "passes", label: "Passes", home: 115, away: null, unit: "count" },
      { key: "offsides", label: "Offsides", home: 1, away: 0, unit: "count" },
    ],
  });
  const save = vi.spyOn(api, "result");
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
    new File(["image"], "stats.png", { type: "image/png" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Read scorecard" }));
  expect(
    await screen.findByRole("table", { name: "Extracted match stats" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("row", { name: "Possession 55% 45%" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("row", { name: "Passes 115 Unreadable" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("row", { name: "Offsides 1 0" })).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  cache.clear();
});

test("CODM tournaments offer manual scores without scorecard upload", async (): Promise<void> => {
  const extract = vi.spyOn(api, "extract");
  const cache = new QueryClient();
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <MatchEditor
          t={{ ...tournament, game: "CODM" }}
          match={match}
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.queryByLabelText("Scorecard image")).not.toBeInTheDocument();
  expect(screen.queryByText("Have a scorecard?")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Read scorecard" }),
  ).not.toBeInTheDocument();
  const home = screen.getByRole("spinbutton", { name: "Alpha score" });
  await userEvent.clear(home);
  await userEvent.type(home, "9");
  expect(home).toHaveValue(9);
  expect(screen.getByRole("button", { name: "Save result" })).toBeEnabled();
  expect(extract).not.toHaveBeenCalled();
  cache.clear();
});
