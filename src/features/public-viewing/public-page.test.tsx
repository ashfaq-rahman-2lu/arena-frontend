import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { api, type Session } from "../../shared/api/arena-api";
import { tournament } from "../../test/fixtures";
import { PublicPage } from "./public-page";
function mount(signedIn: boolean): QueryClient {
  vi.spyOn(api, "public").mockResolvedValue(tournament);
  const session: Session = {
    csrf: "csrf",
    googleEnabled: true,
    user: signedIn
      ? {
          id: "viewer",
          name: "Viewer",
          email: "viewer@example.test",
          hasPassword: true,
          googleLinked: false,
        }
      : null,
  };
  vi.spyOn(api, "session").mockResolvedValue(session);
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  cache.setQueryData(["session"], session);
  render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[`/t/${tournament.publicId}`]}>
        <Routes>
          <Route path="/t/:publicId" element={<PublicPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return cache;
}
test("follow and unfollow appear only inside the public tournament actions menu", async (): Promise<void> => {
  let following = false;
  vi.spyOn(api, "isFollowing").mockImplementation(
    async (): Promise<boolean> => following,
  );
  const follow = vi
    .spyOn(api, "follow")
    .mockImplementation(async (): Promise<void> => {
      following = true;
    });
  const unfollow = vi
    .spyOn(api, "unfollow")
    .mockImplementation(async (): Promise<void> => {
      following = false;
    });
  const cache = mount(true);
  await screen.findByRole("heading", { name: tournament.name });
  expect(
    screen.queryByRole("button", { name: "Follow tournament" }),
  ).not.toBeInTheDocument();
  const trigger = screen.getByRole("button", {
    name: "Tournament actions",
  });
  await userEvent.click(trigger);
  const menu = screen.getByRole("group", { name: "Tournament actions" });
  await userEvent.click(
    await within(menu).findByRole("button", {
      name: "Follow tournament",
    }),
  );
  await userEvent.click(
    await within(menu).findByRole("button", {
      name: "Unfollow tournament",
    }),
  );
  expect(
    await within(menu).findByRole("button", {
      name: "Follow tournament",
    }),
  ).toBeEnabled();
  expect(follow).toHaveBeenCalledTimes(1);
  expect(unfollow).toHaveBeenCalledTimes(1);
  await userEvent.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
  expect(
    screen.queryByRole("group", { name: "Tournament actions" }),
  ).not.toBeInTheDocument();
  cache.clear();
});
test("signed-out viewers find the sign-in link in the tournament actions menu", async (): Promise<void> => {
  const cache = mount(false);
  await screen.findByRole("heading", { name: tournament.name });
  expect(
    screen.queryByRole("link", { name: "Sign in to follow" }),
  ).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Tournament actions" }),
  );
  expect(
    within(screen.getByRole("group", { name: "Tournament actions" })).getByRole(
      "link",
      { name: "Sign in to follow" },
    ),
  ).toHaveAttribute(
    "href",
    `/auth/login?returnTo=${encodeURIComponent(`/t/${tournament.publicId}`)}`,
  );
  cache.clear();
});
test("following errors remain actionable inside the public actions menu", async (): Promise<void> => {
  vi.spyOn(api, "isFollowing").mockRejectedValue(
    new Error("Could not load following"),
  );
  const cache = mount(true);
  await screen.findByRole("heading", { name: tournament.name });
  await userEvent.click(
    screen.getByRole("button", { name: "Tournament actions" }),
  );
  expect(
    await within(
      screen.getByRole("group", { name: "Tournament actions" }),
    ).findByRole("alert"),
  ).toHaveTextContent("Could not load following");
  expect(
    screen.queryByRole("button", { name: "Follow tournament" }),
  ).not.toBeInTheDocument();
  cache.clear();
});
