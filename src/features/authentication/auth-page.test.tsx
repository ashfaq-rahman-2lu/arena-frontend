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
  "%s supports showing and hiding the password without losing its value",
  async (mode: string): Promise<void> => {
    const user = userEvent.setup();
    const cache = mount(mode);
    const input = screen.getByLabelText("Password", { exact: true });
    const login = vi.spyOn(api, "login");
    expect(input).toHaveAttribute("type", "password");
    await user.type(input, "example-password");
    await user.tab();
    const toggle = screen.getByRole("button", {
      name: "Show password",
    });
    expect(toggle).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("example-password");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.keyboard(" ");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveValue("example-password");
    expect(login).not.toHaveBeenCalled();
    cache.clear();
  },
);

test("reset password fields have independent visibility controls", async (): Promise<void> => {
  const user = userEvent.setup();
  const cache = mount("reset");
  await user.click(
    screen.getByRole("button", { name: "Show password confirmation" }),
  );
  expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
    "type",
    "text",
  );
  expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
    "type",
    "password",
  );
  await user.click(
    screen.getByRole("button", { name: "Hide password confirmation" }),
  );
  expect(screen.getByLabelText("Confirm new password")).toHaveAttribute(
    "type",
    "password",
  );
  cache.clear();
});

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
