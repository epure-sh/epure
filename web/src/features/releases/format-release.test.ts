import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatReleaseDeltas,
  formatReleaseMeta,
  getReleasesPageDescription,
} from "./format-release";
import type { ReleaseSummary } from "../../lib/api";

describe("format-release", () => {
  const baseRelease: ReleaseSummary = {
    id: "rel-1",
    project_id: "p-1",
    version: "api@1.8.0",
    artifact_count: 0,
    last_upload_at: null,
    first_seen_at: null,
    last_seen_at: null,
    issue_count: 0,
    event_count: 0,
    regression_count: 0,
    new_issue_count: 0,
  };

  it("handles loading and empty descriptions", () => {
    assert.equal(getReleasesPageDescription("Backend", 0, true), "Loading releases…");
    assert.equal(
      getReleasesPageDescription("Backend", 0, false),
      "Tag a release in your SDK to track deploys for Backend.",
    );
    assert.equal(
      getReleasesPageDescription(null, 0, false),
      "Tag a release in your SDK to track deploys and anchor regressions.",
    );
    assert.equal(
      getReleasesPageDescription("Backend", 1, false),
      "1 release for Backend — click a version to see its issues.",
    );
    assert.equal(
      getReleasesPageDescription("Backend", 3, false),
      "3 releases for Backend — click a version to see its issues.",
    );
  });

  it("formats metadata with no events", () => {
    assert.equal(formatReleaseMeta(baseRelease), "No events yet");
  });

  it("formats metadata with artifacts only", () => {
    const rel: ReleaseSummary = {
      ...baseRelease,
      artifact_count: 2,
      last_upload_at: new Date(Date.now() - 3600_000).toISOString(),
    };
    const meta = formatReleaseMeta(rel);
    assert.ok(meta.includes("uploaded 1h ago"));
    assert.ok(meta.includes("2 artifacts"));
  });

  it("formats metadata with events and issues", () => {
    const rel: ReleaseSummary = {
      ...baseRelease,
      issue_count: 5,
      event_count: 42,
      first_seen_at: new Date(Date.now() - 7200_000).toISOString(),
      last_seen_at: new Date(Date.now() - 60_000).toISOString(),
    };
    const meta = formatReleaseMeta(rel);
    assert.ok(meta.includes("first seen 2h ago · last seen 1m ago"));
    assert.ok(meta.includes("5 issues"));
    assert.ok(meta.includes("42 events"));
  });

  it("formats deltas with regressions and new issues", () => {
    assert.equal(formatReleaseDeltas(baseRelease), null);

    const withRegressions: ReleaseSummary = {
      ...baseRelease,
      regression_count: 2,
      new_issue_count: 3,
    };
    assert.equal(formatReleaseDeltas(withRegressions), "+2 came back · +3 new");
  });
});
