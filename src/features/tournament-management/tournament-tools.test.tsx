import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api } from "../../shared/api/arena-api";
import { tournament } from "../../test/fixtures";
import { TournamentTools } from "./tournament-tools";
test("rename failures preserve the name draft and show an error", async (): Promise<void> => {
  vi.spyOn(api, "renameTournament").mockRejectedValue(new Error("Try again"));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TournamentTools t={tournament} ownerId="owner" onSaved={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Edit tournament name" }),
  );
  const input = screen.getByRole("textbox", { name: "Tournament name" });
  await userEvent.clear(input);
  await userEvent.type(input, "Renamed tournament");
  await userEvent.click(screen.getByRole("button", { name: "Save name" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Try again");
  expect(input).toHaveValue("Renamed tournament");
  client.clear();
});
test("started knockout tournaments have no add-teams action", (): void => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TournamentTools
          t={{ ...tournament, format: "KNOCKOUT" }}
          ownerId="owner"
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(
    screen.queryByRole("button", { name: "Add teams" }),
  ).not.toBeInTheDocument();
  client.clear();
});
