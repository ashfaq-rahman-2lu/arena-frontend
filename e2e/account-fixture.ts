import Ajv from "ajv";
import { expect, type Page } from "@playwright/test";
export interface BrowserAccount {
  email: string;
  password: string;
  userId: string;
  tournaments: { id: string; publicId: string; name: string }[];
}
interface CapturedMail {
  to: string;
  text: string;
  subject: string;
}
const ajv = new Ajv();
const validateAccount = ajv.compile<BrowserAccount>({
  type: "object",
  required: ["email", "password", "userId", "tournaments"],
  properties: {
    email: { type: "string" },
    password: { type: "string" },
    userId: { type: "string" },
    tournaments: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "publicId", "name"],
        properties: {
          id: { type: "string" },
          publicId: { type: "string" },
          name: { type: "string" },
        },
      },
    },
  },
});
const validateMail = ajv.compile<CapturedMail[]>({
  type: "array",
  items: {
    type: "object",
    required: ["to", "text", "subject"],
    properties: {
      to: { type: "string" },
      text: { type: "string" },
      subject: { type: "string" },
    },
  },
});
export async function account(
  page: Page,
  kind: "password" | "google" = "password",
  follows: number = 0,
): Promise<BrowserAccount> {
  const response = await page.request.post(
    "http://127.0.0.1:3001/__test/accounts",
    { data: { kind, follows } },
  );
  expect(response.ok()).toBe(true);
  const value: unknown = await response.json();
  if (!validateAccount(value))
    throw new Error(ajv.errorsText(validateAccount.errors));
  return value;
}
export async function signIn(
  page: Page,
  user: BrowserAccount,
  password: string = user.password,
): Promise<void> {
  await page.goto("/auth/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
export async function google(
  page: Page,
  email: string,
  outcome: "Approve" | "Cancel" | "Fail" = "Approve",
): Promise<void> {
  await expect(
    page.getByRole("heading", { name: "Local fake Google" }),
  ).toBeVisible();
  await page.getByLabel("Google email").fill(email);
  await page.getByRole("button", { name: `${outcome} Google` }).click();
}
export async function mailLink(page: Page, email: string): Promise<string> {
  const response = await page.request.get(
    `http://127.0.0.1:3001/__test/mail?email=${encodeURIComponent(email)}`,
  );
  const value: unknown = await response.json();
  if (!validateMail(value))
    throw new Error(ajv.errorsText(validateMail.errors));
  const text = value.at(-1)?.text;
  const link = text?.match(/http:\/\/127\.0\.0\.1:5174\/auth\/[^\s]+/)?.[0];
  if (!link) throw new Error("No captured account-action link");
  return link;
}

export async function openTournamentActions(page: Page): Promise<void> {
  const trigger = page.getByRole("button", {
    name: "Tournament actions",
    exact: true,
  });
  await expect(trigger).toBeVisible();
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
}

export async function openProfileSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Account menu for / }).click();
  await page
    .getByRole("button", { name: "Profile settings", exact: true })
    .click();
}
