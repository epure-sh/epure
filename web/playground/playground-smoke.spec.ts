import { test, expect } from "@playwright/test";

const PROJECT_WEB = "550e8400-e29b-41d4-a716-446655440000";

test.describe("Playground smoke", () => {
  test("Alerts history loads seeded rows and detail actions", async ({ page }) => {
    await page.goto(`/p/${PROJECT_WEB}/alerts`);
    await expect(page.getByRole("heading", { name: "Alerts" })).toBeVisible({ timeout: 15_000 });
    const rows = page.locator("[data-alert-id]");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    await rows.first().click();
    await expect(page.getByRole("button", { name: "Acknowledge" })).toBeVisible();
  });

  test("Design kit alerts section renders", async ({ page }) => {
    await page.goto("/__design");
    await expect(page.getByRole("heading", { name: "Alerts patterns" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Payment guard — production").first()).toBeVisible();
  });

  test("Design kit catalogs ui, kit, and feature-ui anchors", async ({ page }) => {
    await page.goto("/__design");
    await expect(page.getByRole("heading", { name: "Feature UI (`src/ui`)" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("#button")).toBeVisible();
    await expect(page.locator("#page-shell")).toBeVisible();
    await expect(page.locator("#issue-row")).toBeVisible();
    await expect(page.locator("#action-button")).toBeVisible();
  });
});
