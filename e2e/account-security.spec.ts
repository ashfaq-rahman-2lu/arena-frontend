import {
  expect,
  type Page,
  type Route,
  test,
  type TestInfo,
} from "@playwright/test";
import {
  account,
  google,
  mailLink,
  signIn,
  openTournamentActions,
  openProfileSettings,
} from "./account-fixture";
import { response } from "./api-fixture";
import type { Session, FollowingPage } from "../src/shared/api/arena-api";
interface BrowserFixture {
  page: Page;
}

test("following pagination removes its last local page item and persists dashboard unfollow", async ({
  page,
}: BrowserFixture): Promise<void> => {
  const user = await account(page, "password", 21);
  await signIn(page, user);
  const following = page.locator(".following-section");
  await following.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    following.getByRole("button", { name: "Unfollow", exact: true }),
  ).toHaveCount(1);
  await following
    .getByRole("button", { name: "Unfollow", exact: true })
    .click();
  await expect(following.getByText(/Page 1 of 1/)).toBeVisible();
  await expect(
    following.getByRole("button", { name: "Unfollow", exact: true }),
  ).toHaveCount(20);
  await page.reload();
  await expect(
    following.getByRole("button", { name: "Unfollow", exact: true }),
  ).toHaveCount(20);
});

test("following status and mutation failures recover without assuming unfollowed state or duplicating pending requests", async ({
  page,
}: BrowserFixture): Promise<void> => {
  const user = await account(page);
  const publicId = user.tournaments[0]?.publicId;
  if (!publicId) throw new Error("Missing tournament");
  await signIn(page, user);
  await page.route(
    `**/api/v1/following/${publicId}`,
    async (route: Route): Promise<void> => {
      if (route.request().method() === "GET")
        await route.fulfill({
          status: 503,
          json: {
            code: "INTEGRATION_UNAVAILABLE",
            message: "Status unavailable",
            status: 503,
          },
        });
      else await route.continue();
    },
  );
  await page.goto(`/t/${publicId}`);
  await openTournamentActions(page);
  await expect(page.getByRole("alert")).toContainText("Status unavailable");
  await expect(
    page.getByRole("button", { name: "Follow tournament", exact: true }),
  ).toHaveCount(0);
  await page.unroute(`**/api/v1/following/${publicId}`);
  await page.reload();
  await openTournamentActions(page);
  let mutations = 0;
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve: () => void): void => {
    release = resolve;
  });
  await page.route(
    `**/api/v1/following/${publicId}`,
    async (route: Route): Promise<void> => {
      if (route.request().method() !== "PUT") {
        await route.continue();
        return;
      }
      mutations++;
      if (mutations === 1)
        await route.fulfill({
          status: 503,
          json: {
            code: "INTEGRATION_UNAVAILABLE",
            message: "Follow failed",
            status: 503,
          },
        });
      else {
        await pending;
        await route.continue();
      }
    },
  );
  await page
    .getByRole("button", { name: "Follow tournament", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Follow failed");
  await page
    .getByRole("button", { name: "Follow tournament", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Follow tournament", exact: true }),
  ).toBeDisabled();
  expect(mutations).toBe(2);
  release?.();
  await expect(
    page.getByRole("button", { name: "Unfollow tournament", exact: true }),
  ).toBeVisible();
});

test("Google login returns to its public tournament and requires an explicit follow", async ({
  page,
}: BrowserFixture): Promise<void> => {
  const user = await account(page, "google");
  const publicId = user.tournaments[0]?.publicId;
  await page.goto(`/t/${publicId}`);
  await openTournamentActions(page);
  await page.getByRole("link", { name: "Sign in to follow" }).click();
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await google(page, user.email);
  await expect(page).toHaveURL(new RegExp(`/t/${publicId}$`));
  await openTournamentActions(page);
  await expect(
    page.getByRole("button", { name: "Follow tournament", exact: true }),
  ).toBeVisible();
  const info = await response<Session>(
    await page.request.get("/api/v1/auth/session"),
    "SessionView",
  );
  expect(info.user?.id).toBe(user.userId);
  const list = await response<FollowingPage>(
    await page.request.get("/api/v1/following"),
    "FollowedTournamentPageView",
  );
  expect(list.total).toBe(0);
  await page
    .getByRole("button", { name: "Follow tournament", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unfollow tournament", exact: true }),
  ).toBeVisible();
});

for (const outcome of ["Approve", "Cancel", "Fail"] as const) {
  test(`Google linking ${outcome} preserves session and persistent settings feedback`, async ({
    page,
  }: BrowserFixture): Promise<void> => {
    const user = await account(page);
    await signIn(page, user);
    const original = await response<Session>(
      await page.request.get("/api/v1/auth/session"),
      "SessionView",
    );
    await openProfileSettings(page);
    await page.getByRole("link", { name: "Connect Google" }).click();
    await google(page, `alias-${user.email}`, outcome);
    const message =
      outcome === "Approve"
        ? "Google account connected."
        : outcome === "Cancel"
          ? "Google confirmation was cancelled."
          : "Google confirmation could not be completed. Start again.";
    await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
      message,
    );
    await page.reload();
    await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
      message,
    );
    const current = await response<Session>(
      await page.request.get("/api/v1/auth/session"),
      "SessionView",
    );
    expect(current.csrf).toBe(original.csrf);
    expect(current.user?.id).toBe(user.userId);
    expect(current.user?.googleLinked).toBe(outcome === "Approve");
  });
}

