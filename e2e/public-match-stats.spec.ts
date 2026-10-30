import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import type { PublicMatchStats } from "../src/shared/api/arena-api";
import { tournament } from "../src/test/fixtures";

interface BrowserFixture {
  page: Page;
}
type StatFixture = [
  PublicMatchStats["stats"][number]["key"],
  string,
  number,
  number,
];
const values: StatFixture[] = [
  ["possession", "Possession", 37, 63],
  ["shots", "Shots", 1, 4],
  ["shotsOnTarget", "Shots on target", 0, 3],
  ["fouls", "Fouls", 1, 3],
  ["offsides", "Offsides", 0, 2],
  ["cornerKicks", "Corner kicks", 0, 0],
  ["freeKicks", "Free kicks", 3, 0],
  ["passes", "Passes", 55, 73],
  ["successfulPasses", "Successful passes", 40, 57],
  ["crosses", "Crosses", 0, 0],
  ["interceptions", "Interceptions", 13, 13],
  ["tackles", "Tackles", 0, 2],
  ["saves", "Saves", 2, 0],
];

for (const admin of [false, true]) {
  test(`match accuracy is readable with keyboard dialog controls, admin=${admin}`, async ({
    page,
  }: BrowserFixture, info: TestInfo): Promise<void> => {
    await page.route("**/api/v1/**", async (route: Route): Promise<void> => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({
        json: path.endsWith("/matches/match-id/stats")
          ? {
              stats: values.map(
                ([
                  key,
                  label,
                  home,
                  away,
                ]: StatFixture): PublicMatchStats["stats"][number] => ({
                  key,
                  label,
                  home,
                  away,
                  unit: key === "possession" ? "percent" : "count",
                }),
              ),
            }
          : path.endsWith("/auth/session")
            ? {
                csrf: "test",
                user: admin
                  ? {
                      id: "owner",
                      name: "Admin",
                      email: "admin@example.test",
                      hasPassword: true,
                      googleLinked: false,
                    }
                  : null,
                googleEnabled: false,
              }
            : {
                ...tournament,
                statsEnabled: true,
                entrants: tournament.entrants.map(
                  (
                    entrant: (typeof tournament.entrants)[number],
                  ): (typeof tournament.entrants)[number] => ({
                    ...entrant,
                    name:
                      entrant.id === "home" ? "Northside FC" : "Blue Knights",
                  }),
                ),
              },
      });
    });
    await page.goto(
      admin
        ? "/manage/tournament-id?tab=fixtures"
        : "/t/ARENA2026?tab=fixtures",
    );
    const trigger = page.getByRole("button", {
      name: "View stats: Northside FC vs Blue Knights",
      exact: true,
    });
    await expect(trigger).toBeVisible();
    if (admin) {
      const edit = page.getByRole("button", {
        name: /Edit result: Northside FC vs Blue Knights/,
      });
      await expect(edit).toBeVisible();
      const original = page.viewportSize();
      for (const width of info.project.name === "mobile"
        ? [320, 375, 512]
        : [760, 900, 1440]) {
        await page.setViewportSize({ width, height: original?.height ?? 900 });
        const statsBounds = await trigger.boundingBox();
        const editBounds = await edit.boundingBox();
        expect(statsBounds).not.toBeNull();
        expect(editBounds).not.toBeNull();
        if (statsBounds && editBounds) {
          expect(statsBounds.x + statsBounds.width).toBeLessThanOrEqual(
            editBounds.x,
          );
          expect(editBounds.x + editBounds.width).toBeLessThanOrEqual(width);
        }
        expect(
          await page.evaluate(
            (): boolean =>
              document.documentElement.scrollWidth <= window.innerWidth,
          ),
        ).toBe(true);
      }
      if (original) await page.setViewportSize(original);
      await page.screenshot({
        path: `/tmp/arena-${info.project.name}-admin-fixture-actions.png`,
        fullPage: true,
      });
    }
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "Match stats: Northside FC vs Blue Knights",
    });
    await expect(
      dialog.getByRole("row", { name: /^Shot accuracy/ }).getByRole("cell"),
    ).toHaveText(["0%", "75%"]);
    await expect(
      dialog.getByRole("row", { name: /^Pass accuracy/ }).getByRole("cell"),
    ).toHaveText(["72.7%", "78.1%"]);
    await expect(dialog.getByRole("row")).toHaveCount(16);
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("region", { name: "Match stats table" }),
    ).toBeFocused();
    expect(
      await page.evaluate(
        (): boolean =>
          document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/arena-${info.project.name}-${admin ? "admin" : "public"}-match-accuracy.png`,
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    if (admin) {
      await page
        .getByRole("button", {
          name: /Edit result: Northside FC vs Blue Knights/,
        })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Make the result official" }),
      ).toBeVisible();
    }
  });
}
