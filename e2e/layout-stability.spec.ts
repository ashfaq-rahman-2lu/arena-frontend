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
  await team.click();
  await page.getByRole("option", { name: "Alpha" }).click();
  await expect(page.getByText("1 of 1 matches played")).toBeVisible();
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
  await team.click();
  await page.getByRole("option", { name: "All teams" }).click();
  await expect(page.getByText("1 of 1 matches played")).not.toBeVisible();
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

test("autocomplete supports keyboard, touch, history, and an accessible open menu", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await publicFixtures(page);
  const team = page.getByRole("combobox", { name: "Filter by team" });
  await team.fill("eT");
  await expect(page.getByRole("option", { name: "Beta" })).toBeVisible();
  await expect(page).not.toHaveURL(/team=/);
  await team.press("ArrowDown");
  await team.press("Enter");
  await expect(team).toHaveValue("Beta");
  await expect(team).toBeFocused();
  await expect(page).toHaveURL(/team=away/);
  await team.click();
  if (info.project.name === "mobile")
    await page.getByRole("option", { name: "Alpha" }).tap();
  else await page.getByRole("option", { name: "Alpha" }).click();
  await expect(team).toHaveValue("Alpha");
  await page.goBack();
  await expect(team).toHaveValue("Beta");
  await page.goForward();
  await expect(team).toHaveValue("Alpha");
  await team.click();
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const accessibility = await new AxeBuilder({ page })
    .include(".fixtures-section")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("autocomplete-open.png") });
  await team.fill("not a team");
  await expect(page.getByText("No teams found")).toBeVisible();
  await team.press("Escape");
  await expect(team).toHaveValue("Alpha");
  await page
    .getByRole("combobox", { name: "Filter fixture status" })
    .selectOption("PENDING");
  await expect(page.getByText("No matches match these filters")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Filter by round" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(team).toHaveValue("All teams");
  await expect(page).not.toHaveURL(/team=|status=|stage=|round=/);
});

test("World Cup filters handle long names, many options, and zoom without overflow", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  const name =
    "Abdullah Muhammed and the exceptionally long tournament team name";
  await page.route("**/api/v1/**", async (route: Route): Promise<void> => {
    await route.fulfill({
      json: route.request().url().includes("/auth/session")
        ? { csrf: "fake", googleEnabled: false, user: null }
        : {
            ...tournament,
            format: "WORLD_CUP",
            currentStage: "GROUP",
            groups: [{ id: "g", name: "Group A", qualifierCount: 1 }],
            matches: [
              { ...tournament.matches[0], stage: "GROUP", scope: "g" },
              {
                ...tournament.matches[0],
                id: "second",
                stage: "GROUP",
                scope: "g",
                round: 2,
                homeScore: null,
                awayScore: null,
              },
            ],
            entrants: [
              { ...tournament.entrants[0], name },
              tournament.entrants[1],
              ...Array.from(
                { length: 30 },
                (
                  _value: unknown,
                  index: number,
                ): (typeof tournament.entrants)[number] => ({
                  id: `team-${index}`,
                  name: `Additional team ${index}`,
                  aliases: [],
                  groupId: null,
                }),
              ),
            ],
          },
    });
  });
  await page.goto(
    `/t/${tournament.publicId}?tab=fixtures&team=home&stage=GROUP&round=GROUP:1&historyPage=3`,
  );
  const team = page.getByRole("combobox", { name: "Filter by team" });
  await expect(team).toHaveValue(name);
  await expect(
    page.getByRole("combobox", { name: "Filter stage" }),
  ).toBeVisible();
  await team.click();
  await expect(page.getByRole("option", { name, exact: true })).toBeVisible();
  await page
    .getByRole("option", { name: "Additional team 29", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("long-team-options.png") });
  await team.press("Escape");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/tab=fixtures&historyPage=3$/);
  await page.getByRole("button", { name: "Expand all" }).click();
  const expand = page.getByRole("button", { name: "Collapse all" });
  await expect(expand).toBeVisible();
  expect((await expand.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({
    path: info.outputPath("fixtures-expanded.png"),
    fullPage: true,
  });
  await page.evaluate((): void => {
    document.documentElement.style.zoom = "2";
  });
  // The responsive tournament navigation settles through ResizeObserver.
  await expect
    .poll(async (): Promise<boolean> =>
      page.evaluate(
        (): boolean =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: info.outputPath("fixtures-200-percent.png"),
    fullPage: true,
  });
});
