import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  billingPath,
  workspacePath,
  workspaceSettingsPath,
  settingsTabFromPath,
  projectSettingsPath,
  projectAlertRulesPath,
  projectPath,
  isWorkspaceSettingsRoute,
  organizationsPath,
  userSettingsPath,
  isGlobalRoute,
  getNavigationContext,
} from "./paths";


describe("paths helpers for settings and releases", () => {
  it("computes workspace settings paths correctly", () => {
    assert.equal(workspaceSettingsPath(), "/settings");
    assert.equal(workspaceSettingsPath("general"), "/settings");
    assert.equal(workspaceSettingsPath("security"), "/settings/security");
    assert.equal(workspaceSettingsPath("agent"), "/settings/agent");
  });

  it("extracts settings tab from path accurately", () => {
    assert.equal(settingsTabFromPath("/settings"), "general");
    assert.equal(settingsTabFromPath("/settings/security"), "security");
    assert.equal(settingsTabFromPath("/settings/agent"), "agent");
    assert.equal(settingsTabFromPath("/settings/connected-apps"), "connected-apps");
    assert.equal(settingsTabFromPath("/settings/operations"), "operations");
  });

  it("computes project releases and settings paths", () => {
    assert.equal(projectPath("proj-123", "releases"), "/p/proj-123/releases");
    assert.equal(projectSettingsPath("proj-123"), "/p/proj-123/settings");
    assert.equal(projectSettingsPath("proj-123", "filters"), "/p/proj-123/settings/filters");
    assert.equal(projectSettingsPath("proj-123", "privacy"), "/p/proj-123/settings/privacy");
    assert.equal(projectSettingsPath("proj-123", "dsn"), "/p/proj-123/settings/dsn");
    assert.equal(
      projectAlertRulesPath("proj-123"),
      "/p/proj-123/alerts?section=configure",
    );
  });

  it("identifies workspace settings routes", () => {
    assert.equal(isWorkspaceSettingsRoute("/settings"), true);
    assert.equal(isWorkspaceSettingsRoute("/settings/security"), true);
    assert.equal(isWorkspaceSettingsRoute("/usage"), true);
    assert.equal(isWorkspaceSettingsRoute("/p/proj-123/settings"), false);
  });

  it("computes workspace navigation paths correctly", () => {
    assert.equal(workspacePath(), "/");
    assert.equal(workspacePath("team"), "/team");
    assert.equal(workspacePath("billing"), "/billing");
    assert.equal(billingPath(), "/billing");
  });

  it("computes global routes and contextual navigation correctly", () => {
    assert.equal(organizationsPath(), "/");
    assert.equal(userSettingsPath(), "/user/settings");
    assert.equal(userSettingsPath("security"), "/user/settings/security");
    assert.equal(userSettingsPath("agent"), "/user/settings/agent");

    assert.equal(isGlobalRoute("/organizations"), false);
    assert.equal(isGlobalRoute("/orgs"), false);
    assert.equal(isGlobalRoute("/user/settings"), true);
    assert.equal(isGlobalRoute("/user/settings/security"), true);
    assert.equal(isGlobalRoute("/user"), true);
    assert.equal(isGlobalRoute("/"), false);
    assert.equal(isGlobalRoute("/team"), false);
    assert.equal(isGlobalRoute("/settings"), false);
    assert.equal(isGlobalRoute("/p/proj-123/issues"), false);

    assert.equal(getNavigationContext("/user/settings"), "global");
    assert.equal(getNavigationContext("/"), "organization");
    assert.equal(getNavigationContext("/team"), "organization");
    assert.equal(getNavigationContext("/settings"), "organization");
    assert.equal(getNavigationContext("/p/proj-123/issues"), "project");
    assert.equal(getNavigationContext("/p/proj-123/monitoring"), "project");
  });
});

