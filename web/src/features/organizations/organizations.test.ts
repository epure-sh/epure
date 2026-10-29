import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getNavigationContext,
  isGlobalRoute,
  isProjectRoute,
  isWorkspaceRoute,
  organizationsPath,
  userSettingsPath,
} from "../../lib/paths";
import { extractInviteToken } from "./invite-token";

describe("contextual navigation hierarchy & global routes", () => {
  it("determines global navigation context for user settings only", () => {
    assert.equal(getNavigationContext(organizationsPath()), "organization");
    assert.equal(getNavigationContext(userSettingsPath()), "global");
    assert.equal(getNavigationContext("/user/settings"), "global");
    assert.equal(getNavigationContext("/user/settings/security"), "global");
    assert.equal(getNavigationContext("/user/settings/agent"), "global");
    assert.equal(getNavigationContext("/user"), "global");
  });

  it("determines organization navigation context for workspace routes", () => {
    assert.equal(getNavigationContext("/"), "organization");
    assert.equal(getNavigationContext("/team"), "organization");
    assert.equal(getNavigationContext("/billing"), "organization");
    assert.equal(getNavigationContext("/usage"), "organization");
    assert.equal(getNavigationContext("/org/channels"), "organization");
    assert.equal(getNavigationContext("/settings"), "organization");
    assert.equal(getNavigationContext("/settings/security"), "organization");
    assert.equal(getNavigationContext("/settings/agent"), "organization");
  });

  it("determines project navigation context for project-scoped routes", () => {
    assert.equal(getNavigationContext("/p/proj-alpha/issues"), "project");
    assert.equal(getNavigationContext("/p/proj-alpha/monitoring"), "project");
    assert.equal(getNavigationContext("/p/proj-alpha/alerts"), "project");
    assert.equal(getNavigationContext("/p/proj-alpha/releases"), "project");
    assert.equal(getNavigationContext("/p/proj-alpha/monitors"), "project");
    assert.equal(getNavigationContext("/p/proj-alpha/settings"), "project");
  });

  it("correctly identifies global routes vs workspace and project routes", () => {
    assert.equal(isGlobalRoute("/organizations"), false);
    assert.equal(isGlobalRoute("/orgs"), false);
    assert.equal(isGlobalRoute("/user/settings"), true);
    assert.equal(isGlobalRoute("/user"), true);

    assert.equal(isGlobalRoute("/"), false);
    assert.equal(isGlobalRoute("/team"), false);
    assert.equal(isGlobalRoute("/billing"), false);
    assert.equal(isGlobalRoute("/p/proj-123/issues"), false);

    assert.equal(isProjectRoute("/p/proj-123/issues"), true);
    assert.equal(isProjectRoute("/organizations"), false);

    assert.equal(isWorkspaceRoute("/user/settings"), false);
    assert.equal(isWorkspaceRoute("/"), true);
    assert.equal(isWorkspaceRoute("/team"), true);
    assert.equal(isWorkspaceRoute("/billing"), true);
    assert.equal(isWorkspaceRoute("/p/proj-123/issues"), false);
  });
});

