import { test, expect } from "playwright/test";
import { setupMockApi } from "./support/mock-api";

test.describe("Web UI: DSN Keys & Dual-Sending Card", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test("renders active DSN keys and Zero-Risk Dual-Sending Card", async ({ page }) => {
    await page.goto("/p/proj-1/settings/dsn");

    // Header and navigation
    await expect(page.getByRole("heading", { name: "SDK connection" })).toBeVisible();
    await expect(page.getByText("Active connection string")).toBeVisible();

    // Dual sending card title and badge
    const dualCard = page.locator(".border-accent\\/40");
    await expect(dualCard).toBeVisible();
    await expect(dualCard.getByText("Zero-Risk Migration: 6-Line Dual-Sending Tee")).toBeVisible();
    await expect(dualCard.getByText("Shadow Traffic")).toBeVisible();
    await expect(dualCard.getByText("100% Sentry Compatible")).toBeVisible();

    // Direct Ingest Envelope Endpoint block
    await expect(dualCard.getByText("Direct Ingest Envelope Endpoint")).toBeVisible();
    await expect(dualCard.locator("p.font-mono").filter({ hasText: "/api/42/envelope/" })).toBeVisible();
  });

  test("switches between Next.js, Node.js, Browser, and Python dual transport snippets", async ({ page }) => {
    await page.goto("/p/proj-1/settings/dsn");
    const dualCard = page.locator(".border-accent\\/40");
    await expect(dualCard).toBeVisible();

    // Next.js snippet active by default
    await expect(dualCard.getByText("@sentry/nextjs")).toBeVisible();

    // Switch to Node.js tab
    const nodeTab = dualCard.getByRole("tab", { name: "Node.js" });
    await nodeTab.click();
    await expect(dualCard.getByText("@sentry/node")).toBeVisible();

    // Switch to Browser tab
    const browserTab = dualCard.getByRole("tab", { name: "Browser" });
    await browserTab.click();
    await expect(dualCard.getByText("@sentry/browser")).toBeVisible();

    // Switch to Python tab
    const pythonTab = dualCard.getByRole("tab", { name: "Python" });
    await pythonTab.click();
    await expect(dualCard.getByText("class DualTransport(HttpTransport):")).toBeVisible();
  });
});
