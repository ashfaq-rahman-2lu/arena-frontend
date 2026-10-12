import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: [
    {
      command:
        process.env.BROWSER_USE_PAGES === "true"
          ? "npm run build && npm run pages:preview"
          : "npm run build && npm run preview -- --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      env: {
        VITE_API_BASE_URL:
          process.env.BROWSER_DIRECT_API === "true"
            ? (process.env.BROWSER_API_URL ?? "http://127.0.0.1:3001")
            : "",
        API_PROXY_URL: process.env.BROWSER_API_URL ?? "http://127.0.0.1:3001",
      },
      timeout: 60000,
    },
  ],
});
