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

export function formatReleaseMeta(release: ReleaseSummary): string {
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

  if (release.issue_count > 0) {
    parts.push(
      `${release.issue_count} issue${release.issue_count === 1 ? "" : "s"}`,
    );
  }
  if (release.event_count > 0) {
    parts.push(
      `${release.event_count} event${release.event_count === 1 ? "" : "s"}`,
    );
  }
  if (release.artifact_count > 0) {
    parts.push(
      `${release.artifact_count} artifact${release.artifact_count === 1 ? "" : "s"}`,
    );
  }

  return parts.join(" · ");
}

export function formatReleaseDeltas(release: ReleaseSummary): string | null {
  const parts: string[] = [];

  if (release.regression_count > 0) {
    parts.push(
      `+${release.regression_count} came back`,
    );
  }
  if (release.new_issue_count > 0) {
    parts.push(`+${release.new_issue_count} new`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Example release tag used in empty-state SDK snippets. */
export const RELEASE_EXAMPLE_VERSION = "my-app@1.0.0";

export const RELEASE_CLI_HINT =
  "sentry-cli releases new $VERSION && sentry-cli releases files $VERSION upload-sourcemaps ./dist";
