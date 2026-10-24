import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import type { Match, Tournament } from "../src/shared/api/arena-api";
import { match, tournament } from "../src/test/fixtures";
interface BrowserFixture {
  page: Page;
}
interface CompactOptions {
  publicView?: boolean;
  allUnplayed?: boolean;
  longName?: boolean;
}
interface SavedPayload {
  homeScore: number;
  awayScore: number;
  expectedRevision: number;
  expectedTournamentRevision: number;
}
function savedPayload(value: unknown): SavedPayload {
  if (
    !value ||
    typeof value !== "object" ||
    !("homeScore" in value) ||
    typeof value.homeScore !== "number" ||
    !("awayScore" in value) ||
    typeof value.awayScore !== "number" ||
    !("expectedRevision" in value) ||
    typeof value.expectedRevision !== "number" ||
    !("expectedTournamentRevision" in value) ||
    typeof value.expectedTournamentRevision !== "number"
  )
    throw new Error("Invalid test result payload");
  return {
    homeScore: value.homeScore,
    awayScore: value.awayScore,
    expectedRevision: value.expectedRevision,
    expectedTournamentRevision: value.expectedTournamentRevision,
  };
}
async function load(
  page: Page,
  {
    publicView = false,
    allUnplayed = false,
    longName = false,
  }: CompactOptions = {},
): Promise<void> {
  const first: Match = {
    ...match,
    stage: "GROUP",
    scope: "g",
    homeScore: allUnplayed ? null : 2,
    awayScore: allUnplayed ? null : 0,
  };
  let current: Tournament = {
    ...tournament,
    name: longName
      ? "Championship for teams with exceptionally long tournament names"
      : "Compact cup",
    format: "WORLD_CUP",
    currentStage: "GROUP",
    groups: [
      {
        id: "g",
        name: longName
          ? "Group A with an exceptionally long descriptive group name"
          : "Group A",
        qualifierCount: 1,
      },
    ],
    entrants: [
      ...tournament.entrants,
      { id: "third", name: "Gamma", groupId: "g", aliases: [] },
    ],
    matches: [
      first,
      {
        ...first,
        id: "reverse",
        homeId: "away",
        awayId: "home",
        homeScore: null,
        awayScore: null,
        revision: 4,
        round: 2,
        leg: 2,
      },
      {
        ...first,
        id: "unrelated",
        homeId: "away",
        awayId: "third",
        homeScore: null,
        awayScore: null,
        round: 3,
      },
    ],
    standings: [
      {
        scope: "g",
        rows: tournament.entrants.map(
          (
            entrant: (typeof tournament.entrants)[number],
            index: number,
          ): Tournament["standings"][number]["rows"][number] => ({
            entrantId: entrant.id,
            name: entrant.name,
            rank: index + 1,
            played: 1,
            won: index === 0 ? 1 : 0,
            drawn: 0,
            lost: index === 0 ? 0 : 1,
            scoreFor: index === 0 ? 2 : 0,
            scoreAgainst: index === 0 ? 0 : 2,
            difference: index === 0 ? 2 : -2,
            points: index === 0 ? 3 : 0,
            tieSignature: null,
            tieResolved: false,
          }),
        ),
      },
    ],
  };
  await page.route("**/api/v1/**", async (route: Route): Promise<void> => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/session")) {
      await route.fulfill({
        json: {
          csrf: "csrf",
          googleEnabled: false,
          user: publicView
            ? null
            : {
                id: "owner",
                name: "Admin",
                email: "admin@example.test",
                hasPassword: true,
                googleLinked: false,
              },
        },
      });
      return;
    }
    if (path.endsWith("/impact")) {
      await route.fulfill({
        json: {
          requiresReset: false,
          reason: null,
          roundIds: [],
          matchIds: [],
          resetQualification: false,
          impactToken: "impact",
          tournamentRevision: current.revision,
        },
      });
      return;
    }
    if (route.request().method() === "PATCH" && path.endsWith("/result")) {
      const id = path.split("/").at(-2);
      const original = current.matches.find(
        (entry: Match): boolean => entry.id === id,
      );
      if (!original) throw new Error("Unknown test fixture");
      const raw: unknown = route.request().postDataJSON();
      const payload = savedPayload(raw);
      expect(payload.expectedRevision).toBe(original.revision);
      expect(payload.expectedTournamentRevision).toBe(current.revision);
      current = {
        ...current,
        revision: current.revision + 1,
        matches: current.matches.map((entry: Match): Match =>
          entry.id === id
            ? {
                ...entry,
                homeScore: payload.homeScore,
                awayScore: payload.awayScore,
                revision: entry.revision + 1,
              }
            : entry,
        ),
      };
    }
    await route.fulfill({ json: current });
  });
  await page.goto(publicView ? "/t/ARENA2026" : "/manage/tournament-id");
}
async function choosePair(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Enter result", exact: true }).click();
  await page.getByLabel("Home team", { exact: true }).selectOption("home");
  await page.getByLabel("Away team", { exact: true }).selectOption("away");
}
test("standings and first row fit the first viewport with inline title controls", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await page.setViewportSize({
    width: info.project.name === "mobile" ? 375 : 1440,
    height: info.project.name === "mobile" ? 812 : 900,
  });
  await load(page);
  await expect(
    page.getByRole("tab", { name: "Standings", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByText("1/3 matches (33%)", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "My tournaments" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("tab").first()).toHaveText("Standings");
  await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);
  const row = page
    .getByRole("table", { name: "Group A standings" })
    .getByRole("row")
    .nth(1);
  await expect(row).toBeInViewport({ ratio: 1 });
  const heading = await page
    .getByRole("heading", { name: "Compact cup", exact: true })
    .boundingBox();
  const enter = await page
    .getByRole("button", { name: "Enter result", exact: true })
    .boundingBox();
  if (!heading || !enter) throw new Error("Missing title controls");
  expect(
    Math.abs(heading.y + heading.height / 2 - enter.y - enter.height / 2),
  ).toBeLessThan(3);
  expect(enter.width).toBeGreaterThanOrEqual(44);
  expect(enter.height).toBeGreaterThanOrEqual(44);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-standings-first.png`,
  });
});
test("information, tooltip, long names and text zoom stay accessible", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await load(page, { longName: true });
  const plus = page.getByRole("button", { name: "Enter result", exact: true });
  await plus.hover();
  await expect(
    page.getByRole("tooltip", { name: "Enter result" }),
  ).toBeVisible();
  await plus.focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.getByRole("button", { name: "Tournament information" }).click();
  const information = page.getByRole("dialog", {
    name: "Tournament information",
  });
  await expect(
    information.getByText(
      "Championship for teams with exceptionally long tournament names",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    information.getByText("eFootball", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Tournament information" }),
  ).toBeFocused();
  await page.evaluate((): void => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      (): boolean => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Tournament information" }).hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  const tooltipBounds = await page.getByRole("tooltip").boundingBox();
  const viewport = page.viewportSize();
  if (!tooltipBounds || !viewport)
    throw new Error("Tooltip and viewport must be measurable");
  expect(tooltipBounds.x).toBeGreaterThanOrEqual(0);
  expect(tooltipBounds.x + tooltipBounds.width).toBeLessThanOrEqual(
    viewport.width,
  );
  await page.keyboard.press("Escape");
  const badge = page.getByRole("button", {
    name: /Qualification places for Group A/,
  });
  await badge.scrollIntoViewIfNeeded();
  await badge.focus();
  await expect(page.getByRole("tooltip")).toContainText("provisional");
  const badgeTooltip = await page.getByRole("tooltip").boundingBox();
  if (!badgeTooltip) throw new Error("Qualification tooltip must be visible");
  expect(badgeTooltip.y).toBeGreaterThanOrEqual(0);
  expect(badgeTooltip.y + badgeTooltip.height).toBeLessThanOrEqual(
    viewport.height,
  );
  expect(badgeTooltip.x).toBeGreaterThanOrEqual(0);
  expect(badgeTooltip.x + badgeTooltip.width).toBeLessThanOrEqual(
    viewport.width,
  );
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-standings-header-zoom.png`,
  });
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-compact-zoom.png`,
  });
});
test("team picker includes reverse and saved fixtures and returns after cancellation", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await load(page);
  await choosePair(page);
  const picker = page.getByRole("dialog", {
    name: "Enter result",
    exact: true,
  });
  await expect(
    picker.getByRole("button", { name: /Select fixture:/ }),
  ).toHaveCount(2);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-result-picker.png`,
  });
  await picker
    .getByRole("button", { name: /Select fixture: Beta vs Alpha/ })
    .click();
  await expect(page.getByLabel("Beta score", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Home team", { exact: true })).toHaveValue(
    "home",
  );
  await expect(page.getByLabel("Away team", { exact: true })).toHaveValue(
    "away",
  );
  await expect(
    picker.getByRole("button", { name: /Select fixture: Beta vs Alpha/ }),
  ).toBeFocused();
  await picker
    .getByRole("button", { name: /Select fixture: Alpha vs Beta/ })
    .click();
  await expect(page.getByLabel("Alpha score", { exact: true })).toHaveValue(
    "2",
  );
});
test("pair save and next uses returned revisions and finishes at the plus button", async ({
  page,
}: BrowserFixture): Promise<void> => {
  await load(page, { allUnplayed: true });
  await choosePair(page);
  await page
    .getByRole("button", { name: /Select fixture: Alpha vs Beta/ })
    .click();
  await page.getByLabel("Alpha score", { exact: true }).fill("1");
  await page.getByLabel("Beta score", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save & next match" }).click();
  await expect(page.getByLabel("Beta score", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Beta score", { exact: true })).toHaveValue("");
  await expect(
    page.getByRole("button", { name: "Save & next match" }),
  ).toHaveCount(0);
  await page.getByLabel("Beta score", { exact: true }).fill("2");
  await page.getByLabel("Alpha score", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save result", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Enter result", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByText("2/3 matches (67%)", { exact: true }),
  ).toBeVisible();
});
test("public view opens standings without result-entry controls", async ({
  page,
}: BrowserFixture): Promise<void> => {
  await load(page, { publicView: true });
  await expect(
    page.getByRole("tab", { name: "Standings", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "Enter result", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Tournament information" }).click();
  await expect(
    page.getByText("Public view · refreshes every 15s", { exact: true }),
  ).toBeVisible();
});

test("legacy overview links select standings and retain query filters", async ({
  page,
}: BrowserFixture): Promise<void> => {
  await load(page);
  await page.goto(
    "/manage/tournament-id?tab=overview&team=third&status=unplayed",
  );
  await expect(page).toHaveURL(/tab=standings&team=third&status=unplayed/);
  await expect(page.getByRole("tab").first()).toHaveAttribute(
    "aria-selected",
    "true",
  );
  if (test.info().project.name === "mobile") {
    await page
      .getByRole("button", { name: "More sections", exact: true })
      .click();
    await expect(page.getByRole("tab", { name: "Overview" })).toHaveCount(0);
  }
});
