import { expect, Page, test, TestInfo } from "@playwright/test";
import {
  account,
  signIn,
  openTournamentActions,
  openProfileSettings,
} from "./account-fixture";
interface BrowserFixture {
  page: Page;
}
test("follow a public tournament, unfollow it from the dashboard, and change password", async ({
  page,
}: BrowserFixture, info: TestInfo): Promise<void> => {
  const user = await account(page);
  await signIn(page, user);
  const publicId = user.tournaments[0]?.publicId;
  if (!publicId) throw new Error("Missing test tournament");
  let logoutCalls = 0;
  page.on("request", (request: import("@playwright/test").Request): void => {
    if (request.url().endsWith("/auth/logout")) logoutCalls++;
  });
  await page.goto(`/t/${publicId}`);
  await openTournamentActions(page);
  await page.screenshot({
    path: info.outputPath("public-follow-menu.png"),
    fullPage: false,
  });
  await page.getByRole("button", { name: "Follow tournament" }).click();
  await expect(
    page.getByRole("button", { name: "Unfollow tournament" }),
  ).toBeVisible();
  await page.goto("/dashboard");
  const publicLink = page.locator(`a[href="/t/${publicId}"]`).last();
  await expect(publicLink).toBeVisible();
  await publicLink.click();
  await expect(page).toHaveURL(new RegExp(`/t/${publicId}$`));
  await openTournamentActions(page);
  await expect(
    page.getByRole("button", { name: "Unfollow tournament" }),
  ).toBeVisible();
  await page.goto("/dashboard");
  const following = page.locator(".following-section");
  await following
    .getByRole("button", { name: "Unfollow", exact: true })
    .click();
  await expect(
    following.getByText("You aren’t following any tournaments yet."),
  ).toBeVisible();
  await page.goto(`/t/${publicId}`);
  await openTournamentActions(page);
  await expect(
    page.getByRole("button", { name: "Follow tournament", exact: true }),
  ).toBeVisible();

  await page.goto("/dashboard");
  const accountButton = page.getByRole("button", {
    name: /^Account menu for /,
  });
  await accountButton.click();
  const accountBounds = await accountButton.boundingBox();
  const viewport = page.viewportSize();
  expect(
    accountBounds &&
      viewport &&
      accountBounds.x > viewport.width / 2 &&
      accountBounds.y < 100,
  ).toBeTruthy();
  await page.screenshot({
    path: info.outputPath("account-menu.png"),
    fullPage: false,
  });
  const settingsButton = page.getByRole("button", { name: "Profile settings" });
  await settingsButton.click();
  const dialog = page.getByRole("dialog", { name: "Profile settings" });
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate((): boolean =>
      Boolean(document.activeElement?.closest("dialog")),
    ),
  ).toBe(true);
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate((): boolean =>
      Boolean(document.activeElement?.closest("dialog")),
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(accountButton).toBeFocused();
  await openProfileSettings(page);
  const profileDialog = page.getByRole("dialog", { name: "Profile settings" });
  await profileDialog
    .getByLabel("Name")
    .fill(`Browser admin ${info.project.name}`);
  await profileDialog.getByRole("button", { name: "Save name" }).click();
  await expect(profileDialog.getByRole("status")).toContainText("Name updated");
  expect(
    await page.evaluate(
      (): boolean =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("profile-settings.png"),
    fullPage: false,
  });
  await profileDialog.getByLabel("Current password").nth(1).fill(user.password);
  await profileDialog
    .getByLabel("New password", { exact: true })
    .fill("BrowserArena2027!");
  await profileDialog.getByLabel("Confirm new password").fill(user.password);
  await expect(
    profileDialog.getByRole("button", { name: "Change password" }),
  ).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("profile-password.png"),
    fullPage: false,
  });
  await profileDialog
    .getByLabel("Confirm new password")
    .fill("BrowserArena2027!");
  await profileDialog.getByRole("button", { name: "Change password" }).click();
  await expect(page).toHaveURL(/\/auth\/login\?notice=password_updated/);
  await expect(page.getByRole("status")).toContainText("Password updated");
  await signIn(page, user, "BrowserArena2027!");
  expect(logoutCalls).toBe(0);
  await page.getByRole("button", { name: /^Account menu for / }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  expect(logoutCalls).toBe(1);
});
