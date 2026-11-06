import { test, expect } from "playwright/test";
import { setupMockApi } from "./support/mock-api";

test.describe("Project client keys", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test("shows active keys and masks the project DSN", async ({ page }) => {
    await page.goto("/p/proj-1/settings/dsn");

    await expect(page.getByRole("heading", { name: "Client keys" })).toBeVisible();
    const key = page.getByRole("listitem").filter({ hasText: "production-primary" });
    await expect(key.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "DSN (masked)", exact: true })).toHaveValue(/•+@localhost:\d+\/42$/);
  });

  test("reveals and hides the DSN", async ({ page }) => {
    await page.goto("/p/proj-1/settings/dsn");
    const dsn = page.getByRole("group", { name: "DSN", exact: true });
    await dsn.getByRole("button", { name: "Show DSN" }).click();
    await expect(dsn.getByRole("textbox")).toHaveValue(/pub_live_canary_key@localhost:\d+\/42$/);
    await dsn.getByRole("button", { name: "Hide DSN" }).click();
    await expect(dsn.getByRole("textbox")).toHaveValue(/•+@localhost:\d+\/42$/);
  });
});
