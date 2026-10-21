import { test, expect } from "playwright/test";
import { setupMockApi } from "./support/mock-api";

test.describe("Web UI: Agency Health Matrix & Stability Report Modal", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test("renders health matrix dashboard with 4 executive stat cards", async ({ page }) => {
    await page.goto("/agency/matrix");

    // Title and badge
    await expect(page.getByText("Agency Client Fleet")).toBeVisible();
    await expect(page.getByText("Agency Tier · 25 Workspaces")).toBeVisible();

    // 4 Key Stat Cards
    await expect(page.getByText("Managed Workspaces")).toBeVisible();
    await expect(page.getByText("Combined 24h Traffic")).toBeVisible();
    await expect(page.getByText("Spike Loop Absorption")).toBeVisible();
    await expect(page.getByText("Crash-Free Average")).toBeVisible();

    // Zero Overage Guarantee indication
    await expect(page.getByText("Zero Overage Billing Guarantee")).toBeVisible();
  });

  test("displays client workspaces table with traffic and SLA stats", async ({ page }) => {
    await page.goto("/agency/matrix");

    // Client rows
    await expect(page.getByText("Acme FinTech Corp")).toBeVisible();
    await expect(page.getByText("app.acmefinance.io")).toBeVisible();
    await expect(page.getByText("Nordic Commerce Suite")).toBeVisible();
    await expect(page.getByText("HealthSync Mobile Clinic")).toBeVisible();

    // Spike protection column
    await expect(page.getByText(/absorbed \(\$0\)/).first()).toBeVisible();
  });

  test("filters client list in real-time by search query", async ({ page }) => {
    await page.goto("/agency/matrix");
    await expect(page.getByText("Acme FinTech Corp")).toBeVisible();

    const searchInput = page.getByPlaceholder("Filter clients by name, domain, industry, or tech stack...");
    await expect(searchInput).toBeVisible();

    // Search for "Nordic"
    await searchInput.fill("Nordic");
    await expect(page.getByText("Nordic Commerce Suite")).toBeVisible();
    await expect(page.getByText("Acme FinTech Corp")).toBeHidden();

    // Clear search
    await searchInput.fill("");
    await expect(page.getByText("Acme FinTech Corp")).toBeVisible();
  });

  test("opens weekly client production stability digest modal and handles actions", async ({ page }) => {
    await page.goto("/agency/matrix");

    // Click 'Report' button on Acme FinTech Corp
    const reportButtons = page.getByRole("button", { name: "Report" });
    await expect(reportButtons.first()).toBeVisible();
    await reportButtons.first().click();

    // Modal should open
    await expect(page.getByText("Weekly Client Production Stability Digest")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Generate an executive-ready, white-labeled performance digest")).toBeVisible();

    // Inputs inside modal
    await expect(page.getByText("Agency Brand Name")).toBeVisible();
    await expect(page.getByText("Target Client Workspace")).toBeVisible();
    await expect(page.getByText("Audit Period")).toBeVisible();

    // Metrics inside preview box
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.getByText("Crash-Free Sessions")).toBeVisible();
    await expect(dialog.getByText("Spike Loops Caught")).toBeVisible();
    await expect(dialog.getByText("Overages Billed", { exact: true })).toBeVisible();
    await expect(dialog.getByText("$0.00")).toBeVisible();
    await expect(dialog.getByText("AI Triage Patches")).toBeVisible();

    // Action buttons inside modal
    await expect(page.getByRole("button", { name: /copy markdown digest/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /print/i })).toBeVisible();

    const sendBtn = page.getByRole("button", { name: /send to client/i });
    await expect(sendBtn).toBeVisible();

    // Click 'Send to Client' and check modal closes
    await sendBtn.click();
    await expect(page.getByText("Weekly Client Production Stability Digest")).toBeHidden({ timeout: 5000 });
  });
});
