import { ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchReleases, type ReleaseSummary } from "../../lib/api";
import { issuesFilterPath, projectSettingsPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { Button } from "../../ui/button";
import { Empty } from "../../ui/empty";
import { FeedListBody, StackedCardList } from "../../ui/feed-list-shell";
import { FeedHeaderStat, FeedHeaderStatDot, SimpleFeedHeader } from "../../ui/simple-feed-header";
import { ListRow } from "../../ui/list-row";
import { SdkSnippetBlock } from "../../ui/sdk-snippet-block";
import { CardRowSkeleton } from "../../ui/skeleton";
import {
  formatReleaseDeltas,
  formatReleaseMeta,
  RELEASE_CLI_HINT,
  RELEASE_EXAMPLE_VERSION,
} from "./format-release";

function ReleaseRow({
  release,
  projectId,
}: {
  release: ReleaseSummary;
  projectId: string;
}) {
  const deltas = formatReleaseDeltas(release);
  const meta = formatReleaseMeta(release);
  const issuesPath = issuesFilterPath(projectId, `release:${release.version}`);

  return (
    <li>
      <ListRow asChild variant="flat" className="group items-center gap-3 px-4 py-2.5">
        <Link to={issuesPath}>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-sm font-medium text-ink">{release.version}</p>
            <p className="mt-0.5 text-xs text-ink-muted">{meta}</p>
            {deltas ? <p className="mt-1 text-xs text-ink">{deltas}</p> : null}
          </div>
          <ChevronRight
            size={16}
            strokeWidth={1.5}
            className="shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink"
            aria-hidden
          />
        </Link>
      </ListRow>
    </li>
  );
}

export function ReleasesPage() {
  const { projects, projectId } = useAppContext();
  const [releases, setReleases] = useState<ReleaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const activeProject = useMemo(
    () => projects.find((row) => row.id === activeProjectId) ?? null,
    [activeProjectId, projects],
  );

  const loadReleases = useCallback(async () => {
    if (!activeProjectId) {
      setReleases([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchReleases(activeProjectId);
      setReleases(rows);
    } catch {
      setReleases([]);
      setError("Failed to load releases");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    void loadReleases();
  }, [loadReleases]);

  const totalIssues = releases.reduce((sum, release) => sum + release.issue_count, 0);
  const totalEvents = releases.reduce((sum, release) => sum + release.event_count, 0);
  const regressionTotal = releases.reduce((sum, release) => sum + release.regression_count, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SimpleFeedHeader
        title="Releases"
        stats={
          activeProjectId ? (
            <>
              <FeedHeaderStat
                label={releases.length === 1 ? "release" : "releases"}
                value={releases.length}
                loading={loading}
              />
              {!loading && releases.length > 0 ? (
                <>
                  <FeedHeaderStatDot />
                  <FeedHeaderStat label="issues" value={totalIssues} />
                  <FeedHeaderStatDot />
                  <FeedHeaderStat label="events" value={totalEvents} />
                  {regressionTotal > 0 ? (
                    <>
                      <FeedHeaderStatDot />
                      <FeedHeaderStat label="came back" value={regressionTotal} />
                    </>
                  ) : null}
                </>
              ) : null}
              {activeProject?.name ? (
                <>
                  <FeedHeaderStatDot />
                  <span className="text-ink-muted">{activeProject.name}</span>
                </>
              ) : null}
            </>
          ) : null
        }
      />

      <FeedListBody>
        {!activeProjectId ? (
          <Empty
            title="No project selected"
            description="Choose a project to view its releases."
          />
        ) : loading ? (
          <StackedCardList>
            {Array.from({ length: 5 }).map((_, index) => (
              <CardRowSkeleton key={index} />
            ))}
          </StackedCardList>
        ) : error ? (
          <div className="space-y-3">
            <p className="text-sm text-semantic-danger">{error}</p>
            <Button type="button" variant="secondary" size="sm" onClick={() => void loadReleases()}>
              Try again
            </Button>
          </div>
        ) : releases.length === 0 ? (
          <Empty
            title="No releases yet"
            description="Set a release when you initialize your SDK. Epure groups exceptions by version so you can spot what changed after each deploy."
          >
            <div className="w-full max-w-lg space-y-4 text-left">
              <SdkSnippetBlock
                dsn="YOUR_DSN"
                release={RELEASE_EXAMPLE_VERSION}
                title="SDK init"
                description="Set a release when you initialize the SDK."
                initOnly
              />
              <div>
                <p className="text-xs font-medium text-ink">Source maps (optional, JS/TS)</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Upload artifacts for the same version so stack traces resolve to your source.
                </p>
                <pre className="epure-code-well mt-2 overflow-x-auto rounded-lg border border-border bg-bg-subtle p-3 font-mono text-xs text-ink-muted">
                  {RELEASE_CLI_HINT}
                </pre>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link to={projectSettingsPath(activeProjectId, "dsn")}>
                  Open Connection settings
                </Link>
              </Button>
            </div>
          </Empty>
        ) : (
          <StackedCardList>
            {releases.map((release) => (
              <ReleaseRow key={release.id} release={release} projectId={activeProjectId} />
            ))}
          </StackedCardList>
        )}
      </FeedListBody>
    </div>
  );
}
