import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api, ApiError, type Session } from "../../shared/api/arena-api";
import { AuthPage } from "./auth-page";

interface AuthPageTestOptions {
  session?: Session | null;
  search?: string;
}

const guestSession: Session = {
  csrf: "csrf",
  googleEnabled: false,
  user: null,
};
const signedInSession: Session = {
  ...guestSession,
  user: {
    id: "organizer",
    name: "Alex Arena",
    email: "alex@example.test",
    hasPassword: true,
    googleLinked: false,
  },
};

function mount(
  mode: string,
  { session = guestSession, search = "" }: AuthPageTestOptions = {},
): QueryClient {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (session) cache.setQueryData(["session"], session);
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[`/auth/${mode}${search}`]}>
        <Routes>
          <Route path="/auth/:mode" element={<AuthPage />} />
          <Route path="/dashboard" element={<h1>Dashboard</h1>} />
          <Route path="/t/:publicId" element={<h1>Public tournament</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}

test("signed-in visitors to login are redirected to the dashboard", async (): Promise<void> => {
  const cache = mount("login", { session: signedInSession });
  expect(
    await screen.findByRole("heading", { name: "Dashboard" }),
  ).toBeVisible();
  expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
  cache.clear();
});

test.each(["signed-in", "signed-out"])(
  "login waits for the initial session check before rendering for %s visitors",
  async (state: string): Promise<void> => {
    let finishSession: ((session: Session) => void) | undefined;
    const pending = new Promise<Session>(
      (resolve: (session: Session) => void): void => {
        finishSession = resolve;
      },
    );
    vi.spyOn(api, "session").mockReturnValue(pending);
    const cache = mount("login", { session: null });
    expect(screen.getByRole("status")).toHaveTextContent("Starting server");
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
    await act(async (): Promise<void> => {
      finishSession?.(state === "signed-in" ? signedInSession : guestSession);
      await pending;
    });
    if (state === "signed-in") {
      expect(
        await screen.findByRole("heading", { name: "Dashboard" }),
      ).toBeVisible();
    } else {
      expect(await screen.findByLabelText("Email address")).toBeVisible();
      expect(
        screen.queryByRole("heading", { name: "Dashboard" }),
      ).not.toBeInTheDocument();
    }
    cache.clear();
  },
);

test("a failed session check offers a keyboard-accessible retry before revealing sign-in options", async (): Promise<void> => {
  vi.spyOn(api, "session")
    .mockRejectedValueOnce(new ApiError("Unavailable", 400, "REQUEST_FAILED"))
    .mockResolvedValue({ ...guestSession, googleEnabled: true });
  const cache = mount("login", { session: null });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Couldn’t connect to Arena",
  );
  expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
  const retry = screen.getByRole("button", { name: "Retry" });
  retry.focus();
  await userEvent.keyboard("{Enter}");
  expect(
    await screen.findByRole("link", { name: /Continue with Google/ }),
  ).toBeVisible();
  expect(screen.getByLabelText("Email address")).toBeVisible();
  cache.clear();
});

test.each(["login", "register"])(
  "%s shows Google and email options together after a slow session response",
  async (mode: string): Promise<void> => {
    let finishSession: ((session: Session) => void) | undefined;
    const pending = new Promise<Session>(
      (resolve: (session: Session) => void): void => {
        finishSession = resolve;
      },
    );
    vi.spyOn(api, "session").mockReturnValue(pending);
    const cache = mount(mode, { session: null });
    expect(screen.getByRole("status")).toHaveTextContent("Starting server");
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
    await act(async (): Promise<void> => {
      finishSession?.({ ...guestSession, googleEnabled: true });
      await pending;
    });
    expect(
      await screen.findByRole("link", { name: /Continue with Google/ }),
    ).toBeVisible();
    expect(screen.getByLabelText("Email address")).toBeVisible();
    cache.clear();
  },
);

test.each(["login", "register"])(
  "%s waits for sign-in options when retrying a failed session check",
  async (mode: string): Promise<void> => {
    let finishSession: ((session: Session) => void) | undefined;
    const pending = new Promise<Session>(
      (resolve: (session: Session) => void): void => {
        finishSession = resolve;
      },
    );
    vi.spyOn(api, "session")
      .mockRejectedValueOnce(new Error("Session unavailable"))
      .mockReturnValueOnce(pending);
    const cache = mount(mode, { session: null });
    expect(await screen.findByRole("button", { name: "Retry" })).toBeVisible();
    let refresh: Promise<void> | undefined;
    act((): void => {
      refresh = cache.refetchQueries({ queryKey: ["session"] });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Starting server",
    );
    expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
    await act(async (): Promise<void> => {
      finishSession?.({ ...guestSession, googleEnabled: true });
      await refresh;
    });
    expect(
      await screen.findByRole("link", { name: /Continue with Google/ }),
    ).toBeVisible();
    expect(screen.getByLabelText("Email address")).toBeVisible();
    cache.clear();
  },
);

test.each(["reset", "verify", "email-confirm"])(
  "signed-in visitors can still open the %s token workflow",
  (mode: string): void => {
    const cache = mount(mode, { session: signedInSession });
    expect(screen.getByRole("main")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
    cache.clear();
  },
);

test("signing in still follows a safe return destination", async (): Promise<void> => {
  vi.spyOn(api, "login").mockResolvedValue(signedInSession);
  const cache = mount("login", { search: "?returnTo=%2Ft%2FARENA2026" });
  await userEvent.type(
    screen.getByLabelText("Email address"),
    "alex@example.test",
  );
  await userEvent.type(
    screen.getByLabelText("Password", { exact: true }),
    "password123",
  );
  await userEvent.click(screen.getByRole("button", { name: /Sign in/i }));
  expect(
    await screen.findByRole("heading", { name: "Public tournament" }),
  ).toBeVisible();
  cache.clear();
});

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
