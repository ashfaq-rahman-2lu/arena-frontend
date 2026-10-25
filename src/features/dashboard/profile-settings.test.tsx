import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import {
  api,
  type EmailChangeResult,
  type Session,
} from "../../shared/api/arena-api";
import { ProfileSettings } from "./profile-settings";

const session: Session = {
  csrf: "csrf",
  googleEnabled: true,
  user: {
    id: "one",
    email: "one@example.test",
    name: "One",
    hasPassword: true,
    googleLinked: false,
  },
};
function mount(value: Session = session): QueryClient {
  const cache = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={cache}>
      <ProfileSettings session={value} onClose={(): void => {}} />
    </QueryClientProvider>,
  );
  return cache;
}
async function emailDraft(): Promise<HTMLInputElement> {
  await userEvent.type(
    screen.getByLabelText("New email address"),
    "new@example.test",
  );
  const input = screen.getAllByLabelText("Current password")[0];
  if (!(input instanceof HTMLInputElement))
    throw new Error("Missing email password field");
  await userEvent.type(input, "CurrentPassword2026!");
  return input;
}
test("email success clears only its password and retains email, feedback, and separate password drafts", async (): Promise<void> => {
  vi.spyOn(api, "requestEmailChange").mockResolvedValue({
    status: "verification_sent",
    message: "Check your email.",
  });
  const change = vi.spyOn(api, "changePassword");
  const cache = mount();
  const input = await emailDraft();
  const passwordInput = screen.getAllByLabelText("Current password")[1];
  if (!passwordInput) throw new Error("Missing change password field");
  await userEvent.type(passwordInput, "SeparatePassword2026!");
  await userEvent.type(
    screen.getByLabelText("New password"),
    "AnotherPassword2026!",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Send email confirmation" }),
  );
  expect(await screen.findByText("Check your email.")).toBeVisible();
  expect(input).toHaveValue("");
  expect(screen.getByLabelText("New email address")).toHaveValue(
    "new@example.test",
  );
  expect(passwordInput).toHaveValue("SeparatePassword2026!");
  expect(screen.getByLabelText("New password")).toHaveValue(
    "AnotherPassword2026!",
  );
  expect(change).not.toHaveBeenCalled();
  cache.clear();
});
test("failed email requests retain drafts and can be retried", async (): Promise<void> => {
  const send = vi
    .spyOn(api, "requestEmailChange")
    .mockRejectedValueOnce(new Error("Delivery failed"))
    .mockResolvedValueOnce({ status: "verification_sent", message: "Sent" });
  const cache = mount();
  const input = await emailDraft();
  await userEvent.click(
    screen.getByRole("button", { name: "Send email confirmation" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Delivery failed");
  expect(input).toHaveValue("CurrentPassword2026!");
  await userEvent.click(
    screen.getByRole("button", { name: "Send email confirmation" }),
  );
  await waitFor((): void => expect(send).toHaveBeenCalledTimes(2));
  expect(await screen.findByText("Sent")).toBeVisible();
  cache.clear();
});
test("pending email requests reject duplicate form submissions", async (): Promise<void> => {
  let finish: ((value: EmailChangeResult) => void) | undefined;
  const send = vi.spyOn(api, "requestEmailChange").mockImplementation(
    (): Promise<EmailChangeResult> =>
      new Promise((resolve: (value: EmailChangeResult) => void): void => {
        finish = resolve;
      }),
  );
  const cache = mount();
  await emailDraft();
  const form = screen
    .getByRole("button", { name: "Send email confirmation" })
    .closest("form");
  if (!form) throw new Error("Missing form");
  fireEvent.submit(form);
  fireEvent.submit(form);
  await waitFor((): void => expect(send).toHaveBeenCalledTimes(1));
  expect(
    screen.getByRole("button", { name: "Send email confirmation" }),
  ).toBeDisabled();
  finish?.({ status: "verification_sent", message: "Sent" });
  await screen.findByText("Sent");
  cache.clear();
});
test("changing identity discards sensitive drafts", async (): Promise<void> => {
  const cache = new QueryClient();
  const close = (): void => {};
  const view = render(
    <QueryClientProvider client={cache}>
      <ProfileSettings session={session} onClose={close} />
    </QueryClientProvider>,
  );
  await emailDraft();
  const next: Session = {
    ...session,
    user: session.user
      ? { ...session.user, id: "two", email: "two@example.test" }
      : null,
  };
  view.rerender(
    <QueryClientProvider client={cache}>
      <ProfileSettings session={next} onClose={close} />
    </QueryClientProvider>,
  );
  expect(screen.getAllByLabelText("Current password")[0]).toHaveValue("");
  expect(screen.getByText("two@example.test")).toBeVisible();
  cache.clear();
});

test("closing and reopening settings discards sensitive drafts", async (): Promise<void> => {
  const cache = new QueryClient();
  const view = render(
    <QueryClientProvider client={cache}>
      <ProfileSettings session={session} onClose={(): void => {}} />
    </QueryClientProvider>,
  );
  await emailDraft();
  view.rerender(
    <QueryClientProvider client={cache}>
      <span>Closed</span>
    </QueryClientProvider>,
  );
  view.rerender(
    <QueryClientProvider client={cache}>
      <ProfileSettings session={session} onClose={(): void => {}} />
    </QueryClientProvider>,
  );
  expect(screen.getAllByLabelText("Current password")[0]).toHaveValue("");
  expect(screen.getByLabelText("New email address")).toHaveValue("");
  cache.clear();
});
