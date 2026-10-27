import {
  expect,
  test,
  type Page,
  type Route,
  type TestInfo,
} from "@playwright/test";
import { tournament } from "../src/test/fixtures";

interface BrowserFixture {
  page: Page;
}
interface LabelLayout {
  lines: number;
  width: number;
}

for (const width of [375, 686, 1440]) {
  test(`signed-out follow action stays readable at ${width}px`, async ({
    page,
  }: BrowserFixture, info: TestInfo): Promise<void> => {
    await page.setViewportSize({ width, height: 812 });
    await page.route("**/api/v1/**", async (route: Route): Promise<void> => {
      await route.fulfill({
        json: route.request().url().includes("/auth/session")
          ? { csrf: "fake", googleEnabled: false, user: null }
          : tournament,
      });
    });
    await page.goto(`/t/${tournament.publicId}`);
    const trigger = page.getByRole("button", { name: "Tournament actions" });
    await trigger.click();
    const menu = page.getByRole("group", { name: "Tournament actions" });
    const action = menu.getByRole("link", { name: "Sign in to follow" });
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute(
      "href",
      `/auth/login?returnTo=${encodeURIComponent(`/t/${tournament.publicId}`)}`,
    );
    const layout = await action.evaluate(
      (element: HTMLElement): LabelLayout => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const tops = new Set<number>();
        let width = 0;
        let node: Node | null = walker.nextNode();
        while (node) {
          if (node.textContent?.trim()) {
            const range = document.createRange();
            range.selectNodeContents(node);
            for (const rect of range.getClientRects()) {
              tops.add(Math.round(rect.top));
              width = Math.max(width, rect.width);
            }
          }
          node = walker.nextNode();
        }
        return { lines: tops.size, width };
      },
    );
    await page.screenshot({
      path: info.outputPath(`follow-menu-${width}.png`),
    });
    expect(layout.lines).toBe(1);
    expect(layout.width).toBeGreaterThan(80);
    const box = await menu.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    await action.focus();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });
}
