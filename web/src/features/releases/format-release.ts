import type { ReleaseSummary } from "../../lib/api";
import { formatRelativeTime } from "../../lib/format-time";

export function getReleasesPageDescription(
  projectName: string | null,
  count: number,
  loading: boolean,
): string {
  if (loading) {
    return "Loading releases…";
  }

  if (count === 0) {
    return projectName
      ? `Tag a release in your SDK to track deploys for ${projectName}.`
      : "Tag a release in your SDK to track deploys and anchor regressions.";
  }

  const noun = count === 1 ? "release" : "releases";
  return projectName
    ? `${count} ${noun} for ${projectName} — click a version to see its issues.`
    : `${count} ${noun} — click a version to see its issues.`;
}

export function formatReleaseMeta(release?: ReleaseSummary | null): string {
  if (!release) {
    return "No events yet";
  }

  const parts: string[] = [];

  if (release.first_seen_at && release.last_seen_at) {
    const first = formatRelativeTime(release.first_seen_at);
    const last = formatRelativeTime(release.last_seen_at);
    if (first === last) {
      parts.push(`seen ${last}`);
    } else {
      parts.push(`first seen ${first} · last seen ${last}`);
    }
  } else if (release.last_seen_at) {
    parts.push(`last seen ${formatRelativeTime(release.last_seen_at)}`);
  } else if (release.last_upload_at) {
    parts.push(`uploaded ${formatRelativeTime(release.last_upload_at)}`);
  } else {
    parts.push("No events yet");
  }

  const issueCount = release.issue_count ?? 0;
  if (issueCount > 0) {
    parts.push(
      `${issueCount} issue${issueCount === 1 ? "" : "s"}`,
    );
  }
  const eventCount = release.event_count ?? 0;
  if (eventCount > 0) {
    parts.push(
      `${eventCount} event${eventCount === 1 ? "" : "s"}`,
    );
  }
  const artifactCount = release.artifact_count ?? 0;
  if (artifactCount > 0) {
    parts.push(
      `${artifactCount} artifact${artifactCount === 1 ? "" : "s"}`,
    );
  }

  return parts.join(" · ");
}

export function formatReleaseDeltas(release?: ReleaseSummary | null): string | null {
  if (!release) {
    return null;
  }

  const parts: string[] = [];
  const regressionCount = release.regression_count ?? 0;
  const newIssueCount = release.new_issue_count ?? 0;

  if (regressionCount > 0) {
    parts.push(
      `+${regressionCount} came back`,
    );
  }
  if (newIssueCount > 0) {
    parts.push(`+${newIssueCount} new`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Example release tag used in empty-state SDK snippets. */
export const RELEASE_EXAMPLE_VERSION = "my-app@1.0.0";

export const RELEASE_CLI_HINT =
  "sentry-cli releases new $VERSION && sentry-cli releases files $VERSION upload-sourcemaps ./dist";
