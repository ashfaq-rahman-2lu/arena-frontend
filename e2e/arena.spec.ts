import AxeBuilder from "@axe-core/playwright";
import { expect, Page, test, TestInfo } from "@playwright/test";
import { completeCupFixture, response } from "./api-fixture";
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
  await page.getByRole("radio", { name: "Group + knockout" }).check();
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

test("knockout-only import, rename, fixed bracket and two-leg aggregate decisions", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await signIn(page);
  await page.goto("/new");
  await page
    .getByRole("textbox", { name: "Tournament name" })
    .fill(`Knockout browser ${info.project.name}`);
  await page.getByRole("radio", { name: "Only knockout" }).check();
  await page.getByLabel("Knockout legs").selectOption("2");
  await expect(page.getByLabel("Final legs")).toHaveValue("1");
  await page
    .getByText("Import teams from your tournament", { exact: true })
    .click();
  const sourcePicker = page.getByRole("combobox", {
    name: "Source tournament",
    exact: true,
  });
  await expect(sourcePicker).toBeEnabled();
  while (
    (await sourcePicker
      .getByRole("option", { name: /^Browser draft / })
      .count()) === 0
  ) {
    await page
      .getByRole("navigation", { name: "Source tournaments pagination" })
      .getByRole("button", { name: "Next", exact: true })
      .click();
    await expect(sourcePicker).toBeEnabled();
  }
  const sourceName = await sourcePicker
    .getByRole("option", { name: /^Browser draft / })
    .first()
    .textContent();
  if (!sourceName) throw new Error("Missing source tournament");
  await sourcePicker.selectOption({ label: sourceName });
  await page.getByRole("button", { name: "Select all teams" }).click();
  await page.getByRole("button", { name: "Import selected teams" }).click();
  await expect(
    page.getByRole("textbox", { name: "Team 1 name", exact: true }),
  ).toHaveValue("Alpha");
  await expect(
    page.getByLabel("Source tournament", { exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Add team", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Team 3 name", exact: true })
    .fill("Gamma");
  await page.getByRole("button", { name: "Add team", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Team 4 name", exact: true })
    .fill("Delta");
  await page.getByRole("button", { name: /Save & review fixtures/ }).click();
  await expect(page).toHaveURL(/\/manage\//);
  await page.getByRole("button", { name: /Review & start/ }).click();
  await page
    .getByRole("button", { name: "Start tournament", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Add teams", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Standings" })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit tournament name" }).click();
  await page
    .getByRole("textbox", { name: "Tournament name" })
    .fill(`Renamed knockout ${info.project.name}`);
  await page.getByRole("button", { name: "Save name" }).click();
  await expect(
    page.getByRole("heading", {
      name: `Renamed knockout ${info.project.name}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Choose pairings/ }).click();
  await page.getByLabel("Pairing method").selectOption("FIXED");
  await page
    .getByRole("combobox", { name: "Match 1 first team" })
    .selectOption({ label: "Alpha" });
  await page
    .getByRole("combobox", { name: "Match 1 second team" })
    .selectOption({ label: "Beta" });
  await page
    .getByRole("combobox", { name: "Match 2 first team" })
    .selectOption({ label: "Gamma" });
  await page
    .getByRole("combobox", { name: "Match 2 second team" })
    .selectOption({ label: "Delta" });
  await page.getByRole("button", { name: "Review bracket" }).click();
  await checkAccessibility(page);
  await page.getByRole("button", { name: "Create round", exact: true }).click();
  await page.getByRole("tab", { name: "Knockout", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Alpha vs Beta, leg 1", exact: true })
    .click();
  await page.getByLabel("Alpha score").fill("2");
  await page.getByLabel("Beta score").fill("0");
  await page.getByRole("button", { name: "Save result", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Beta vs Alpha, leg 2", exact: true })
    .click();
  await page.getByLabel("Beta score").fill("2");
  await page.getByLabel("Alpha score").fill("0");
  await page
    .getByLabel("Winner of the tied aggregate")
    .selectOption({ label: "Alpha" });
  await checkAccessibility(page);
  await page.screenshot({
    path: `e2e/screenshots/${info.project.name}-aggregate-decision.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "Save result", exact: true }).click();
  await expect(
    page.getByText("Two legs · Advances: Alpha", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `e2e/screenshots/${info.project.name}-knockout.png`,
    fullPage: false,
  });
  expect(
    await page.evaluate(
      (): boolean => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("ongoing league name and multiple team additions preserve existing fixtures", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await signIn(page);
  await page.goto("/new");
  await page
    .getByRole("textbox", { name: "Tournament name" })
    .fill(`Expansion ${info.project.name}`);
  await page
    .getByRole("textbox", { name: "Team 1 name", exact: true })
    .fill("Original Alpha");
  await page
    .getByRole("textbox", { name: "Team 2 name", exact: true })
    .fill("Original Beta");
  await page.getByRole("button", { name: /Save & review fixtures/ }).click();
  await expect(page).toHaveURL(/\/manage\//);
  await page.getByRole("button", { name: /Review & start/ }).click();
  await page
    .getByRole("button", { name: "Start tournament", exact: true })
    .click();
  await page.getByRole("button", { name: "Add teams", exact: true }).click();
  await page
    .getByRole("textbox", { name: "New team 1 name", exact: true })
    .fill("Late Gamma");
  await page.getByRole("button", { name: "Add another team" }).click();
  await page
    .getByRole("textbox", { name: "New team 2 name", exact: true })
    .fill("Late Delta");
  await expect(
    page.getByText("2 new teams · 5 new matches", { exact: true }),
  ).toBeVisible();
  await checkAccessibility(page);
  await page
    .getByRole("button", { name: "Add teams and schedule matches" })
    .click();
  await page.getByRole("tab", { name: "Fixtures", exact: true }).click();
  await expect(page.locator(".fixture-row")).toHaveCount(6);
  await page.screenshot({
    path: `e2e/screenshots/${info.project.name}-expanded-league.png`,
    fullPage: false,
  });
});

test("256-team knockout remains readable in owner and public views", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  await signIn(page);
  const session = await response<import("../src/shared/api/arena-api").Session>(
    await page.request.get("/api/v1/auth/session"),
    "SessionView",
  );
  const headers = { "X-CSRF-Token": session.csrf };
  let t = await response<import("../src/shared/api/arena-api").Tournament>(
    await page.request.post("/api/v1/tournaments", {
      headers,
      data: {
        name: `Large knockout ${info.project.name}`,
        game: "EFOOTBALL",
        format: "KNOCKOUT",
        legs: 1,
        knockoutLegs: 2,
        knockoutFinalLegs: 1,
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        groups: [],
        entrants: Array.from(
          { length: 256 },
          (_: unknown, i: number): { name: string; aliases: string[] } => ({
            name: `Team ${String(i).padStart(3, "0")} with a long competition name`,
            aliases: [],
          }),
        ),
      },
    }),
    "TournamentView",
  );
  t = await response<import("../src/shared/api/arena-api").Tournament>(
    await page.request.post(`/api/v1/tournaments/${t.id}/start`, {
      headers,
      data: { expectedRevision: t.revision },
    }),
    "TournamentView",
  );
  const ids = t.entrants.map(
    (e: import("../src/shared/api/arena-api").Entrant): string => e.id,
  );
  const pairs: [string, string][] = [];
  for (let i = 0; i < ids.length; i += 2) pairs.push([ids[i], ids[i + 1]]);
  t = await response<import("../src/shared/api/arena-api").Tournament>(
    await page.request.post(`/api/v1/tournaments/${t.id}/rounds`, {
      headers,
      data: { expectedRevision: t.revision, pairs, byes: [] },
    }),
    "TournamentView",
  );
  await page.goto(`/manage/${t.id}?tab=knockout`);
  await expect(page.locator(".knockout-tie")).toHaveCount(128);
  expect(
    await page.evaluate(
      (): boolean => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `e2e/screenshots/${info.project.name}-large-knockout.png`,
    fullPage: false,
  });
  await page.goto(`/t/${t.publicId}?tab=knockout`);
  await expect(page.locator(".knockout-tie")).toHaveCount(128);
  await checkAccessibility(page);
});
