import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import type { TeamStats } from "../src/shared/api/arena-api";
import { tournament } from "../src/test/fixtures";

interface Fixture {
  page: Page;
}
const keys: string[] = [
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
const names: string[] = [
  "Alpha",
  "Bravo International Championship Players Association",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot",
  "Golf",
];
async function load(
  page: Page,
  enabled: boolean = true,
  cup: boolean = false,
): Promise<void> {
  const stats: TeamStats = {
    enabled,
    teams: names.map(
      (name: string, index: number): TeamStats["teams"][number] => ({
        entrantId: String(index),
        name,
        stats: keys.map(
          (key: string): TeamStats["teams"][number]["stats"][number] => ({
            key,
            label: key,
            unit: key === "possession" ? "percent" : "count",
            value: index === 0 ? null : key === "possession" ? 55.5 : 0,
            recordedMatches: index === 0 ? 0 : 2,
            playedMatches: 5,
          }),
        ),
      }),
    ),
  };
  await page
    .context()
    .route("**/api/v1/**", async (route: Route): Promise<void> => {
      const url = route.request().url();
      await route.fulfill({
        json: url.includes("/auth/session")
          ? {
              csrf: "test",
              user: {
                id: "owner",
                name: "Admin",
                email: "admin@example.test",
                hasPassword: true,
                googleLinked: false,
              },
              googleEnabled: false,
            }
          : url.includes("/history")
            ? { items: [], total: 0, page: 1, pageSize: 20 }
            : url.endsWith("/stats")
              ? stats
              : {
                  ...tournament,
                  statsEnabled: enabled,
                  format: cup ? "WORLD_CUP" : tournament.format,
                },
      });
    });
  await page.goto(
    `/manage/tournament-id?tab=${enabled ? "stats" : "standings"}`,
  );
}
async function noOverflow(page: Page): Promise<void> {
  try {
    await expect
      .poll(async (): Promise<number> =>
        page.evaluate(
          (): number =>
            document.documentElement.scrollWidth - window.innerWidth,
        ),
      )
      .toBeLessThanOrEqual(0);
  } catch (error: unknown) {
    console.log(
      await page.evaluate((): string =>
        JSON.stringify({
          width: window.innerWidth,
          scroll: document.documentElement.scrollWidth,
          nodes: Array.from(document.querySelectorAll<HTMLElement>("body *"))
            .filter(
              (element: HTMLElement): boolean =>
                element.getBoundingClientRect().right > window.innerWidth + 1 &&
                !element.closest(".team-comparison-scroll"),
            )
            .map(
              (element: HTMLElement): string =>
                `${element.tagName}.${element.className}: ${element.getBoundingClientRect().right}`,
            )
            .slice(0, 30),
        }),
      ),
    );
    throw error;
  }
}

test("team selections compare seven teams, retain tabs, scroll locally and wrap at text zoom", async ({
  page,
}: Fixture, info: TestInfo): Promise<void> => {
  await page.setViewportSize({
    width: info.project.name === "mobile" ? 375 : 1440,
    height: info.project.name === "mobile" ? 812 : 900,
  });
  await load(page);
  await expect(
    page.getByRole("combobox", { name: "Team", exact: true }),
  ).toHaveValue("1");
  await expect(page.getByRole("columnheader")).toHaveText(["Stat", names[1]]);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-team-stats-single.png`,
    fullPage: true,
  });
  for (const id of ["2", "0", "3", "4", "5", "6"]) {
    await page.getByRole("combobox", { name: "Compare with" }).selectOption(id);
    if (id === "2")
      await expect(page.getByRole("columnheader")).toHaveText([
        "Stat",
        names[1],
        names[2],
      ]);
  }
  await expect(page.getByRole("columnheader")).toHaveCount(8);
  await expect(
    page.getByRole("combobox", { name: "Compare with" }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Fixtures", exact: true }).click();
  await expect(
    page.getByRole("tab", { name: "Fixtures", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  if (await page.getByRole("tab", { name: "Team stats", exact: true }).count())
    await page.getByRole("tab", { name: "Team stats", exact: true }).click();
  else {
    await page
      .getByRole("button", { name: "More sections", exact: true })
      .click();
    await page
      .getByRole("menuitemradio", { name: "Team stats", exact: true })
      .click();
  }
  await expect(page.getByRole("columnheader")).toHaveCount(8);
  await noOverflow(page);
  const scroll = page.getByRole("region", { name: "Team stats table" });
  await scroll.evaluate((element: HTMLElement): void => {
    element.scrollLeft = 400;
  });
  await noOverflow(page);
  const left = await scroll.boundingBox();
  const sticky = await page
    .getByRole("columnheader", { name: "Stat", exact: true })
    .boundingBox();
  expect(Math.abs((sticky?.x ?? 0) - (left?.x ?? 0))).toBeLessThan(3);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-team-stats-comparison.png`,
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate((): void => {
    document.documentElement.style.fontSize = "200%";
  });
  await noOverflow(page);
  if (info.project.name === "mobile") {
    const viewport = await scroll.boundingBox();
    const label = await page
      .getByRole("columnheader", { name: "Stat", exact: true })
      .boundingBox();
    expect(label?.width ?? Infinity).toBeLessThan(
      (viewport?.width ?? 0) * 0.55,
    );
  }
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-team-stats-zoom.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: `Remove ${names[1]}`, exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Team", exact: true }),
  ).toHaveValue("2");
});

