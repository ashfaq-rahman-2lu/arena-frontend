import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api, type Session } from "../../shared/api/arena-api";
import { Nav } from "../../shared/ui/primitives";
const session: Session = {
  csrf: "csrf",
  googleEnabled: true,
  user: {
    id: "viewer",
    name: "Alex Arena",
    email: "alex@example.test",
    hasPassword: true,
    googleLinked: false,
  },
};
function mount(path: string = "/dashboard"): QueryClient {
  vi.spyOn(api, "session").mockResolvedValue(session);
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  cache.setQueryData(["session"], session);
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[path]}>
        <Nav />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}
test("the top navigation account menu contains profile and sign out and restores focus", async (): Promise<void> => {
  const cache = mount();
  const trigger = screen.getByRole("button", {
    name: "Account menu for Alex Arena",
  });
  expect(trigger.closest("header")).not.toBeNull();
  expect(
    screen.queryByRole("button", { name: "Profile settings" }),
  ).not.toBeInTheDocument();
  await userEvent.click(trigger);
  const menu = screen.getByRole("group", { name: "Account menu" });
  expect(within(menu).getByRole("link", { name: "My arena" })).toHaveAttribute(
    "href",
    "/dashboard",
  );
  expect(within(menu).getByRole("button", { name: "Sign out" })).toBeVisible();
  await userEvent.click(
    within(menu).getByRole("button", { name: "Profile settings" }),
  );
  expect(
    await screen.findByRole("dialog", { name: "Profile settings" }),
  ).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  await userEvent.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute("aria-expanded", "false");
  cache.clear();
});
test("sign out keeps failure feedback, blocks duplicates and clears private data after success", async (): Promise<void> => {
  const signedOut: Session = { ...session, user: null };
  const logout = vi
    .spyOn(api, "logout")
    .mockRejectedValueOnce(new Error("Please retry sign out"))
    .mockResolvedValueOnce(signedOut);
  const cache = mount();
  cache.setQueryData(["private", "viewer", "following", 1], {
    items: [{ publicId: "PRIVATE" }],
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Account menu for Alex Arena" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Please retry sign out",
  );
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await waitFor((): void =>
    expect(cache.getQueryData(["session"])).toEqual(signedOut),
  );
  expect(
    cache.getQueryData(["private", "viewer", "following", 1]),
  ).toBeUndefined();
  expect(logout).toHaveBeenCalledTimes(2);
  cache.clear();
});
test("OAuth return destinations still open profile settings automatically", async (): Promise<void> => {
  const cache = mount("/dashboard?settings=1&google=linked");
  expect(
    await screen.findByRole("dialog", { name: "Profile settings" }),
  ).toBeVisible();
  cache.clear();
});

test("pending sign out prevents duplicate requests", async (): Promise<void> => {
  let finish: ((value: Session) => void) | undefined;
  const logout = vi.spyOn(api, "logout").mockImplementation(
    (): Promise<Session> =>
      new Promise((resolve: (value: Session) => void): void => {
        finish = resolve;
      }),
  );
  const cache = mount();
  await userEvent.click(
    screen.getByRole("button", { name: "Account menu for Alex Arena" }),
  );
  const button = screen.getByRole("button", { name: "Sign out" });
  fireEvent.click(button);
  fireEvent.click(button);
  await waitFor((): void => expect(logout).toHaveBeenCalledTimes(1));
  expect(button).toBeDisabled();
  finish?.({ ...session, user: null });
  await waitFor((): void =>
    expect(cache.getQueryData(["session"])).toEqual({ ...session, user: null }),
  );
  cache.clear();
});
