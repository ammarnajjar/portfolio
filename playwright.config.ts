import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:5173",
    headless: false,
    viewport: { width: 1280, height: 800 },
    video: "on-first-retry",
  },
  timeout: 30000,
});
