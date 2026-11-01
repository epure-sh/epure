import { test, expect } from "@playwright/test";

const PROJECT_WEB = "550e8400-e29b-41d4-a716-446655440000";

test.describe("Playground smoke", () => {
  test("Alerts history loads seeded rows and detail actions", async ({ page }) => {
    await page.goto(`/p/${PROJECT_WEB}/alerts`);
    const rows = page.locator("[data-alert-id]");
    await expect(rows.first()).toBeVisible({ timeout: 15_000 });
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    await rows.first().click();
    const detail = page.getByRole("complementary", { name: "Alert detail" });
    await expect(detail.getByRole("button", { name: "Resolve", exact: true })).toBeVisible();
    await expect(detail.getByRole("button", { name: "Snooze", exact: true })).toBeVisible();
  });

  test("Design kit three-tier catalog anchors are present on canvas", async ({ page }) => {
    await page.goto("/__design?view=canvas");
    await expect(page.getByText("Epure Design System").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("02 Primitives", { exact: true })).toBeVisible();
    await expect(page.getByText("03 Components", { exact: true })).toBeVisible();
    await expect(page.getByText("04 Blocks", { exact: true })).toBeVisible();
    await expect(page.locator("#button")).toBeVisible();
    await expect(page.locator("#page-shell")).toBeVisible();
    await expect(page.locator("#issue-row")).toBeVisible();
    await expect(page.locator("#action-button")).toBeVisible();
  });
});