test("cancelled and failed Google login preserve the public return destination", async ({
  page,
}: BrowserFixture): Promise<void> => {
  const user = await account(page, "google");
  const destination = `/t/${user.tournaments[0]?.publicId}`;
  for (const outcome of ["Cancel", "Fail"] as const) {
    await page.goto(`/auth/login?returnTo=${encodeURIComponent(destination)}`);
    await page.getByRole("link", { name: "Continue with Google" }).click();
    await google(page, user.email, outcome);
    await expect(page).toHaveURL(/\/auth\/login\?error=google_/);
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(destination);
    await expect(page.getByRole("alert")).toBeVisible();
  }
});

test("password-confirmed email changes clear their password and require verification before revoking sessions", async ({
  page,
}: BrowserFixture): Promise<void> => {
  const user = await account(page);
  await signIn(page, user);
  await openProfileSettings(page);
  const dialog = page.getByRole("dialog");
  const target = `changed-${user.email}`;
  await dialog.getByLabel("New email address").fill(target);
  await dialog.getByLabel("Current password").first().fill(user.password);
  await dialog.getByRole("button", { name: "Send email confirmation" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Confirm the new email",
  );
  await expect(dialog.getByLabel("Current password").first()).toHaveValue("");
  const before = await response<Session>(
    await page.request.get("/api/v1/auth/session"),
    "SessionView",
  );
  expect(before.user?.email).toBe(user.email);
  await page.goto(await mailLink(page, target));
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page).toHaveURL(/notice=email_updated/);
  await expect(page.getByRole("status")).toContainText("Email updated");
  const after = await response<Session>(
    await page.request.get("/api/v1/auth/session"),
    "SessionView",
  );
  expect(after.user).toBeNull();
  await signIn(page, { ...user, email: target });
});

test("Google-only email changes confirm the linked identity and preserve its Google login", async ({
  page,
}: BrowserFixture): Promise<void> => {
  const user = await account(page, "google");
  await page.goto("/auth/login");
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await google(page, user.email);
  await openProfileSettings(page);
  const target = `changed-${user.email}`;
  await page.getByLabel("New email address").fill(target);
  await page
    .getByRole("button", { name: "Continue with Google to confirm" })
    .click();
  await google(page, user.email);
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "Check your email",
  );
  const before = await response<Session>(
    await page.request.get("/api/v1/auth/session"),
    "SessionView",
  );
  expect(before.user?.email).toBe(user.email);
  await page.goto(await mailLink(page, target));
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page).toHaveURL(/notice=email_updated/);
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await google(page, user.email);
  await expect(page).toHaveURL(/\/dashboard/);
  const after = await response<Session>(
    await page.request.get("/api/v1/auth/session"),
    "SessionView",
  );
  expect(after.user?.id).toBe(user.userId);
  expect(after.user?.email).toBe(target);
});

test("Google-only password setup validates confirmation and retains owned and followed tournaments", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  const user = await account(page, "google", 1);
  await page.goto("/auth/login");
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await google(page, user.email);
  await openProfileSettings(page);
  await page.getByRole("button", { name: "Set password by email" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toBeVisible();
  await page.goto(await mailLink(page, user.email));
  await page.getByLabel("Password", { exact: true }).fill(user.password);
  await page.getByLabel("Confirm new password").fill("MismatchPassword2026!");
  let resets = 0;
  page.on("request", (request: import("@playwright/test").Request): void => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/auth/reset-password")
    )
      resets++;
  });
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByRole("alert")).toContainText("Passwords do not match");
  expect(resets).toBe(0);
  await page.getByLabel("Confirm new password").fill(user.password);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page).toHaveURL(/notice=password_updated/);
  expect(resets).toBe(1);
  await signIn(page, user);
  const current = await response<Session>(
    await page.request.get("/api/v1/auth/session"),
    "SessionView",
  );
  expect(current.user?.id).toBe(user.userId);
  expect(current.user?.googleLinked).toBe(true);
  await expect(
    page
      .locator(".following-section")
      .getByRole("link", { name: /Isolated tournament/ }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("following-dashboard.png"),
    fullPage: true,
  });
});
