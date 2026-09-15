import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAlerts, fetchWebhooks, type AlertRow } from "../../lib/api";
import { projectPath, projectSettingsPath } from "../../lib/paths";
import { useAppContext } from "../../shell/app-context";
import { ActionButton } from "../../ui/action-button";
import { Button } from "../../ui/button";
import { Empty } from "../../ui/empty";
import { FeedListBody, StackedCardList } from "../../ui/feed-list-shell";
import {
  FeedHeaderStat,
  FeedHeaderStatDot,
  SimpleFeedHeader,
} from "../../ui/simple-feed-header";
import { CardRowSkeleton } from "../../ui/skeleton";
import { AlertListRow } from "./alert-row";
import {
  countAlertsByKind,
  filterAlerts,
  loadAlertsPreferences,
  saveAlertsPreferences,
  sortAlerts,
  type AlertKindFilter,
  type AlertSort,
  type AlertTimeWindow,
  type AlertsPreferences,
} from "./alert-utils";
import { AlertsIssuesHint } from "./alerts-issues-hint";
import { AlertsRulesPanel } from "./alerts-rules-panel";
import { AlertsToolbar } from "./alerts-toolbar";

export function AlertsPage() {
  const { environment, projectId, projects, user } = useAppContext();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [webhookCount, setWebhookCount] = useState<number | null>(null);
  const [preferences, setPreferences] = useState<AlertsPreferences>(() => loadAlertsPreferences());
  const [kindFilter, setKindFilter] = useState<AlertKindFilter>(preferences.defaultKindFilter);
  const [sort, setSort] = useState<AlertSort>(preferences.defaultSort);
  const [timeWindow, setTimeWindow] = useState<AlertTimeWindow>(preferences.defaultTimeWindow);
  const [retrying, setRetrying] = useState(false);

  const activeProjectId = projectId ?? projects[0]?.id ?? null;
  const canManageWebhooks = user?.role === "owner" || user?.role === "admin";

  const loadAlerts = useCallback(async () => {
    if (!activeProjectId) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const rows = await fetchAlerts(activeProjectId, environment);
      setAlerts(rows);
    } catch {
      setAlerts([]);
      setError("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, environment]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  useEffect(() => {
    if (!activeProjectId || !canManageWebhooks) {
      setWebhookCount(canManageWebhooks ? 0 : null);
      return;
    }

    let cancelled = false;
    void fetchWebhooks(activeProjectId)
      .then((rows) => {
        if (!cancelled) {
          setWebhookCount(rows.length);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWebhookCount(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, canManageWebhooks]);

  const handleCompactRowsChange = (compactRows: boolean) => {
    const next = { ...preferences, compactRows };
    setPreferences(next);
    saveAlertsPreferences(next);
  };

  const filteredAlerts = useMemo(
    () => sortAlerts(filterAlerts(alerts, { kind: kindFilter, timeWindow }), sort),
    [alerts, kindFilter, sort, timeWindow],
  );

  const timeScopedAlerts = useMemo(
    () => filterAlerts(alerts, { kind: "all", timeWindow }),
    [alerts, timeWindow],
  );
  const { velocity, regression } = useMemo(
    () => countAlertsByKind(timeScopedAlerts),
    [timeScopedAlerts],
  );
  const recentCount = timeScopedAlerts.length;

  const showRulesByDefault = !loading && alerts.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SimpleFeedHeader
        title="Alerts"
        actions={
          activeProjectId ? (
            canManageWebhooks ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to={projectSettingsPath(activeProjectId, "webhooks")}>Notifications</Link>
              </Button>
            ) : (
              <ActionButton
                variant="secondary"
                size="sm"
                disabled
                tooltip="Admin or owner required to manage notifications"
              >
                Notifications
              </ActionButton>
            )
          ) : null
        }
        stats={
          activeProjectId ? (
            <>
              <FeedHeaderStat
                label={recentCount === 1 ? "alert" : "alerts"}
                value={recentCount}
                loading={loading}
              />
              {!loading && velocity > 0 ? (
                <>
                  <FeedHeaderStatDot />
                  <FeedHeaderStat
                    label={velocity === 1 ? "velocity spike" : "velocity spikes"}
                    value={velocity}
                  />
                </>
              ) : null}
              {!loading && regression > 0 ? (
                <>
                  <FeedHeaderStatDot />
                  <FeedHeaderStat label="came back" value={regression} />
                </>
              ) : null}
              {environment ? (
                <>
                  <FeedHeaderStatDot />
                  <span className="text-ink-muted">{environment}</span>
                </>
              ) : null}
            </>
          ) : null
        }
      />

      {activeProjectId ? <AlertsIssuesHint projectId={activeProjectId} /> : null}

      {!activeProjectId ? (
        <FeedListBody>
          <Empty title="No project selected" description="Choose a project to view alerts." />
        </FeedListBody>
      ) : (
        <>
          <AlertsToolbar
            kindFilter={kindFilter}
            onKindFilterChange={setKindFilter}
            sort={sort}
            onSortChange={setSort}
            timeWindow={timeWindow}
            onTimeWindowChange={setTimeWindow}
            compactRows={preferences.compactRows}
            onCompactRowsChange={handleCompactRowsChange}
          />

          <FeedListBody>
            {loading ? (
              <StackedCardList>
                {Array.from({ length: 5 }).map((_, index) => (
                  <CardRowSkeleton key={index} />
                ))}
              </StackedCardList>
            ) : error ? (
              <div className="space-y-3">
                <p className="text-sm text-semantic-danger">{error}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={retrying}
                  onClick={() => {
                    setRetrying(true);
                    void loadAlerts().finally(() => setRetrying(false));
                  }}
                >
                  {retrying ? "Retrying…" : "Try again"}
                </Button>
              </div>
            ) : alerts.length === 0 ? (
              <Empty
                title="No alerts yet"
                description="Alerts fire when event velocity spikes or a resolved exception comes back."
              >
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  {canManageWebhooks ? (
                    <Button variant="secondary" size="sm" asChild>
                      <Link to={projectSettingsPath(activeProjectId, "webhooks")}>
                        Add notification endpoint
                      </Link>
                    </Button>
                  ) : (
                    <ActionButton
                      variant="secondary"
                      size="sm"
                      disabled
                      tooltip="Admin or owner required to add notification endpoints"
                    >
                      Add notification endpoint
                    </ActionButton>
                  )}
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={projectPath(activeProjectId, "issues")}>Open Issues</Link>
                  </Button>
                </div>
              </Empty>
            ) : filteredAlerts.length === 0 ? (
              <Empty
                title="No alerts match these filters"
                description="Try widening the time range or clearing the type filter."
              >
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setKindFilter("all");
                      setTimeWindow("30d");
                    }}
                  >
                    Reset filters
                  </Button>
                </div>
              </Empty>
            ) : (
              <StackedCardList>
                {filteredAlerts.map((alert) => (
                  <AlertListRow
                    key={alert.id}
                    alert={alert}
                    projectId={activeProjectId}
                    compact={preferences.compactRows}
                  />
                ))}
              </StackedCardList>
            )}
          </FeedListBody>

          <AlertsRulesPanel
            projectId={activeProjectId}
            webhookCount={webhookCount}
            canManageWebhooks={canManageWebhooks}
            defaultOpen={showRulesByDefault}
          />
        </>
      )}
    </div>
  );
}
