import assert from "node:assert/strict";
import { test } from "node:test";
import type { AlertRow, IssueSummary } from "../src/lib/api";
import { alertMatchesEnvironmentFilter } from "./alert-environment";
import { alerts, buildIssues } from "./fixtures/seed";

const issues = buildIssues();
const issueById = new Map(issues.map((row) => [row.id, row]));
const resolveIssue = (id: string) => issueById.get(id);

test("production filter keeps ingest-cap and payload-scoped alerts (matches API SQL)", () => {
  const webProject = "550e8400-e29b-41d4-a716-446655440000";
  const scoped = alerts.filter((row) => row.project_id === webProject);
  const production = scoped.filter((row) =>
    alertMatchesEnvironmentFilter(row, "production", resolveIssue),
  );

  assert.ok(
    production.some((row) => row.kind === "ingest_cap_hit"),
    "project-wide ingest cap alerts should appear in every environment filter",
  );
  assert.ok(production.length >= 16, `expected most web alerts in production, got ${production.length}`);
});

test("staging-only issue alert is excluded from production filter", () => {
  const stagingOnly = alerts.find(
    (row) => row.kind === "new_issue" && row.issue_id === "a1000001-0000-4000-8000-000000000005",
  );
  assert.ok(stagingOnly);
  assert.equal(
    alertMatchesEnvironmentFilter(stagingOnly, "production", resolveIssue),
    false,
  );
});

test("payload environment overrides linked issue environment", () => {
  const row: AlertRow = {
    id: "test-override",
    org_id: "org",
    project_id: "proj",
    issue_id: "a1000001-0000-4000-8000-000000000005",
    kind: "custom",
    fired_at: new Date().toISOString(),
    payload_json: { environment: "production", title: "x" },
    read_at: null,
    ignored: false,
  };
  assert.equal(alertMatchesEnvironmentFilter(row, "production", resolveIssue), true);
});