test("stats information tooltip opens at a stable width without drifting or clipping", async ({
  page,
}: Fixture, info: TestInfo): Promise<void> => {
  await page.setViewportSize({
    width: info.project.name === "mobile" ? 375 : 1440,
    height: info.project.name === "mobile" ? 812 : 900,
  });
  await load(page);
  const trigger = page.getByRole("button", {
    name: "Stats information",
    exact: true,
  });
  await trigger.hover();
  const tooltip = page.getByRole("tooltip");
  await expect(tooltip).toBeVisible();
  const initial = await tooltip.boundingBox();
  const settled = await tooltip.evaluate(
    async (
      element: HTMLElement,
    ): Promise<{ left: number; right: number; width: number }> => {
      await new Promise<void>((resolve: () => void): void => {
        requestAnimationFrame((): void => resolve());
      });
      await new Promise<void>((resolve: () => void): void => {
        requestAnimationFrame((): void => resolve());
      });
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, width: bounds.width };
    },
  );
  expect(initial).not.toBeNull();
  expect(Math.abs((initial?.x ?? 0) - settled.left)).toBeLessThanOrEqual(1);
  expect(Math.abs((initial?.width ?? 0) - settled.width)).toBeLessThanOrEqual(
    1,
  );
  expect(settled.left).toBeGreaterThanOrEqual(0);
  expect(settled.right).toBeLessThanOrEqual(
    await page.evaluate((): number => document.documentElement.clientWidth),
  );
});

