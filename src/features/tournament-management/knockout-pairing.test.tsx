import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api, ApiError, type Tournament } from "../../shared/api/arena-api";
import { tournament } from "../../test/fixtures";
import { KnockoutPairing } from "./knockout-pairing";
test("a stale random draw refreshes eligibility for explicit conflict review", async (): Promise<void> => {
  const t: Tournament = {
    ...tournament,
    format: "KNOCKOUT",
    knockoutEligibility: {
      round: 1,
      entrantIds: ["home", "away"],
      byeCount: 0,
    },
  };
  const refresh = vi.fn(async (): Promise<void> => {});
  vi.spyOn(api, "draw").mockRejectedValue(
    new ApiError("Review latest", 409, "REVISION_CONFLICT"),
  );
  render(
    <MemoryRouter>
      <KnockoutPairing
        t={t}
        onClose={vi.fn()}
        onSave={vi.fn()}
        recovery={{
          conflicted: false,
          error: "",
          latest: t,
          onReapply: vi.fn(),
          onLatest: vi.fn(),
          onRefresh: refresh,
        }}
      />
    </MemoryRouter>,
  );
  await userEvent.selectOptions(
    screen.getByLabelText("Pairing method"),
    "RANDOM",
  );
  await userEvent.click(screen.getByRole("button", { name: "Draw opponents" }));
  await waitFor((): void => expect(refresh).toHaveBeenCalledOnce());
});
test("random pairing requires admin byes and confirms the reviewed server draw", async (): Promise<void> => {
  const t: Tournament = {
    ...tournament,
    format: "KNOCKOUT",
    entrants: [
      ...tournament.entrants,
      { id: "third", name: "Gamma", aliases: [], groupId: null },
    ],
    knockoutEligibility: {
      round: 1,
      entrantIds: ["home", "away", "third"],
      byeCount: 1,
    },
  };
  vi.spyOn(api, "draw").mockResolvedValue({
    round: 1,
    pairs: [["away", "third"]],
    byes: ["home"],
    drawToken: "token",
  });
  const save = vi.fn(async (): Promise<void> => {});
  render(
    <MemoryRouter>
      <KnockoutPairing
        t={t}
        onClose={vi.fn()}
        onSave={save}
        recovery={{
          conflicted: false,
          error: "",
          latest: t,
          onReapply: vi.fn(),
          onLatest: vi.fn(),
        }}
      />
    </MemoryRouter>,
  );
  await userEvent.selectOptions(
    screen.getByLabelText("Pairing method"),
    "RANDOM",
  );
  expect(screen.getByRole("button", { name: "Draw opponents" })).toBeDisabled();
  await userEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
  await userEvent.click(screen.getByRole("button", { name: "Draw opponents" }));
  await screen.findByText("Review the draw");
  await userEvent.click(screen.getByRole("button", { name: "Create round" }));
  expect(save).toHaveBeenCalledWith([["away", "third"]], ["home"], {
    method: "RANDOM",
    drawToken: "token",
  });
});
