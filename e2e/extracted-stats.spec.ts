import AxeBuilder from "@axe-core/playwright";
import { expect, Page, Route, test, TestInfo } from "@playwright/test";
import { tournament } from "../src/test/fixtures";
import type { Suggestion } from "../src/shared/api/arena-api";

interface BrowserFixture {
  page: Page;
}
const labels = [
  "Possession",
  "Shots",
  "Shots on Target",
  "Fouls",
  "Offsides",
  "Corner Kicks",
  "Free Kicks",
  "Passes",
  "Successful Passes",
  "Crosses",
  "Interceptions",
  "Tackles",
  "Saves",
];
const keys: NonNullable<Suggestion["stats"]>[number]["key"][] = [
  "possession",
  "shots",
  "shotsOnTarget",
  "fouls",
  "offsides",
  "cornerKicks",
  "freeKicks",
  "passes",
  "successfulPasses",
  "crosses",
  "interceptions",
  "tackles",
  "saves",
];
const home = [55, 5, 5, 1, 1, 1, 1, 115, 79, 4, 19, 5, 4];
const away = [45, 11, 9, 1, 0, 2, 1, 79, 57, 3, 27, 8, 2];

test("reviews all extracted match stats on desktop and mobile", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await page.route("**/api/v1/**", async (route: Route): Promise<void> => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown;
    if (path.endsWith("/auth/session"))
      body = {
        csrf: "test",
        googleEnabled: false,
        user: {
          id: "test",
          name: "Test admin",
          email: "test@example.test",
          hasPassword: true,
          googleLinked: false,
        },
      };
    else if (path.endsWith("/extract-score"))
      body = {
        matched: true,
        homeScore: 1,
        awayScore: 2,
        homeTiebreak: null,
        awayTiebreak: null,
        observedSides: [
          { name: null, score: 1, tiebreak: null },
          { name: null, score: 2, tiebreak: null },
        ],
        warnings: [],
        stats: keys.map(
          (
            key: NonNullable<Suggestion["stats"]>[number]["key"],
            index: number,
          ): NonNullable<Suggestion["stats"]>[number] => ({
            key,
            label: labels[index],
            home: home[index],
            away: away[index],
            unit: index === 0 ? "percent" : "count",
          }),
        ),
      };
    else if (path.endsWith("/tournaments/tournament-id"))
      body = { ...tournament, statsEnabled: true };
    else throw new Error(`Unexpected API request: ${path}`);
    await route.fulfill({ json: body });
  });
  await page.goto("/manage/tournament-id?tab=fixtures");
  await page
    .getByRole("button", { name: /Edit result: Alpha vs Beta/ })
    .click();
  await page
    .getByLabel("Scorecard image")
    .setInputFiles("e2e/fixtures/scorecard.png");
  await page
    .getByRole("button", { name: "Read scorecard", exact: true })
    .click();
  await expect(page.getByText(/Suggested scores filled/)).toHaveCount(0);
  await expect(
    page.getByRole("table", { name: "Extracted match stats" }),
  ).toHaveCount(0);
  await expect(page.getByText(/Stats are shown for review only/)).toHaveCount(
    0,
  );
  for (const [index, label] of labels.entries()) {
    await expect(
      page.getByRole("spinbutton", {
        name: new RegExp(`^Alpha ${label}$`, "i"),
      }),
    ).toHaveValue(String(home[index]));
    await expect(
      page.getByRole("spinbutton", {
        name: new RegExp(`^Beta ${label}$`, "i"),
      }),
    ).toHaveValue(String(away[index]));
  }
  const swap = page.getByRole("button", { name: "Swap results", exact: true });
  await swap.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("spinbutton", { name: "Alpha score" }),
  ).toHaveValue("2");
  await expect(
    page.getByRole("spinbutton", { name: "Beta score" }),
  ).toHaveValue("1");
  await expect(
    page.getByRole("spinbutton", { name: "Alpha Possession" }),
  ).toHaveValue("45");
  await expect(
    page.getByRole("spinbutton", { name: "Beta Possession" }),
  ).toHaveValue("55");
  await expect(swap).toBeFocused();
  await swap.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `/tmp/tournament-swap/${info.project.name}-controls.png`,
  });
  await page
    .getByRole("spinbutton", { name: "Alpha Possession" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `/tmp/tournament-swap/${info.project.name}-stats.png`,
  });
  const overflow = await page.evaluate(
    (): boolean => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  const results = await new AxeBuilder({ page })
    .include("dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await swap.click();
  await expect(
    page.getByRole("spinbutton", { name: "Alpha Possession" }),
  ).toHaveValue("55");
  await expect(
    page.getByRole("spinbutton", { name: "Beta Possession" }),
  ).toHaveValue("45");
  await expect(
    page.getByRole("spinbutton", { name: "Alpha score" }),
  ).toHaveValue("1");
});

test("CODM result editing keeps manual scores and hides scorecard upload", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await page.route("**/api/v1/**", async (route: Route): Promise<void> => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/session")) {
      await route.fulfill({
        json: {
          csrf: "test",
          googleEnabled: false,
          user: {
            id: "test",
            name: "Test admin",
            email: "test@example.test",
            hasPassword: true,
            googleLinked: false,
          },
        },
      });
    } else if (path.endsWith("/tournaments/tournament-id")) {
      await route.fulfill({ json: { ...tournament, game: "CODM" } });
    } else throw new Error(`Unexpected API request: ${path}`);
  });
  await page.goto("/manage/tournament-id?tab=fixtures");
  await page
    .getByRole("button", { name: /Edit result: Alpha vs Beta/ })
    .click();
  await expect(page.getByLabel("Scorecard image")).toHaveCount(0);
  await expect(page.getByText("Have a scorecard?")).toHaveCount(0);
  const homeScore = page.getByRole("spinbutton", { name: "Alpha score" });
  await homeScore.fill("9");
  await expect(homeScore).toHaveValue("9");
  await expect(
    page.getByRole("button", { name: "Save result", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Swap results", exact: true }).click();
  await expect(homeScore).toHaveValue("0");
  await expect(
    page.getByRole("spinbutton", { name: "Beta score" }),
  ).toHaveValue("9");
  await page.screenshot({
    path: `/tmp/tournament-swap/${info.project.name}-codm.png`,
  });
  const results = await new AxeBuilder({ page })
    .include("dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
