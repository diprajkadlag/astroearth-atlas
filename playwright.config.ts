import { defineConfig, devices } from "@playwright/test";

/**
 * Browser checks against the production build, served by `vite preview`.
 *
 * All projects run Chromium. The iPhone descriptor defaults to WebKit, but
 * these checks cover layout, network requests and accessibility, which
 * Chromium's mobile emulation handles. Real iOS Safari still needs a check by
 * hand on a device.
 */
const PORT = 4748;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  outputDir: "e2e-artifacts/results",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "e2e-artifacts/report" }],
  ],
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: {
      // Software WebGL, so the 3D scene can mount in headless Chromium.
      // Scene tests read positions from a debug hook, never from pixels.
      args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    command: "npm run build && npm run preview -- --host 127.0.0.1",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
  projects: [
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "iphone-se",
      use: { ...devices["iPhone SE"], browserName: "chromium" },
    },
    {
      name: "narrow-320",
      use: {
        ...devices["iPhone SE"],
        browserName: "chromium",
        viewport: { width: 320, height: 568 },
      },
    },
    {
      name: "pixel-7",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
