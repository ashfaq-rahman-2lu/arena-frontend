import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import { match, tournament } from "../src/test/fixtures";

interface OrganizerOptions {
  longNames?: boolean;
  cup?: boolean;
  longList?: boolean;
  shortAway?: boolean;
}
interface OrganizerFixture {
  page: Page;
}
async function loadOrganizer(
  page: Page,
  {
    longNames = false,
    cup = false,
    longList = false,
    shortAway = false,
  }: OrganizerOptions = {},
): Promise<void> {
  await page.route("**/api/v1/**", async (route: Route): Promise<void> => {
    const session = route.request().url().includes("/auth/session");
    await route.fulfill({
      json: route.request().url().includes("/stats")
        ? { teams: [] }
        : session
          ? {
              csrf: "test-csrf",
              user: {
                id: "owner",
                name: "Admin",
                email: "admin@example.test",
                hasPassword: true,
                googleLinked: false,
              },
              googleEnabled: false,
            }
          : {
              ...tournament,
              name: longNames
                ? "Championship for teams with exceptionally long tournament names"
                : tournament.name,
              entrants: tournament.entrants.map(
                (
                  entrant: (typeof tournament.entrants)[number],
                ): typeof entrant => ({
                  ...entrant,
                  name:
                    shortAway && entrant.id === "away"
                      ? "f"
                      : longNames
                        ? `${entrant.name} International Championship Players Association`
                        : entrant.name,
                }),
              ),
              format: cup ? "WORLD_CUP" : "LEAGUE",
              groups: cup
                ? [{ id: "g", name: "Group A", qualifierCount: 1 }]
                : [],
              standings: cup
                ? [
                    {
                      scope: "g",
                      rows: tournament.entrants.map(
                        (
                          entrant: (typeof tournament.entrants)[number],
                          index: number,
                        ): (typeof tournament.standings)[number]["rows"][number] => ({
                          entrantId: entrant.id,
                          name: entrant.name,
                          rank: index + 1,
                          played: 0,
                          won: 0,
                          drawn: 0,
                          lost: 0,
                          scoreFor: 0,
                          scoreAgainst: 0,
                          difference: 0,
                          points: 0,
                          tieSignature: null,
                          tieResolved: false,
                        }),
                      ),
                    },
                  ]
                : [],
              statsEnabled: true,
              matches: [
                ...(longList
                  ? Array.from(
                      { length: 8 },
                      (_value: unknown, index: number): typeof match => ({
                        ...match,
                        id: `extra-${index}`,
                        homeScore: null,
                        awayScore: null,
                      }),
                    )
                  : []),
                { ...match, homeScore: null, awayScore: null },
                {
                  ...match,
                  id: "round-two",
                  round: 2,
                  homeScore: null,
                  awayScore: null,
                },
              ],
            },
    });
  });
  await page.goto("/manage/tournament-id?tab=fixtures");
}

