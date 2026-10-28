import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const projectId = "550e8400-e29b-41d4-a716-446655440000";
const base = `http://localhost:5173/p/${projectId}/alerts`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(base, { waitUntil: "networkidle" });
await page.waitForSelector("[data-alert-id]", { timeout: 15000 });
await page.screenshot({ path: path.join(dir, "pw-01-empty-selection.png"), fullPage: false });

const aside = page.locator('aside[aria-label="Alert detail"]');
await aside.screenshot({ path: path.join(dir, "pw-01-empty-right-panel.png") });

await page.locator("[data-alert-id]").nth(1).click();
await page.waitForSelector('aside[aria-label="Alert detail"] >> text=Resolve');
await page.screenshot({ path: path.join(dir, "pw-02-detail-selected.png"), fullPage: false });
await aside.screenshot({ path: path.join(dir, "pw-02-detail-right-panel.png") });

const structuredAlertId = "f1000001-0000-4000-8000-000000000003";
await page.locator(`[data-alert-id="${structuredAlertId}"]`).click();
await aside.getByText("At a glance").waitFor({ state: "visible", timeout: 10000 });
await aside.screenshot({ path: path.join(dir, "pw-detail-v3-structured.png") });

await page.getByRole("button", { name: /Checkout bundle/i }).click();
await page.waitForTimeout(300);
await aside.screenshot({ path: path.join(dir, "pw-03-multi-issue-panel.png") });

await page.getByRole("radio", { name: /Rules/i }).click();
await page.waitForSelector("text=Create rule", { timeout: 10000 });
await page.screenshot({ path: path.join(dir, "pw-04-rules-section.png"), fullPage: false });

// Rule history filter chip (Rules → View history → History toolbar)
const ruleName = "Production error spike";
await page.getByRole("button", { name: new RegExp(`Actions for ${ruleName}`, "i") }).click();
await page.getByRole("menuitem", { name: /View history/i }).click();
await page.getByRole("radio", { name: /^History/i }).waitFor({ state: "visible", timeout: 10000 });
await page.waitForFunction(() => {
  const history = [...document.querySelectorAll('[role="radio"]')].find((node) =>
    /^History/i.test(node.getAttribute("aria-label") ?? node.textContent ?? ""),
  );
  return history?.getAttribute("aria-checked") === "true" || history?.getAttribute("data-state") === "on";
});
const ruleChip = page.locator(".epure-filter-chip--query").filter({ hasText: "rule" });
await ruleChip.waitFor({ state: "visible", timeout: 10000 });
const rows = page.locator("article[data-alert-id]");
await rows.first().waitFor({ state: "visible", timeout: 15000 });
const countWithFilter = await rows.count();
await page.screenshot({
  path: path.join(dir, "pw-05-rule-filter-chip-with-rows.png"),
  fullPage: false,
});
await ruleChip.getByRole("button", { name: new RegExp(`Remove ${ruleName} filter`, "i") }).click();
await ruleChip.waitFor({ state: "hidden", timeout: 5000 });
const countAfterClear = await rows.count();
if (countAfterClear <= countWithFilter) {
  throw new Error(
    `Rule filter dismiss did not expand list: before=${countWithFilter} after=${countAfterClear}`,
  );
}

// Visual audit for Create Rule Wizard & Templates
await page.getByRole("radio", { name: /Rules/i }).click();
await page.waitForSelector("text=Create rule", { timeout: 10000 });
await page.getByRole("button", { name: /Create rule/i }).click();
await page.waitForSelector("text=Select trigger template", { timeout: 10000 });
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(dir, "pw-06-create-rule-templates.png"), fullPage: false });

await page.getByRole("button", { name: /Continue/i }).click();
await page.waitForSelector("text=Trigger logic", { timeout: 10000 });
await page.screenshot({ path: path.join(dir, "pw-07-rule-conditions.png"), fullPage: false });

// Visual audit for Compact Setup Page
await page.goto(`http://localhost:5173/p/${projectId}/setup`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Setup", { timeout: 10000 });
await page.screenshot({ path: path.join(dir, "pw-08-setup-compact.png"), fullPage: false });

await browser.close();
