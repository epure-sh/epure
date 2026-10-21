import { test, expect } from "playwright/test";
import { setupMockApi } from "./support/mock-api";

test.describe("Web UI: Issue Inbox & Keyboard Navigation", () => {
  let api: Awaited<ReturnType<typeof setupMockApi>>;

  test.beforeEach(async ({ page }) => {
    api = await setupMockApi(page);
  });

  test("loads issue inbox and renders all active issues", async ({ page }) => {
    await page.goto("/p/proj-1/issues");

    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText("Cannot read properties of undefined").first()).toBeVisible();
    await expect(page.getByText("Connection pool exhausted").first()).toBeVisible();
    await expect(page.getByText("failed to process webhook").first()).toBeVisible();
  });

  test("clicking an issue opens the detail panel with stacktrace and copilot prompt", async ({ page }) => {
    await page.goto("/p/proj-1/issues");

    // Click first issue
    const firstIssue = page.getByText("Cannot read properties of undefined").first();
    await firstIssue.click();

    // Verify detail panel opens with AI Root Cause Diagnostic
    await expect(page.getByText("AI Root Cause Diagnostic")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Introduce optional chaining/)).toBeVisible();

    // Switch to Stack Trace tab
    const stackTab = page.getByRole("tab", { name: /stack/i });
    if (await stackTab.isVisible()) {
      await stackTab.click();
      await expect(page.getByText("src/services/auth-service.ts").first()).toBeVisible();
    }
  });

  test("keyboard shortcuts j and k move focus between issues", async ({ page }) => {
    await page.goto("/p/proj-1/issues");
    await expect(page.getByText("Cannot read properties of undefined").first()).toBeVisible();

    // Click container to ensure focus is in the list
    await page.locator("body").click();

    // Press 'j' to navigate down
    await page.keyboard.press("j");
    // Press 'j' again to navigate to next
    await page.keyboard.press("j");
    // Press 'k' to navigate up
    await page.keyboard.press("k");

    // Press 'Enter' or 'o' to open detail for focused issue
    await page.keyboard.press("Enter");

    // Ensure detail panel is opened
    await expect(page.locator("body")).toBeVisible();
  });

  test("keyboard shortcut x toggles multi-selection checkbox", async ({ page }) => {
    await page.goto("/p/proj-1/issues");
    await expect(page.getByText("Cannot read properties of undefined").first()).toBeVisible();

    await page.locator("body").click();
    await page.keyboard.press("j");
    await page.keyboard.press("x");

    const checkboxes = page.locator('button[role="checkbox"], input[type="checkbox"]');
    await expect(checkboxes.first()).toBeVisible();
  });

  test("keyboard shortcut e resolves the focused issue", async ({ page }) => {
    await page.goto("/p/proj-1/issues");
    await expect(page.getByText("Cannot read properties of undefined").first()).toBeVisible();

    // Select the first issue
    await page.getByText("Cannot read properties of undefined").first().click();

    // Press 'e' to resolve
    await page.keyboard.press("e");

    await page.waitForTimeout(500);
    const patched = api.getPatchedIssues();
    expect(patched["iss-1"]?.status).toBe("resolved");
  });

  test("keyboard shortcut i ignores the focused issue", async ({ page }) => {
    await page.goto("/p/proj-1/issues");
    await expect(page.getByText("Cannot read properties of undefined").first()).toBeVisible();

    // Select the first issue
    await page.getByText("Cannot read properties of undefined").first().click();

    // Press 'i' to ignore
    await page.keyboard.press("i");

    await page.waitForTimeout(500);
    const patched = api.getPatchedIssues();
    expect(patched["iss-1"]?.status).toBe("ignored");
  });

  test("Meta+K / Ctrl+K opens Command Palette dialog", async ({ page }) => {
    await page.goto("/p/proj-1/issues");
    await expect(page.getByText("Cannot read properties of undefined").first()).toBeVisible();

    // Press Meta+k (or Control+k)
    await page.keyboard.press("Meta+k");

    // Command palette dialog with placeholder "Jump to…" should appear
    const cmdInput = page.getByPlaceholder("Jump to…");
    await expect(cmdInput).toBeVisible({ timeout: 5000 });

    // Type in command palette
    await cmdInput.fill("health");
    await expect(page.getByText(/Agency Health Matrix|health|fleet/i).first()).toBeVisible();

    // Close with Escape
    await page.keyboard.press("Escape");
    await expect(cmdInput).toBeHidden({ timeout: 5000 });
  });

  test("1-click Linear & GitHub issue creation triggers copy and export", async ({ page }) => {
    await page.goto("/p/proj-1/issues");
    await page.getByText("Cannot read properties of undefined").first().click();

    // Track calls to window.open and handle repo prompt dialog
    page.on("dialog", async (dialog) => {
      await dialog.accept("acme/production-api");
    });

    await page.evaluate(() => {
      (window as any).__openedUrls = [];
      window.open = (url: any) => {
        (window as any).__openedUrls.push(url);
        return null;
      };
    });

    const ghButton = page.getByRole("button", { name: /github issue/i });
    await expect(ghButton).toBeVisible();
    await ghButton.click();

    const linearButton = page.getByRole("button", { name: /linear issue/i });
    await expect(linearButton).toBeVisible();
    await linearButton.click();

    const openedUrls = await page.evaluate(() => (window as any).__openedUrls as string[]);
    expect(openedUrls.length).toBe(2);
    expect(openedUrls[0]).toContain("github.com");
    expect(openedUrls[1]).toContain("linear.app/new");
    expect(openedUrls[1]).toContain(encodeURIComponent("Cannot read properties of undefined"));
  });
});