test("score saving stays visible while optional fields scroll", async ({
  page,
}: OrganizerFixture, info: TestInfo): Promise<void> => {
  await loadOrganizer(page);
  await page
    .getByRole("button", { name: "Add result: Alpha vs Beta, round 1" })
    .click();
  const save = page.getByRole("button", { name: "Save result", exact: true });
  const fits = async (): Promise<boolean> =>
    save.evaluate((element: HTMLElement): boolean => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= window.innerHeight;
    });
  expect(await fits()).toBe(true);
  await page.getByLabel("Alpha Possession").fill("55");
  expect(await fits()).toBe(true);
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import scorecard", exact: true })
    .click();
  await (await chooser).setFiles("e2e/fixtures/scorecard.png");
  await page
    .getByRole("img", { name: "Uploaded match scorecard" })
    .scrollIntoViewIfNeeded();
  expect(await fits()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "Make the result official" }),
  ).toBeInViewport();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-score-controls.png`,
  });
});

test("compact heading and keyboard round navigation work without page overflow", async ({
  page,
}: OrganizerFixture, info: TestInfo): Promise<void> => {
  await loadOrganizer(page, { longNames: true });
  const round = page.getByRole("combobox", { name: "Filter by round" });
  await expect(round).toBeVisible();
  await expect(
    page.getByText("0/2 matches played", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand all", exact: true }).click();
  await expect(page.getByRole("button", { name: /Add result:/ })).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: "Collapse all", exact: true }).click();
  await expect(page.getByRole("button", { name: /Add result:/ })).toHaveCount(
    0,
  );
  await round.selectOption("LEAGUE:2");
  const heading = page.getByRole("button", { name: /League · Round 2/ });
  await expect(heading).toHaveAttribute("aria-expanded", "true");
  const roundBounds = await heading.boundingBox();
  if (!roundBounds) throw new Error("Round heading must be visible");
  expect(roundBounds.height).toBeGreaterThanOrEqual(44);
  expect(roundBounds.height).toBeLessThanOrEqual(48);
  await heading.focus();
  await page.keyboard.press("Enter");
  await expect(heading).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Space");
  await expect(heading).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("button", { name: "Tournament actions", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit tournament name" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tournament actions", exact: true })
    .click();
  expect(
    await page.evaluate(
      (): boolean => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-compact-fixtures.png`,
  });
  await page.evaluate((): void => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      (): boolean => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("tournament navigation stays reachable and secondary sections work on phones", async ({
  page,
}: OrganizerFixture, info: TestInfo): Promise<void> => {
  await loadOrganizer(page, { longList: true });
  await page.setViewportSize({
    width: info.project.name === "mobile" ? 375 : 1440,
    height: 600,
  });
  await page.getByRole("button", { name: /League · Round 2/ }).click();
  await page.evaluate((): void =>
    window.scrollTo(0, document.body.scrollHeight),
  );
  const navigation = page.getByRole("navigation", {
    name: "Tournament navigation",
  });
  await expect(navigation).toBeInViewport();
  expect(
    await navigation.evaluate((element: HTMLElement): number =>
      Math.abs(element.getBoundingClientRect().top),
    ),
  ).toBeLessThan(2);
  if (info.project.name === "mobile") {
    const more = page.getByRole("button", { name: /More sections/ });
    await more.click();
    await page.getByRole("tab", { name: "Team stats", exact: true }).click();
    await expect(
      page.getByRole("tabpanel", { name: "Team stats" }),
    ).toBeVisible();
    await more.click();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute("aria-expanded", "false");
  }
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-sticky-navigation.png`,
  });
});

test("standings show key columns on phones, with full stats and qualification explanations available", async ({
  page,
}: OrganizerFixture, info: TestInfo): Promise<void> => {
  await loadOrganizer(page, { cup: true });
  await page.getByRole("tab", { name: "Standings", exact: true }).click();
  await expect(
    page.getByText("Current qualification positions", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Qualification cutoff", { exact: true }),
  ).toHaveCount(0);
  const badge = page.getByRole("button", {
    name: "Qualification places for Group A: Top 1",
  });
  await expect(badge).toHaveText("Top 1");
  const headerHeight = await page
    .getByRole("heading", { name: "Group A", exact: true })
    .evaluate(
      (heading: HTMLElement): number =>
        heading.closest("header")?.getBoundingClientRect().height ?? Infinity,
    );
  expect(headerHeight).toBeLessThanOrEqual(64);
  if (info.project.name === "mobile") await badge.tap();
  else await badge.hover();
  await expect(page.getByRole("tooltip")).toContainText("provisional");
  await badge.focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  const table = page.getByRole("table", { name: "Group A standings" });
  if (info.project.name === "mobile") {
    await expect(
      table.getByRole("columnheader", { name: "SF", exact: true }),
    ).toHaveCount(0);
    const columns = page.getByRole("button", { name: "Show full statistics" });
    await columns.focus();
    await expect(page.getByRole("tooltip")).toHaveText("Show full statistics");
    await page.keyboard.press("Escape");
    const bounds = await columns.boundingBox();
    const groupBounds = await page
      .getByRole("heading", { name: "Group A", exact: true })
      .boundingBox();
    if (!bounds || !groupBounds)
      throw new Error("Standings header must be visible");
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(bounds.x).toBeGreaterThan(groupBounds.x + groupBounds.width);
    expect(
      Math.abs(
        bounds.y + bounds.height / 2 - groupBounds.y - groupBounds.height / 2,
      ),
    ).toBeLessThan(3);
    await page.keyboard.press("Enter");
    await expect(
      table.getByRole("columnheader", { name: "SF", exact: true }),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Show key statistics" }).click();
  } else {
    await expect(
      page.getByRole("button", { name: "Show full statistics" }),
    ).toHaveCount(0);
  }
  await page
    .getByText("Table guide & tie-break rules", { exact: true })
    .click();
  await expect(page.getByText("Score for", { exact: true })).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-qualification-standings.png`,
    fullPage: true,
  });
});