describe("organisations permissions & filtering logic", () => {
  interface MockOrg {
    id: string;
    name: string;
    role: "owner" | "admin" | "member";
    plan_tier: string;
    member_count: number;
    is_current: boolean;
  }

  const sampleOrgs: MockOrg[] = [
    {
      id: "org-1",
      name: "Acme Production",
      role: "owner",
      plan_tier: "enterprise",
      member_count: 12,
      is_current: true,
    },
    {
      id: "org-2",
      name: "Staging Labs",
      role: "admin",
      plan_tier: "pro",
      member_count: 5,
      is_current: false,
    },
    {
      id: "org-3",
      name: "Community Open Source",
      role: "member",
      plan_tier: "free",
      member_count: 42,
      is_current: false,
    },
  ];

  function filterOrgs(orgs: MockOrg[], query: string): MockOrg[] {
    const q = query.toLowerCase().trim();
    if (!q) return orgs;
    return orgs.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        org.role.toLowerCase().includes(q) ||
        org.plan_tier.toLowerCase().includes(q),
    );
  }

  function canManageOrg(role: string): boolean {
    return role === "owner" || role === "admin";
  }

  function canManageBilling(role: string): boolean {
    return role === "owner";
  }

  it("filters organisations by name query case-insensitively", () => {
    const results = filterOrgs(sampleOrgs, "acme");
    assert.equal(results.length, 1);
    assert.equal(results[0]?.name, "Acme Production");
  });

  it("filters organisations by role query", () => {
    const admins = filterOrgs(sampleOrgs, "admin");
    assert.equal(admins.length, 1);
    assert.equal(admins[0]?.name, "Staging Labs");

    const owners = filterOrgs(sampleOrgs, "owner");
    assert.equal(owners.length, 1);
    assert.equal(owners[0]?.name, "Acme Production");
  });

  it("filters organisations by plan tier", () => {
    const free = filterOrgs(sampleOrgs, "free");
    assert.equal(free.length, 1);
    assert.equal(free[0]?.name, "Community Open Source");
  });

  it("returns all organisations when search query is empty or only whitespace", () => {
    assert.equal(filterOrgs(sampleOrgs, "").length, 3);
    assert.equal(filterOrgs(sampleOrgs, "   ").length, 3);
  });

  it("enforces user rights based on role", () => {
    // Owner permissions
    assert.equal(canManageOrg("owner"), true);
    assert.equal(canManageBilling("owner"), true);

    // Admin permissions
    assert.equal(canManageOrg("admin"), true);
    assert.equal(canManageBilling("admin"), false);

    // Member permissions
    assert.equal(canManageOrg("member"), false);
    assert.equal(canManageBilling("member"), false);
  });
});

describe("extractInviteToken robust parser", () => {
  it("extracts raw UUID tokens directly", () => {
    assert.equal(
      extractInviteToken("d290f1ee-6c54-4b01-90e6-d701748f0851"),
      "d290f1ee-6c54-4b01-90e6-d701748f0851",
    );
    assert.equal(
      extractInviteToken("   d290f1ee-6c54-4b01-90e6-d701748f0851   "),
      "d290f1ee-6c54-4b01-90e6-d701748f0851",
    );
  });

  it("extracts token from standard URL search params", () => {
    assert.equal(
      extractInviteToken("https://epure.cloud/accept-invitation?token=d290f1ee-6c54-4b01-90e6-d701748f0851"),
      "d290f1ee-6c54-4b01-90e6-d701748f0851",
    );
    assert.equal(
      extractInviteToken("https://epure.cloud/join?invite=my-secure-token-123"),
      "my-secure-token-123",
    );
    assert.equal(
      extractInviteToken("https://epure.cloud/orgs/join?invite_token=special_invite"),
      "special_invite",
    );
    assert.equal(
      extractInviteToken("https://epure.cloud/orgs/join?invitation_token=alpha_beta"),
      "alpha_beta",
    );
    assert.equal(
      extractInviteToken("https://epure.cloud/invite?t=short-tok"),
      "short-tok",
    );
  });

  it("extracts token from path-based invitation URLs", () => {
    assert.equal(
      extractInviteToken("https://epure.cloud/invite/d290f1ee-6c54-4b01-90e6-d701748f0851"),
      "d290f1ee-6c54-4b01-90e6-d701748f0851",
    );
    assert.equal(
      extractInviteToken("https://epure.cloud/invitation/team-secret-invite-token"),
      "team-secret-invite-token",
    );
    assert.equal(
      extractInviteToken("https://epure.cloud/accept-invitation/abc-xyz-token"),
      "abc-xyz-token",
    );
  });

  it("extracts embedded UUID when URL has custom query params and hash", () => {
    assert.equal(
      extractInviteToken("https://app.epure.sh/team/join?utm_source=slack&token=d290f1ee-6c54-4b01-90e6-d701748f0851#welcome"),
      "d290f1ee-6c54-4b01-90e6-d701748f0851",
    );
  });

  it("handles empty or whitespace-only inputs gracefully", () => {
    assert.equal(extractInviteToken(""), "");
    assert.equal(extractInviteToken("   "), "");
  });
});

