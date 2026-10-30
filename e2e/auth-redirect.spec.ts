import {
  expect,
  type Page,
  type Route,
  test,
  type TestInfo,
} from "@playwright/test";
import type {
  Session,
  TournamentPage,
  FollowingPage,
} from "../src/shared/api/arena-api";

interface BrowserFixture {
  page: Page;
}

const signedInSession: Session = {
  csrf: "test-csrf",
  googleEnabled: false,
  user: {
    id: "organizer",
    name: "Alex Arena",
    email: "alex@example.test",
    hasPassword: true,
    googleLinked: false,
  },
};
const tournaments: TournamentPage = {
  items: [],
  total: 0,
  page: 1,
  limit: 20,
  totals: { tournaments: 0, active: 0, draft: 0, completed: 0, entrants: 0 },
};
const following: FollowingPage = { items: [], total: 0, page: 1, limit: 20 };

async function mockSession(page: Page, session: Session): Promise<void> {
  await page.route("**/api/v1/**", async (route: Route): Promise<void> => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/session") await route.fulfill({ json: session });
    else if (path === "/api/v1/tournaments")
      await route.fulfill({ json: tournaments });
    else if (path === "/api/v1/following")
      await route.fulfill({ json: following });
    else await route.abort();
  });
}

test("an existing session redirects login to dashboard and replaces the history entry", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await mockSession(page, signedInSession);
  await page.goto("/");
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.goto("/auth/login");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Hey, Alex." })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("signed-in-dashboard.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goBack();
  await expect(page).toHaveURL("/");
  await page.goto("/auth/login");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("signed-out visitors can still use login with the keyboard", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await mockSession(page, { ...signedInSession, user: null });
  await page.goto("/auth/login");
  const email = page.getByLabel("Email address");
  await expect(email).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login$/);
  await email.focus();
  await page.keyboard.type("alex@example.test");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password", { exact: true })).toBeFocused();
  await page.screenshot({
    path: info.outputPath("signed-out-login.png"),
    fullPage: true,
  });
});

for (const mode of ["login", "register"]) {
  test(`${mode} reveals Google and email options together after a slow session check`, async ({
    page,
  }: BrowserFixture, info: TestInfo): Promise<void> => {
    let finishSession: (() => void) | undefined;
    const pending = new Promise<void>((resolve: () => void): void => {
      finishSession = resolve;
    });
    await page.route("**/api/v1/**", async (route: Route): Promise<void> => {
      if (new URL(route.request().url()).pathname !== "/api/v1/auth/session") {
        await route.abort();
        return;
      }
      await pending;
      await route.fulfill({
        json: { ...signedInSession, user: null, googleEnabled: true },
      });
    });
    await page.goto(`/auth/${mode}`);
    await expect(
      page.getByText("Loading your arena…", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveCount(0);
    finishSession?.();
    await expect(
      page.getByRole("link", { name: /Continue with Google/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await page.getByRole("link", { name: /Continue with Google/ }).focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByLabel(mode === "register" ? "Your name" : "Email address"),
    ).toBeFocused();
    await page.screenshot({
      path: info.outputPath(`${mode}-google-options.png`),
      fullPage: true,
    });
  });
}