test("title actions menu contains the requested actions and supports keyboard and dialog dismissal", async ({
  page,
}: OrganizerFixture, info: TestInfo): Promise<void> => {
  await loadOrganizer(page, { longNames: true });
  const trigger = page.getByRole("button", {
    name: "Tournament actions",
    exact: true,
  });
  await expect(
    page.getByRole("button", { name: "Share tournament" }),
  ).toHaveCount(0);
  await trigger.focus();
  await page.keyboard.press("Enter");
  const actions = page.getByRole("group", { name: "Tournament actions" });
  await expect(
    actions.getByRole("button", { name: "Add teams" }),
  ).toBeVisible();
  await expect(
    actions.getByRole("button", { name: "Archive stats" }),
  ).toBeVisible();
  await expect(
    actions.getByRole("button", { name: "Share tournament" }),
  ).toBeVisible();
  await expect(
    actions.getByRole("link", { name: "Public page" }),
  ).toBeVisible();
  expect(
    await actions.evaluate((element: HTMLElement): boolean => {
      const box = element.getBoundingClientRect();
      return box.left >= 0 && box.right <= window.innerWidth;
    }),
  ).toBe(true);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-title-menu.png`,
  });
  await actions.getByRole("button", { name: "Edit tournament name" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();
});

test("mirrored score inputs, swap and stat rows align with unequal team names", async ({
  page,
}: OrganizerFixture, info: TestInfo): Promise<void> => {
  await page.setViewportSize({
    width: info.project.name === "mobile" ? 375 : 1440,
    height: info.project.name === "mobile" ? 812 : 900,
  });
  await loadOrganizer(page, { longNames: true, shortAway: true });
  await page.getByRole("button", { name: /Add result:.*round 1/ }).click();
  const home = page.getByRole("spinbutton", {
    name: "Alpha International Championship Players Association score",
    exact: true,
  });
  const away = page.getByRole("spinbutton", { name: "f score", exact: true });
  const colon = await page.getByText(":", { exact: true }).boundingBox();
  const homeBox = await home.boundingBox();
  const awayBox = await away.boundingBox();
  const swap = await page
    .getByRole("button", { name: "Swap results", exact: true })
    .boundingBox();
  if (!colon || !homeBox || !awayBox || !swap)
    throw new Error("Score controls must be visible");
  expect(Math.abs(homeBox.y - awayBox.y)).toBeLessThan(1);
  expect(homeBox.height).toBeGreaterThanOrEqual(44);
  expect(homeBox.width).toBeLessThanOrEqual(64);
  expect(homeBox.x + homeBox.width).toBeLessThan(colon.x);
  expect(colon.x + colon.width).toBeLessThan(awayBox.x);
  expect(
    Math.abs(colon.x + colon.width / 2 - swap.x - swap.width / 2),
  ).toBeLessThan(1);
  const importButton = page.getByRole("button", {
    name: "Import scorecard",
    exact: true,
  });
  const readButton = page.getByRole("button", {
    name: "Read scorecard",
    exact: true,
  });
  await expect(readButton).toBeDisabled();
  const importBox = await importButton.boundingBox();
  const readBox = await readButton.boundingBox();
  if (!importBox || !readBox)
    throw new Error("Import buttons must be measurable");
  expect(importBox.y).toBe(readBox.y);
  const homeStat = page.getByRole("spinbutton", {
    name: "Alpha International Championship Players Association Shots",
    exact: true,
  });
  await homeStat.scrollIntoViewIfNeeded();
  const homeStatBox = await homeStat.boundingBox();
  const statName = await page.getByText("Shots", { exact: true }).boundingBox();
  const awayStatBox = await page
    .getByRole("spinbutton", { name: "f Shots", exact: true })
    .boundingBox();
  if (!homeStatBox || !statName || !awayStatBox)
    throw new Error("Stats must be visible");
  expect(homeStatBox.x + homeStatBox.width).toBeLessThan(statName.x);
  expect(statName.x + statName.width).toBeLessThan(awayStatBox.x);
  expect(homeStatBox.height).toBeLessThanOrEqual(48);
  await home.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-mirrored-editor.png`,
  });
  await page.evaluate((): void => {
    document.documentElement.style.fontSize = "200%";
  });
  await home.scrollIntoViewIfNeeded();
  await expect(home).toBeInViewport({ ratio: 1 });
  await expect(away).toBeInViewport({ ratio: 1 });
  await expect(
    page.getByRole("button", { name: "Save result", exact: true }),
  ).toBeInViewport({ ratio: 1 });
  expect(
    await page.evaluate(
      (): boolean => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const dialog = page.getByRole("dialog", { name: "Make the result official" });
  expect(
    await dialog.evaluate(
      (element: HTMLElement): boolean =>
        element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-mirrored-editor-zoom.png`,
  });
});
