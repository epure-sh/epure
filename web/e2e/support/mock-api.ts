import type { Page, Route } from "playwright/test";

export interface MockIssue {
  id: string;
  org_id: string;
  project_id: string;
  fingerprint: string;
  title: string;
  status: "unresolved" | "resolved" | "ignored";
  level: string;
  environment: string;
  release: string;
  event_count: number;
  unique_user_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_in_release: string | null;
  snoozed: boolean;
  snooze_until: string | null;
  snooze_until_count: number | null;
  snooze_until_users: number | null;
}

export function createDefaultMockIssues(): MockIssue[] {
  return [
    {
      id: "iss-1",
      org_id: "org-prod-1",
      project_id: "proj-1",
      fingerprint: "fp-1",
      title: "TypeError: Cannot read properties of undefined (reading 'auth')",
      status: "unresolved",
      level: "error",
      environment: "production",
      release: "v2.14.0",
      event_count: 1420,
      unique_user_count: 312,
      first_seen_at: "2026-10-18T10:00:00Z",
      last_seen_at: "2026-10-20T12:00:00Z",
      resolved_in_release: null,
      snoozed: false,
      snooze_until: null,
      snooze_until_count: null,
      snooze_until_users: null,
    },
    {
      id: "iss-2",
      org_id: "org-prod-1",
      project_id: "proj-1",
      fingerprint: "fp-2",
      title: "DatabaseError: Connection pool exhausted (timeout 5000ms)",
      status: "unresolved",
      level: "error",
      environment: "production",
      release: "v2.14.0",
      event_count: 890,
      unique_user_count: 145,
      first_seen_at: "2026-10-19T08:00:00Z",
      last_seen_at: "2026-10-20T12:05:00Z",
      resolved_in_release: null,
      snoozed: false,
      snooze_until: null,
      snooze_until_count: null,
      snooze_until_users: null,
    },
    {
      id: "iss-3",
      org_id: "org-prod-1",
      project_id: "proj-1",
      fingerprint: "fp-3",
      title: "UnhandledPromiseRejection: failed to process webhook payment payload",
      status: "unresolved",
      level: "warning",
      environment: "production",
      release: "v2.13.9",
      event_count: 45,
      unique_user_count: 12,
      first_seen_at: "2026-10-19T14:00:00Z",
      last_seen_at: "2026-10-20T11:30:00Z",
      resolved_in_release: null,
      snoozed: false,
      snooze_until: null,
      snooze_until_count: null,
      snooze_until_users: null,
    },
  ];
}

export async function setupMockApi(
  page: Page,
  options?: {
    issues?: MockIssue[];
  }
) {
  const issues = options?.issues ? [...options.issues] : createDefaultMockIssues();
  const patchedIssues: Record<string, Partial<MockIssue>> = {};

  await page.route("**/api/v1/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path === "/api/v1/auth/me") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "usr-123",
          email: "founder@epure.sh",
          role: "owner",
          org_id: "org-prod-1",
          org_name: "Acme Production Org",
        }),
      });
    }

    if (path === "/api/v1/projects") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projects: [
            {
              id: "proj-1",
              org_id: "org-prod-1",
              name: "Production API",
              slug: "production-api",
              platform: "node",
              dsn_project_id: 42,
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
        }),
      });
    }

    if (path === "/api/v1/setup") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          project_id: "proj-1",
          complete: true,
          seeded: false,
          project_named: true,
          has_active_key: true,
          dsn_copied_at: "2026-01-01T00:00:00Z",
          first_issue_seen_at: "2026-01-01T00:00:00Z",
        }),
      });
    }

    if (path === "/api/v1/stats") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          project_id: "proj-1",
          environment: "production",
          unresolved: 3,
          events_7d: 2355,
          regressions: 0,
          snoozed: 0,
        }),
      });
    }

    if (path.match(/\/api\/v1\/projects\/[^/]+\/(dsn-)?keys$/)) {
      if (method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            keys: [
              {
                id: "key-1",
                project_id: "proj-1",
                label: "production-primary",
                public_key: "pub_live_canary_key",
                hashed_secret: "secret_hash",
                created_at: "2026-01-01T00:00:00Z",
                revoked_at: null,
                dsn: "http://pub_live_canary_key@localhost:8080/42",
              },
            ],
          }),
        });
      }
    }

    if (path === "/api/v1/issues" && method === "GET") {
      const activeList = issues.map((iss) => ({
        ...iss,
        ...(patchedIssues[iss.id] || {}),
      }));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ issues: activeList }),
      });
    }

    if (path === "/api/v1/issues/trends" && method === "POST") {
      const trends = issues.map((iss) => ({
        issue_id: iss.id,
        buckets: [
          { start: "2026-10-20T10:00:00Z", count: 4 },
          { start: "2026-10-20T11:00:00Z", count: 18 },
          { start: "2026-10-20T12:00:00Z", count: 25 },
        ],
      }));
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ trends }),
      });
    }

    const eventsMatch = path.match(/\/api\/v1\/issues\/([^/]+)\/events/);
    if (eventsMatch && method === "GET") {
      const issueId = eventsMatch[1];
      const frames = [
        {
          filename: "src/services/auth-service.ts",
          function: "authenticateRequest",
          lineno: 42,
          colno: 15,
          in_app: true,
          context_line: "  const token = req.headers.authorization.split(' ')[1];",
          pre_context: [
            "async function authenticateRequest(req) {",
            "  // extract bearer token header",
          ],
          post_context: [
            "  return verifyToken(token);",
            "}",
          ],
        },
      ];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          events: [
            {
              id: `evt-${issueId}-1`,
              issue_id: issueId,
              occurred_at: "2026-10-20T12:00:00Z",
              environment: "production",
              release: "v2.14.0",
              platform: "node",
              runtime_name: "node",
              runtime_version: "v20.11.0",
              browser_name: null,
              os_name: "Linux",
              user_id: "usr-889",
              user_email: "jane@acme.com",
              payload_json: {
                exception: {
                  values: [
                    {
                      type: "TypeError",
                      value: "Cannot read properties of undefined (reading 'auth')",
                      stacktrace: {
                        frames,
                      },
                    },
                  ],
                },
              },
              stack_frames: frames,
              breadcrumbs: [
                {
                  category: "http",
                  message: "POST /api/v1/login HTTP/1.1",
                  timestamp: "2026-10-20T12:00:00Z",
                },
              ],
            },
          ],
          total: 1,
          has_more: false,
        }),
      });
    }

    const timelineMatch = path.match(/\/api\/v1\/issues\/([^/]+)\/timeline$/);
    if (timelineMatch && method === "GET") {
      const issueId = timelineMatch[1];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          issue_id: issueId,
          event_count: 1420,
          stored_event_count: 50,
          buckets: [
            { start: "2026-10-20T00:00:00Z", count: 120 },
            { start: "2026-10-20T06:00:00Z", count: 340 },
            { start: "2026-10-20T12:00:00Z", count: 960 },
          ],
          summary: {
            last_1h: 42,
            last_24h: 1420,
            last_7d: 2840,
          },
        }),
      });
    }

    const patchMatch = path.match(/\/api\/v1\/issues\/([^/]+)$/);
    if (patchMatch && method === "PATCH") {
      const issueId = patchMatch[1];
      const postData = JSON.parse(route.request().postData() || "{}");
      patchedIssues[issueId] = {
        status: postData.status || "resolved",
      };
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: issueId,
          status: postData.status || "resolved",
        }),
      });
    }

    // Default 200 empty JSON fallback for unhandled /api/v1/ requests
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  return {
    getPatchedIssues: () => patchedIssues,
  };
}
