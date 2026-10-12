import AxeBuilder from "@axe-core/playwright";
import { expect, Page, test, TestInfo } from "@playwright/test";
import { completeCupFixture } from "./api-fixture";
interface BrowserFixture {
  page: Page;
}
async function signIn(page: Page): Promise<void> {
  await page.goto("/auth/login");
  await page
    .getByRole("textbox", { name: "Email address" })
    .fill("browser@arena.test");
  await page.getByLabel("Password", { exact: true }).fill("BrowserArena2026!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
async function checkAccessibility(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((violation: import("axe-core").Result): unknown => ({
      id: violation.id,
      nodes: violation.nodes.map(
        (node: import("axe-core").NodeResult): unknown => ({
          target: node.target,
          reason: node.failureSummary,
        }),
      ),
    })),
  ).toEqual([]);
}
test("sign in, paginated dashboard, keyboard tabs, public viewing and long fixtures", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await signIn(page);
  await expect(page.locator(".tournament-card")).toHaveCount(20);
  await checkAccessibility(page);
  await page.screenshot({
    path: `e2e/screenshots/${info.project.name}-dashboard.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await page
    .getByRole("link", { name: /Large league with long team names/ })
    .click();
  const started = Date.now();
  await page.getByRole("tab", { name: "Overview", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Fixtures", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".fixture-row")).toHaveCount(50);
  console.log(
    `${info.project.name}: 64-team fixture tab ${Date.now() - started}ms`,
  );
  await checkAccessibility(page);
  await page.screenshot({
    path: `e2e/screenshots/${info.project.name}-fixtures.png`,
    fullPage: false,
  });
  await page.getByRole("link", { name: /Public page/ }).click();
  await expect(
    page.getByText("Public view · refreshes every 15s"),
  ).toBeVisible();
  await checkAccessibility(page);
  await page.evaluate((): void => {
    document.documentElement.style.fontSize = "200%";
  });
  await expect(
    page.getByRole("tab", { name: "Fixtures", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `e2e/screenshots/${info.project.name}-zoom.png`,
    fullPage: false,
  });
  const navigationFits = await page
    .locator(".nav a")
    .evaluateAll((elements: HTMLElement[]): boolean =>
      elements.every(
        (element: HTMLElement): boolean =>
          element.getBoundingClientRect().right <= window.innerWidth,
      ),
    );
  expect(navigationFits).toBe(true);
  const navigationContained = await page
    .locator(".nav")
    .evaluate((element: HTMLElement): boolean => {
      const bottom = element.getBoundingClientRect().bottom;
      return Array.from(element.querySelectorAll("a")).every(
        (link: HTMLAnchorElement): boolean =>
          link.getBoundingClientRect().bottom <= bottom,
      );
    });
  expect(navigationContained).toBe(true);
  const overflow = await page.evaluate(
    (): boolean => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
test("league setup, dirty navigation, result suggestions, clear confirmation and dialog focus", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  page.on("pageerror", (error: Error): void => {
    console.log("PAGE ERROR", error.message);
  });
  await signIn(page);
  await page.goto("/new");
  await page
    .getByRole("textbox", { name: "Tournament name" })
    .fill(`Browser league ${info.project.name}`);
  await page
    .getByRole("link", { name: /dashboard/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Discard unsaved changes?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("textbox", { name: "Tournament name" }),
  ).toHaveValue(`Browser league ${info.project.name}`);
  const teamInputs = page.getByRole("textbox", { name: /Team \d+ name/ });
  await expect(teamInputs).toHaveCount(2);
  await teamInputs.nth(0).pressSequentially("Alpha");
  await expect(teamInputs.nth(0)).toHaveValue("Alpha");
  await teamInputs.nth(1).pressSequentially("Beta");
  await expect(teamInputs.nth(1)).toHaveValue("Beta");
  await checkAccessibility(page);
  await page.getByRole("button", { name: /Save & review fixtures/ }).click();
  await expect(page).toHaveURL(/\/manage\//);
  await page.getByRole("button", { name: /Review & start/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Review your fixtures" }),
  ).toBeVisible();
  await checkAccessibility(page);
  await page
    .getByRole("button", { name: "Start tournament", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "Fixtures", exact: true }).click();
  const edit = page.getByRole("button", {
    name: /Add result: Alpha vs Beta|Add result: Beta vs Alpha/,
  });
  await edit.click();
  const centerOffset = await page
    .getByRole("dialog", { name: "Make the result official" })
    .evaluate((element: HTMLElement): number => {
      const box = element.getBoundingClientRect();
      return Math.abs(box.left + box.width / 2 - window.innerWidth / 2);
    });
  expect(centerOffset).toBeLessThan(2);
  await expect(
    page.getByRole("dialog", { name: "Make the result official" }),
  ).toBeVisible();
  await checkAccessibility(page);
  await page
    .getByLabel("Scorecard image")
    .setInputFiles("e2e/fixtures/scorecard.png");
  await page.getByRole("button", { name: /Read scorecard/ }).click();
  await expect(page.getByText(/Suggested scores/)).toBeVisible();
  await page.getByRole("button", { name: "Save result", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = page.getByRole("button", { name: /Edit result:/ });
  await saved.click();
  page.once(
    "dialog",
    async (dialog: import("@playwright/test").Dialog): Promise<void> => {
      await dialog.dismiss();
    },
  );
  await page.getByRole("button", { name: "Clear result" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(saved).toBeFocused();
});
test("cup setup and a destructive correction require reviewed reset confirmation", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await signIn(page);
  await page.goto("/new");
  await page
    .getByRole("textbox", { name: "Tournament name" })
    .fill(`Browser cup ${info.project.name}`);
  await page.getByRole("radio", { name: "Groups + knockout" }).check();
  await page.getByRole("button", { name: "Add team", exact: true }).click();
  await page.getByRole("button", { name: "Add team", exact: true }).click();
  const names = ["Alpha", "Beta", "Gamma", "Delta"];
  for (let index = 0; index < names.length; index++) {
    await page
      .getByRole("textbox", { name: `Team ${index + 1} name`, exact: true })
      .pressSequentially(names[index]);
    await page
      .getByRole("combobox", { name: `Group for ${names[index]}`, exact: true })
      .selectOption({ label: "Group A" });
  }
  await page
    .getByRole("spinbutton", { name: "Teams advancing from Group A" })
    .fill("4");
  await page.getByRole("button", { name: /Save & review fixtures/ }).click();
  await page.getByRole("button", { name: /Review & start/ }).click();
  await page
    .getByRole("button", { name: "Start tournament", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const id = page.url().split("/manage/")[1].split("?")[0];
  const t = await completeCupFixture(page, id);
  const early = t.matches.find(
    (match: import("../src/shared/api/arena-api").Match): boolean =>
      match.stage === "KNOCKOUT" && match.round === 1,
  );
  if (!early) throw new Error("No semifinal");
  const home = t.entrants.find(
      (entrant: import("../src/shared/api/arena-api").Entrant): boolean =>
        entrant.id === early.homeId,
    ),
    away = t.entrants.find(
      (entrant: import("../src/shared/api/arena-api").Entrant): boolean =>
        entrant.id === early.awayId,
    );
  if (!home || !away) throw new Error("No teams");
  await page.reload();
  await page.getByRole("tab", { name: "Fixtures", exact: true }).click();
  await page
    .getByRole("button", {
      name: `Edit result: ${home.name} vs ${away.name}, round 1`,
      exact: true,
    })
    .click();
  await page.getByRole("spinbutton", { name: `${home.name} score` }).fill("0");
  await page.getByRole("spinbutton", { name: `${away.name} score` }).fill("4");
  await page.getByRole("button", { name: "Save result", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Confirm correction & reset" }),
  ).toBeVisible();
  await checkAccessibility(page);
  await page.screenshot({
    path: `e2e/screenshots/${info.project.name}-correction.png`,
    fullPage: false,
  });
  await page
    .getByRole("button", { name: "Confirm correction & reset" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("tab", { name: "Revision history" }).click();
  await expect(
    page.getByText("Progression reset", { exact: true }),
  ).toBeVisible();
  await checkAccessibility(page);
});
