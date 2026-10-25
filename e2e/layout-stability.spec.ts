import {
  expect,
  type Page,
  type Route,
  test,
  type TestInfo,
} from "@playwright/test";
import { tournament } from "../src/test/fixtures";
interface BrowserFixture {
  page: Page;
}
async function publicFixtures(page: Page): Promise<void> {
  await page.route("**/api/v1/**", async (route: Route): Promise<void> => {
    const url = route.request().url();
    await route.fulfill({
      json: url.includes("/auth/session")
        ? {
            csrf: "fake-csrf",
            googleEnabled: false,
            user: {
              id: "viewer",
              name: "Alex Rahman",
              email: "alex.rahman@example.test",
              hasPassword: true,
              googleLinked: false,
            },
          }
        : url.includes("/following/")
          ? { following: false }
          : tournament,
    });
  });
  await page.goto(`/t/${tournament.publicId}?tab=fixtures`);
  await expect(
    page.getByRole("combobox", { name: "Filter by team" }),
  ).toBeVisible();
}
test("account menu is compact and matches the tournament actions density", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await publicFixtures(page);
  await page
    .getByRole("button", { name: "Account menu for Alex Rahman" })
    .click();
  const menu = page.getByRole("group", { name: "Account menu" });
  await expect(menu).toBeVisible();
  const box = await menu.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(240);
  await expect(
    menu.getByRole("button", { name: "Profile settings" }),
  ).toBeVisible();
  await expect(
    menu.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("compact-account-menu.png"),
    fullPage: false,
  });
});
test("team and status dropdowns keep their position when a team is selected and cleared", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await publicFixtures(page);
  const team = page.getByRole("combobox", { name: "Filter by team" });
  const status = page.getByRole("combobox", { name: "Filter fixture status" });
  const beforeTeam = await team.boundingBox();
  const beforeStatus = await status.boundingBox();
  if (!beforeTeam || !beforeStatus) throw new Error("Missing filter bounds");
  await team.selectOption("home");
  await expect(page.getByText("Alpha: 1/1 matches played")).toBeVisible();
  const afterTeam = await team.boundingBox();
  const afterStatus = await status.boundingBox();
  if (!afterTeam || !afterStatus)
    throw new Error("Missing selected filter bounds");
  expect(afterTeam.x).toBeCloseTo(beforeTeam.x, 0);
  expect(afterTeam.y).toBeCloseTo(beforeTeam.y, 0);
  expect(afterStatus.x).toBeCloseTo(beforeStatus.x, 0);
  expect(afterStatus.y).toBeCloseTo(beforeStatus.y, 0);
  await page.screenshot({
    path: info.outputPath("selected-team-filters.png"),
    fullPage: false,
  });
  await team.selectOption("");
  await expect(page.getByText("Alpha: 1/1 matches played")).not.toBeVisible();
  const cleared = await team.boundingBox();
  expect(cleared?.x).toBeCloseTo(beforeTeam.x, 0);
  expect(cleared?.y).toBeCloseTo(beforeTeam.y, 0);
  expect(
    await page.evaluate(
      (): boolean =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
