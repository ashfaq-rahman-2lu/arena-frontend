import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api } from "../shared/api/arena-api";
import { tournament } from "../test/fixtures";
import { Home } from "./Home";

function Location(): React.JSX.Element {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}
function showHome(): QueryClient {
  const cache = new QueryClient();
  vi.spyOn(api, "public").mockResolvedValue(tournament);
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter>
        <Home />
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}
test.each([
  " arena2026 ",
  "https://arena.example/t/arena2026?tab=fixtures#matches",
  "http://localhost:5173/t/ARENA2026/",
])(
  "lookup accepts an ID or shared link: %s",
  async (input: string): Promise<void> => {
    const cache = showHome();
    await userEvent.type(
      screen.getByRole("textbox", { name: /Tournament ID/ }),
      input,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Find tournament" }),
    );
    expect(screen.getByLabelText("Location")).toHaveTextContent("/t/ARENA2026");
    cache.clear();
  },
);
test.each([
  "bad code!",
  "https://arena.example/manage/ARENA2026",
  "javascript:alert(1)",
])(
  "lookup rejects malformed input in place: %s",
  async (input: string): Promise<void> => {
    const cache = showHome();
    await userEvent.type(
      screen.getByRole("textbox", { name: /Tournament ID/ }),
      input,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Find tournament" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /8–10 letters or numbers/,
    );
    expect(screen.getByRole("textbox", { name: /Tournament ID/ })).toHaveValue(
      input,
    );
    expect(screen.getByLabelText("Location")).toHaveTextContent(/^\/$/);
    cache.clear();
  },
);
