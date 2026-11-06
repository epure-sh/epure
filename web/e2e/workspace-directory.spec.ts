import { test, expect } from "playwright/test";
import type { BillingStatus, MeResponse, UserOrganization } from "../src/lib/api";
import { setupMockApi } from "./support/mock-api";

test("Scale owners manage workspaces and find MCP under their account", async ({ page }) => {
  await setupMockApi(page);
  const scale: UserOrganization = {
    id: "org-prod-1",
    name: "Main workspace",
    role: "owner",
    plan_tier: "scale",
    member_count: 1,
    is_current: true,
  };
  const childId = "new-workspace";
  let workspaces = [scale];
  let current = scale.id;

  await page.route("**/api/v1/auth/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const request = route.request();
    const currentName = () => workspaces.find((workspace) => workspace.id === current)?.name;
    if (path.endsWith("/me")) {
      const me: MeResponse = {
        user_id: "owner-1",
        org_id: current,
        role: "owner",
        email: "owner@epure.example",
        org_name: currentName(),
        display_name: null,
        has_password: true,
        google_linked: false,
        plan_tier: current === scale.id ? "scale" : "oss",
      };
      return route.fulfill({ json: me });
    }
    if (path.endsWith("/config")) {
      return route.fulfill({ json: { mcp_enabled: true } });
    }
    if (path.endsWith("/switch-org")) {
      current = request.postDataJSON().org_id;
      return route.fulfill({ json: { org_id: current, org_name: currentName(), role: "owner", success: true } });
    }
    if (path.endsWith("/organizations") && request.method() === "POST") {
      const body = request.postDataJSON();
      expect(body.billing_workspace_id).toBe(scale.id);
      workspaces.push({ ...scale, id: childId, name: body.name, plan_tier: "oss", billing_workspace_id: scale.id });
      return route.fulfill({ status: 201, json: { id: childId } });
    }
    if (path.endsWith("/organizations")) {
      return route.fulfill({ json: {
        scale_billing_workspace_id: scale.id,
        organizations: workspaces.map((workspace) => ({ ...workspace, is_current: workspace.id === current })),
      } });
    }
    if (path.endsWith("/organizations/" + childId) && request.method() === "PATCH") {
      const { name } = request.postDataJSON();
      workspaces = workspaces.map((workspace) => workspace.id === childId ? { ...workspace, name } : workspace);
      return route.fulfill({ status: 204 });
    }
    if (path.endsWith("/organizations/" + childId) && request.method() === "DELETE") {
      expect(request.postDataJSON().name).toBe("Client workspace");
      workspaces = workspaces.filter((workspace) => workspace.id !== childId);
      return route.fulfill({ status: 204 });
    }
    return route.fallback();
  });
  await page.route("**/api/v1/projects", (route) => current === childId
    ? route.fulfill({ json: { projects: [] } })
    : route.fallback());
  await page.route("**/api/v1/billing/status", (route) => {
    const linked = current === childId;
    const status: BillingStatus = {
      org_id: current,
      billing_workspace_id: linked ? scale.id : null,
      linked_workspace_count: linked ? 0 : workspaces.length - 1,
      plan_action: linked ? "included" : "change_plan",
      plan_tier: "scale",
      subscription_id: linked ? null : "sub-scale",
      subscription_status: "active",
      canary_expires_at: null,
      max_projects: 10,
      project_count: linked ? 0 : 1,
      monthly_events_included: 1_500_000,
      entitlement: { state: "active", reason: null, trial_ends_at: null, trial_days_left: null, can_ingest: true },
      usage: { events_this_month: 120_000, included: 1_500_000, over_quota: false, grace_events: 0, grace_exhausted: false },
    };
    return route.fulfill({ json: status });
  });
  await page.route("**/api/v1/user/connected-apps", (route) => route.fulfill({ json: { connected_apps: [] } }));

  await page.goto("/");
  await expect(page).toHaveURL(/\/organizations$/);
  await page.getByRole("button", { name: "Create workspace" }).click();
  const dialog = page.getByRole("dialog");
  const workspaceName = dialog.getByRole("textbox", { name: "Workspace name" });
  await workspaceName.fill("Client staging");
  await dialog.getByRole("button", { name: "Create workspace" }).click();
  const cardFor = (name: string) => page.locator('[data-slot="polar-card"]').filter({ has: page.getByRole("heading", { name }) });
  await cardFor("Client staging").getByRole("button", { name: "Rename" }).click();
  await workspaceName.fill("Client workspace");
  await dialog.getByRole("button", { name: "Rename workspace" }).click();
  const card = cardFor("Client workspace");
  await expect(card.getByText("Shared billing")).toBeVisible();
  await card.getByRole("button", { name: "Open workspace" }).click();
  await expect(page).toHaveURL(/\/projects$/);
  const directoryLink = page.getByRole("link", { name: "Workspaces", exact: true }).first();
  await directoryLink.click();
  await expect(card.getByText("Current", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Billing" }).click();
  await expect(page.getByText("Shared event quota this month")).toBeVisible();
  await expect(page.getByText("120,000 / 1,500,000")).toBeVisible();
  await expect(page.getByRole("button", { name: /upgrade|downgrade|manage subscription/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Open billing workspace" }).click();
  await expect(page.getByText("Plan, quota, and event volume for Main workspace.")).toBeVisible();
  await directoryLink.click();
  await card.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Delete workspace" })).toBeDisabled();
  await workspaceName.fill("Client workspace");
  await dialog.getByRole("button", { name: "Delete workspace" }).click();
  await expect(card).toHaveCount(0);

  await page.goto("/settings/connected-apps");
  await expect(page).toHaveURL(/\/user\/settings\/connected-apps$/);
  await expect(page.getByRole("navigation", { name: "User settings" })).toContainText("Connected Apps & CLI");
  await expect(page.getByText("No connected apps yet")).toBeVisible();
  await expect(page.getByText("http://localhost:4173/mcp")).toBeVisible();
});
