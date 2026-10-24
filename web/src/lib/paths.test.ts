import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  workspaceSettingsPath,
  settingsTabFromPath,
  projectSettingsPath,
  projectPath,
  isWorkspaceSettingsRoute,
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
    assert.equal(projectSettingsPath("proj-123", "dsn"), "/p/proj-123/settings/dsn");
  });

  it("identifies workspace settings routes", () => {
    assert.equal(isWorkspaceSettingsRoute("/settings"), true);
    assert.equal(isWorkspaceSettingsRoute("/settings/security"), true);
    assert.equal(isWorkspaceSettingsRoute("/usage"), true);
    assert.equal(isWorkspaceSettingsRoute("/p/proj-123/settings"), false);
  });
});
