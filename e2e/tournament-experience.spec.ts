import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import { tournament, match } from "../src/test/fixtures";
import type { Tournament } from "../src/shared/api/arena-api";

interface BrowserFixture {
  page: Page;
}
interface FixtureControl {
  failRefresh: boolean;
}
async function mockCompetition(
  page: Page,
  admin: boolean = false,
  value: Tournament = tournament,
): Promise<FixtureControl> {
  const control: FixtureControl = { failRefresh: false };
  await page.route("**/api/v1/**", async (route: Route): Promise<void> => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/session")) {
      await route.fulfill({
        json: {
          csrf: "csrf",
          googleEnabled: false,
          user: admin
            ? {
                id: "owner",
                name: "Admin",
                email: "admin@example.test",
                hasPassword: true,
                googleLinked: false,
              }
            : null,
        },
      });
    } else if (path.endsWith("/MISSING99") || control.failRefresh) {
      await route.fulfill({
        status: 404,
        json: {
          status: 404,
          code: "NOT_FOUND",
          message: "No tournament found with that ID",
        },
      });
    } else {
      await route.fulfill({ json: value });
    }
  });
  return control;
}

test("spectators recover an unknown ID with a full link and follow a team's fixtures", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await mockCompetition(page);
  await page.goto("/t/MISSING99");
  const input = page.getByRole("textbox", { name: "Tournament ID or link" });
  await expect(input).toHaveValue("MISSING99");
  await input.fill("https://arena.example/t/arena2026?tab=standings");
  await page.getByRole("button", { name: "Find tournament" }).click();
  await expect(page).toHaveURL(/\/t\/ARENA2026$/);
  await expect(page.getByRole("status")).toContainText("Every 1 min");
  await page.getByRole("tab", { name: "Teams", exact: true }).click();
  await page.getByRole("link", { name: "View fixtures for Alpha" }).click();
  await expect(
    page.getByRole("combobox", { name: "Filter by team" }),
  ).toHaveValue("Alpha");
  await expect(
    page.getByText("1 of 1 matches played", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Tournament:.*matches played/)).toHaveCount(0);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-public-experience.png`,
  });
});

test("lookup rejects malformed links inline and supports keyboard correction", async ({
  page,
}: BrowserFixture): Promise<void> => {
  await mockCompetition(page);
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "Tournament ID or link" });
  await input.fill("https://arena.example/manage/ARENA2026");
  await input.press("Enter");
  await expect(page.getByRole("alert")).toContainText(
    "8–10 letters or numbers",
  );
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.fill("arena2026");
  await input.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Test league" }),
  ).toBeVisible();
});

test("failed public refresh preserves the competition and can recover", async ({
  page,
}: BrowserFixture): Promise<void> => {
  const control = await mockCompetition(page);
  await page.goto("/t/ARENA2026");
  await expect(
    page.getByRole("heading", { name: "Test league" }),
  ).toBeVisible();
  control.failRefresh = true;
  await page.getByRole("button", { name: "Refresh now" }).click();
  await expect(page.getByRole("status")).toContainText("Couldn’t refresh");
  await expect(
    page.getByRole("heading", { name: "Test league" }),
  ).toBeVisible();
  control.failRefresh = false;
  await page.getByRole("button", { name: "Refresh now" }).click();
  await expect(page.getByRole("status")).not.toContainText("Couldn’t refresh");
});

test("admin knockout guidance leads to unfinished groups and quick score entry", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await mockCompetition(page, true, {
    ...tournament,
    format: "WORLD_CUP",
    currentStage: "GROUP",
    statsEnabled: true,
    groups: [{ id: "g", name: "Group A", qualifierCount: 1 }],
    matches: [
      {
        ...match,
        scope: "g",
        stage: "GROUP",
        homeScore: null,
        awayScore: null,
      },
    ],
  });
  await page.goto("/manage/tournament-id?tab=knockout");
  await expect(page.getByText("Group A: 1 match remaining")).toBeVisible();
  await page.getByRole("button", { name: "Finish group matches" }).click();
  await expect(
    page.getByRole("combobox", { name: "Filter stage" }),
  ).toHaveValue("GROUP");
  await page
    .getByRole("button", { name: "Add result: Alpha vs Beta, round 1" })
    .click();
  const toggle = page.getByRole("button", {
    name: "Add match statistics (optional)",
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Alpha Shots", { exact: true })).toBeHidden();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Alpha Shots", { exact: true }).fill("0");
  await toggle.click();
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-quick-score.png`,
  });
  await toggle.click();
  await expect(page.getByLabel("Alpha Shots", { exact: true })).toHaveValue(
    "0",
  );
  expect(
    await page.evaluate(
      (): boolean => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("public refresh status fits at most two lines with an icon-only keyboard action", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  if (info.project.name === "mobile")
    await page.setViewportSize({ width: 320, height: 812 });
  await mockCompetition(page);
  await page.goto("/t/ARENA2026");
  const status = page.getByRole("status").filter({ hasText: "Every 1 min" });
  await expect(status).toContainText("Every 1 min");
  await expect(status.locator("time")).toHaveText(
    /^\d{1,2}:\d{2}(?:\s?[AP]M)?$/,
  );
  const button = page.getByRole("button", { name: "Refresh now" });
  await expect(button).toHaveText("");
  const compact = await status.evaluate((element: HTMLElement): boolean => {
    const row = element.parentElement;
    if (!row) return false;
    const lineHeight = Number.parseFloat(getComputedStyle(element).lineHeight);
    return (
      row.getBoundingClientRect().height <= Math.max(28, 2 * lineHeight) + 1 &&
      row.getBoundingClientRect().height <= 32
    );
  });
  expect(compact).toBe(true);
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(button).toBeEnabled();
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-compact-refresh.png`,
  });
});
