import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PLAYGROUND_PORT ?? 5173);

export default defineConfig({
  testDir: "./playground",
  testMatch: "playground-smoke.spec.ts",
  timeout: 60_000,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    ...devices["Desktop Chrome"],
  },
});