test("team stats starts with the key rows and expands to the complete stat order", async ({
  page,
}: Fixture, info: TestInfo): Promise<void> => {
  await page.setViewportSize({
    width: info.project.name === "mobile" ? 375 : 1440,
    height: info.project.name === "mobile" ? 812 : 900,
  });
  await load(page);
  const table = page.getByRole("table");
  await expect(table.getByRole("row")).toHaveText([
    `Stat${names[1]}`,
    "Possession55.5% · 2/5",
    "Shots (on target)0 (0) · 2/5",
    "Shot accuracy— · 2/5",
    "Passes (successful)0 (0) · 2/5",
    "Pass accuracy— · 2/5",
  ]);
  const toggle = page.getByRole("button", { name: "Show all stats" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(
    page.getByRole("button", { name: "Show key stats" }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(table.getByRole("row")).toHaveCount(14);
  await expect(table.getByRole("rowheader")).toHaveText([
    "Possession",
    "Shots (on target)",
    "Shot accuracy",
    "Passes (successful)",
    "Pass accuracy",
    "Free kicks",
    "Corner kicks",
    "Crosses",
    "Offsides",
    "Fouls",
    "Interceptions",
    "Tackles",
    "Saves",
  ]);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Show key stats" }).click();
  await expect(table.getByRole("row")).toHaveCount(6);
});

test("compact menu rows share typography and icons; keyboard public link opens another tab", async ({
  page,
}: Fixture, info: TestInfo): Promise<void> => {
  await load(page);
  await page
    .getByRole("button", { name: "Tournament actions", exact: true })
    .click();
  const menu = page.getByRole("group", { name: "Tournament actions" });
  const rows = menu.locator("button, a");
  await expect(rows).toHaveCount(5);
  for (const [index, icon] of [
    "pencil",
    "user-plus",
    "archive",
    "copy",
    "arrow-up-right",
  ].entries())
    await expect(rows.nth(index).locator(`svg.lucide-${icon}`)).toBeVisible();
  const dimensions = await rows.evaluateAll(
    (
      elements: HTMLElement[],
    ): {
      height: number;
      font: string;
      weight: string;
      padding: string;
      icon: number;
      border: string;
    }[] =>
      elements.map(
        (
          element: HTMLElement,
        ): {
          height: number;
          font: string;
          weight: string;
          padding: string;
          icon: number;
          border: string;
        } => {
          const style = getComputedStyle(element);
          return {
            height: element.getBoundingClientRect().height,
            font: style.fontSize,
            weight: style.fontWeight,
            padding: style.padding,
            icon:
              element.querySelector("svg")?.getBoundingClientRect().width ?? 0,
            border: style.borderWidth,
          };
        },
      ),
  );
  for (const row of dimensions)
    expect(row).toEqual({
      height: 44,
      font: "14px",
      weight: "600",
      padding: "8px 10px",
      icon: 18,
      border: "0px",
    });
  expect((await menu.boundingBox())?.width).toBeLessThanOrEqual(280);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-compact-menu.png`,
    fullPage: false,
  });
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Tournament actions", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Tournament actions", exact: true })
    .click();
  await menu.getByRole("button", { name: "Edit tournament name" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    menu.getByRole("button", { name: "Edit tournament name" }),
  ).toBeFocused();
  const organizerUrl = page.url();
  const link = menu.getByRole("link", {
    name: /Public page.*opens in a new tab/,
  });
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await link.focus();
  const popupPromise = page.waitForEvent("popup");
  await page.keyboard.press("Enter");
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/t\/ARENA2026$/);
  expect(page.url()).toBe(organizerUrl);
  expect(await popup.evaluate((): boolean => window.opener === null)).toBe(
    true,
  );
  await popup.goto("/t/ARENA2026?tab=stats");
  await expect(popup.getByRole("columnheader")).toHaveText(["Stat", names[1]]);
  await expect(
    popup.getByRole("button", { name: "Enter result", exact: true }),
  ).toHaveCount(0);
  await popup.close();
  await page.evaluate((): void => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(menu).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-compact-menu-zoom.png`,
    fullPage: false,
  });
});
test("disabled stats exposes the enable action with its chart icon", async ({
  page,
}: Fixture): Promise<void> => {
  await load(page, false);
  await page
    .getByRole("button", { name: "Tournament actions", exact: true })
    .click();
  await expect(
    page
      .getByRole("button", { name: "Enable match stats" })
      .locator("svg.lucide-chart-no-axes-combined"),
  ).toBeVisible();
});

test("compact comparison fits two teams, draws complete separators and exposes chip names and stats help", async ({
  page,
}: Fixture, info: TestInfo): Promise<void> => {
  await page.setViewportSize({
    width: info.project.name === "mobile" ? 375 : 1440,
    height: info.project.name === "mobile" ? 812 : 900,
  });
  await load(page);
  const longChip = page
    .getByRole("list", { name: "Selected teams" })
    .getByRole("button", {
      name: `Show full team name: ${names[1]}`,
      exact: true,
    });
  await expect(longChip).toHaveText("Bravo…");
  await longChip.focus();
  await expect(page.getByRole("tooltip")).toHaveText(names[1]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await longChip.click();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("combobox", { name: "Team", exact: true })
    .selectOption("2");
  await page.getByRole("combobox", { name: "Compare with" }).selectOption("3");
  await expect(page.getByRole("columnheader")).toHaveText([
    "Stat",
    "Charlie",
    "Delta",
  ]);
  const region = page.getByRole("region", { name: "Team stats table" });
  expect(
    await region.evaluate(
      (element: HTMLElement): boolean =>
        element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
  const row = page.getByRole("row", { name: /^Possession / });
  expect((await row.boundingBox())?.height).toBeLessThanOrEqual(44);
  const lines = await row
    .locator("th, td")
    .evaluateAll((cells: HTMLElement[]): string[] =>
      cells.map(
        (cell: HTMLElement): string => getComputedStyle(cell).borderBottom,
      ),
    );
  expect(new Set(lines).size).toBe(1);
  expect(lines[0]).toContain("1px solid");
  const chipHeight = await page
    .getByRole("list", { name: "Selected teams" })
    .locator("li")
    .first()
    .boundingBox();
  expect(chipHeight?.height).toBeLessThanOrEqual(34);
  const help = page.getByRole("button", {
    name: "Stats information",
    exact: true,
  });
  await help.click();
  await expect(page.getByRole("tooltip")).toContainText(
    "possession is an average",
  );
  await page.keyboard.press("Escape");
  await expect(help).toBeFocused();
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-compact-comparison.png`,
    fullPage: false,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("adaptive navigation fits whole tabs at intermediate widths and keeps active sections visible", async ({
  page,
}: Fixture, info: TestInfo): Promise<void> => {
  await load(page, true, true);
  const nav = page.getByRole("navigation", {
    name: "Tournament navigation",
    exact: true,
  });
  for (const width of [320, 375, 480, 640, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("tab", { name: "Team stats", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect
      .poll(async (): Promise<boolean> =>
        nav.evaluate((element: HTMLElement): boolean => {
          const box = element.getBoundingClientRect();
          return Array.from(
            element.querySelectorAll<HTMLElement>(
              '[role="tab"], .more-sections',
            ),
          ).every((control: HTMLElement): boolean => {
            const rect = control.getBoundingClientRect();
            return (
              rect.left >= box.left - 1 &&
              rect.right <= box.right + 1 &&
              control.scrollWidth <= control.clientWidth + 1
            );
          });
        }),
      )
      .toBe(true);
    if (width === 320) await expect(page.getByRole("tab")).toHaveCount(2);
    if (width === 375) await expect(page.getByRole("tab")).toHaveCount(3);
    if (width === 900)
      await expect(
        page.getByRole("button", { name: "More sections" }),
      ).toHaveCount(0);
    await noOverflow(page);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  const more = page.getByRole("button", { name: "More sections", exact: true });
  await more.click();
  await expect(more).toHaveText("More");
  await page
    .getByRole("menuitemradio", { name: "Knockout", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Knockout", exact: true }),
  ).toBeFocused();
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-adaptive-tabs.png`,
    fullPage: false,
  });
  await more.click();
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await page.evaluate((): void => {
    document.documentElement.style.fontSize = "200%";
  });
  await page.setViewportSize({ width: 320, height: 812 });
  await expect(
    page.getByRole("link", { name: "Skip to main content", exact: true }),
  ).not.toBeInViewport();
  await page
    .getByRole("link", { name: "Skip to main content", exact: true })
    .focus();
  await expect(
    page.getByRole("link", { name: "Skip to main content", exact: true }),
  ).toBeInViewport();
  await page.keyboard.press("Tab");
  await more.click();
  await page
    .getByRole("menuitemradio", { name: "Revision history", exact: true })
    .click();
  await expect(
    page.getByRole("tab", { name: "Revision history", exact: true }),
  ).toBeFocused();
  await noOverflow(page);
  await page.screenshot({
    path: `/tmp/arena-${info.project.name}-adaptive-tabs-zoom.png`,
    fullPage: false,
  });
});
