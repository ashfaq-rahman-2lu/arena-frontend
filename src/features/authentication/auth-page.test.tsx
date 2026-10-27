import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api } from "../../shared/api/arena-api";
import { AuthPage } from "./auth-page";

function mount(mode: string): QueryClient {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  cache.setQueryData(["session"], {
    csrf: "csrf",
    googleEnabled: false,
    user: null,
  });
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[`/auth/${mode}`]}>
        <Routes>
          <Route path="/auth/:mode" element={<AuthPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}

test.each(["login", "register", "reset"])(
  "%s permits 8–128 characters in all password fields",
  (mode: string): void => {
    const cache = mount(mode);
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "minlength",
      "8",
    );
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "maxlength",
      "128",
    );
    if (mode !== "login")
      expect(screen.getByText("Use at least 8 characters.")).toBeVisible();
    if (mode === "reset")
      expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
        "minlength",
        "8",
      );
    cache.clear();
  },
);

test("registration submits an eight-character password", async (): Promise<void> => {
  const register = vi
    .spyOn(api, "register")
    .mockResolvedValue({ message: "Sent" });
  const cache = mount("register");
  await userEvent.type(screen.getByLabelText("Your name"), "User");
  await userEvent.type(
    screen.getByLabelText("Email address"),
    "user@example.test",
  );
  await userEvent.type(
    screen.getByLabelText("Password", { exact: true }),
    "abcdefgh",
  );
  await userEvent.click(
    screen.getByRole("button", { name: /Create account/i }),
  );
  await waitFor((): void =>
    expect(register).toHaveBeenCalledWith(
      "User",
      "user@example.test",
      "abcdefgh",
    ),
  );
  cache.clear();
});
