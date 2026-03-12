import type {
  AlertRow,
  DsnKeyRow,
  EventDetail,
  HeadlineStats,
  InvitationRow,
  IssueSummary,
  MemberRow,
  MeResponse,
  ProjectRow,
  ReleaseSummary,
  SetupProgress,
  WebhookRow,
} from "../../src/lib/api";

import browserCheckout from "../../../fixtures/seed/events/browser-checkout-typeerror.json";
import browserPayment from "../../../fixtures/seed/events/browser-payment-api-failed.json";
import nodeRejection from "../../../fixtures/seed/events/node-unhandled-rejection.json";
import pythonTimeout from "../../../fixtures/seed/events/python-database-timeout.json";
import stagingFlag from "../../../fixtures/seed/events/staging-feature-flag.json";
import goNilPointer from "../../../fixtures/seed/events/go-nil-pointer.json";
import reactHydration from "../../../fixtures/seed/events/react-hydration-mismatch.json";
import authExpired from "../../../fixtures/seed/events/auth-token-expired.json";

export const ORG_ID = "11111111-1111-1111-1111-111111111111";
export const USER_ID = "33333333-3333-3333-3333-333333333333";
export const PROJECT_WEB = "550e8400-e29b-41d4-a716-446655440000";
export const PROJECT_API = "660e8400-e29b-41d4-a716-446655440001";
export const DSN_PUBLIC_KEY = "a1b2c3d4e5f6g7h8i9j0";

type StorePayload = Record<string, unknown>;

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function isoDaysAgo(days: number, hours = 0): string {
  return new Date(Date.now() - (days * 24 + hours) * 60 * 60 * 1000).toISOString();
}

function titleFromPayload(payload: StorePayload): string {
  const exception = payload.exception as
    | { values?: Array<{ type?: string; value?: string }> }
    | undefined;
  const first = exception?.values?.[0];
  if (first?.type && first?.value) {
    return `${first.type}: ${first.value}`;
  }
  return "Unknown error";
}

function variantPayload(base: StorePayload, patch: StorePayload): StorePayload {
  return { ...structuredClone(base), ...patch };
}

function stackFromPayload(payload: StorePayload): unknown {
  const exception = payload.exception as
    | { values?: Array<{ stacktrace?: { frames?: unknown[] } }> }
    | undefined;
  const frames = exception?.values?.[0]?.stacktrace?.frames;
  if (!Array.isArray(frames)) {
    return [];
  }
  return [...frames].reverse();
}

function eventFromPayload(
  issueId: string,
  eventId: string,
  payload: StorePayload,
  occurredAt: string,
): EventDetail {
  const contexts = payload.contexts as
    | {
        browser?: { name?: string };
        os?: { name?: string };
        runtime?: { name?: string; version?: string };
      }
    | undefined;
  const user = payload.user as { id?: string; email?: string } | undefined;

  return {
    id: eventId,
    issue_id: issueId,
    occurred_at: occurredAt,
    environment: (payload.environment as string | undefined) ?? null,
    release: (payload.release as string | undefined) ?? null,
    platform: (payload.platform as string | undefined) ?? null,
    runtime_name: contexts?.runtime?.name ?? null,
    runtime_version: contexts?.runtime?.version ?? null,
    browser_name: contexts?.browser?.name ?? null,
    os_name: contexts?.os?.name ?? null,
    user_id: user?.id ?? null,
    user_email: user?.email ?? null,
    payload_json: payload,
    stack_frames: stackFromPayload(payload),
    breadcrumbs: payload.breadcrumbs ?? null,
  };
}

interface IssueSeed {
  id: string;
  project_id: string;
  title: string;
  status: string;
  level: string;
  environment: string;
  release: string;
  event_count: number;
  unique_user_count: number;
  last_seen_at: string;
  payload: StorePayload;
  extraEvents?: Array<{ id: string; occurredAt: string; payload?: StorePayload }>;
  snoozed?: boolean;
  snooze_until?: string | null;
  snooze_until_count?: number | null;
  snooze_until_users?: number | null;
}

const ISSUE_SEEDS: IssueSeed[] = [
  {
    id: "a1000001-0000-4000-8000-000000000001",
    project_id: PROJECT_WEB,
    title: titleFromPayload(browserCheckout),
    status: "unresolved",
    level: "error",
    environment: "production",
    release: "web@2.14.0",
    event_count: 462_000,
    unique_user_count: 111_000,
    last_seen_at: isoHoursAgo(0.2),
    payload: browserCheckout,
    extraEvents: [
      {
        id: "e1000001-0002-4000-8000-000000000002",
        occurredAt: isoHoursAgo(2),
        payload: variantPayload(browserCheckout, {
          release: "web@2.13.2",
          transaction: "/checkout?step=payment",
          user: { id: "usr_compare_b", email: "bob@acme-corp.com", username: "bob" },
        }),
      },
      {
        id: "e1000001-0003-4000-8000-000000000003",
        occurredAt: isoHoursAgo(6),
        payload: variantPayload(browserCheckout, {
          release: "web@2.13.0",
          transaction: "/checkout?step=review",
          user: { id: "usr_compare_c", email: "carol@acme-corp.com", username: "carol" },
        }),
      },
    ],
  },
  {
    id: "a1000001-0000-4000-8000-000000000002",
    project_id: PROJECT_WEB,
    title: titleFromPayload(browserPayment),
    status: "unresolved",
    level: "error",
    environment: "production",
    release: "web@2.14.0",
    event_count: 194_000,
    unique_user_count: 42_000,
    last_seen_at: isoHoursAgo(1),
    payload: browserPayment,
    extraEvents: [{ id: "e1000002-0002-4000-8000-000000000002", occurredAt: isoHoursAgo(4) }],
  },
  {
    id: "a1000001-0000-4000-8000-000000000003",
    project_id: PROJECT_WEB,
    title: titleFromPayload(reactHydration),
    status: "regression",
    level: "error",
    environment: "production",
    release: "web@2.15.0",
    event_count: 8_400,
    unique_user_count: 2_100,
    last_seen_at: isoHoursAgo(0.5),
    payload: reactHydration,
    extraEvents: [
      {
        id: "e1000003-0002-4000-8000-000000000002",
        occurredAt: isoHoursAgo(48),
        payload: variantPayload(reactHydration, {
          release: "web@2.14.0",
          transaction: "/dashboard",
        }),
      },
    ],
  },
  {
    id: "a1000001-0000-4000-8000-000000000004",
    project_id: PROJECT_WEB,
    title: titleFromPayload(authExpired),
    status: "unresolved",
    level: "error",
    environment: "production",
    release: "web@2.14.0",
    event_count: 67,
    unique_user_count: 1,
    last_seen_at: isoHoursAgo(3),
    payload: authExpired,
    snoozed: true,
    snooze_until: isoDaysAgo(-2),
  },
  {
    id: "a1000001-0000-4000-8000-000000000005",
    project_id: PROJECT_WEB,
    title: titleFromPayload(stagingFlag),
    status: "unresolved",
    level: "warning",
    environment: "staging",
    release: "web@2.15.0-rc.1",
    event_count: 3,
    unique_user_count: 1,
    last_seen_at: isoHoursAgo(12),
    payload: stagingFlag,
  },
  {
    id: "a1000001-0000-4000-8000-000000000006",
    project_id: PROJECT_WEB,
    title: titleFromPayload(goNilPointer),
    status: "resolved",
    level: "error",
    environment: "production",
    release: "web@2.13.2",
    event_count: 89,
    unique_user_count: 5,
    last_seen_at: isoDaysAgo(2),
    payload: goNilPointer,
  },
  {
    id: "a1000001-0000-4000-8000-000000000007",
    project_id: PROJECT_WEB,
    title: "Error: Legacy checkout banner dismissed without consent",
    status: "ignored",
    level: "warning",
    environment: "production",
    release: "web@2.12.0",
    event_count: 1,
    unique_user_count: 1,
    last_seen_at: isoDaysAgo(5),
    payload: {
      platform: "javascript",
      level: "warning",
      environment: "production",
      release: "web@2.12.0",
      exception: {
        values: [
          {
            type: "Error",
            value: "Legacy checkout banner dismissed without consent",
            stacktrace: {
              frames: [
                {
                  filename: "webpack:///./src/components/LegacyBanner.tsx",
                  function: "onDismiss",
                  lineno: 18,
                  colno: 5,
                  in_app: true,
                  context_line: "  track('banner_dismiss');",
                },
              ],
            },
          },
        ],
      },
      breadcrumbs: { values: [] },
    },
  },
  {
    id: "a1000002-0000-4000-8000-000000000001",
    project_id: PROJECT_API,
    title: titleFromPayload(nodeRejection),
    status: "unresolved",
    level: "error",
    environment: "production",
    release: "api@1.8.3",
    event_count: 23,
    unique_user_count: 4,
    last_seen_at: isoHoursAgo(8),
    payload: nodeRejection,
  },
  {
    id: "a1000002-0000-4000-8000-000000000002",
    project_id: PROJECT_API,
    title: titleFromPayload(pythonTimeout),
    status: "unresolved",
    level: "error",
    environment: "production",
    release: "api@1.8.2",
    event_count: 12,
    unique_user_count: 2,
    last_seen_at: isoHoursAgo(18),
    payload: pythonTimeout,
  },
];

export function buildIssues(): IssueSummary[] {
  return ISSUE_SEEDS.map((seed) => ({
    id: seed.id,
    org_id: ORG_ID,
    project_id: seed.project_id,
    fingerprint: `fp-${seed.id}`,
    title: seed.title,
    status: seed.status,
    level: seed.level,
    environment: seed.environment,
    release: seed.release,
    event_count: seed.event_count,
    unique_user_count: seed.unique_user_count,
    last_seen_at: seed.last_seen_at,
    first_seen_at: isoDaysAgo(
      seed.id.endsWith("000001") ? 120 : seed.id.endsWith("000002") ? 45 : 14,
    ),
    resolved_in_release: seed.status === "regression" ? "web@2.14.0" : null,
    snoozed: seed.snoozed ?? false,
    snooze_until: seed.snooze_until ?? null,
    snooze_until_count: seed.snooze_until_count ?? null,
    snooze_until_users: seed.snooze_until_users ?? null,
  }));
}

export function buildEvents(): EventDetail[] {
  const events: EventDetail[] = [];

  for (const seed of ISSUE_SEEDS) {
    const primaryId = `e${seed.id.slice(1)}`;
    events.push(
      eventFromPayload(seed.id, primaryId, seed.payload, seed.last_seen_at),
    );

    for (const extra of seed.extraEvents ?? []) {
      events.push(
        eventFromPayload(
          seed.id,
          extra.id,
          extra.payload ?? seed.payload,
          extra.occurredAt,
        ),
      );
    }
  }

  return events;
}

export const me: MeResponse = {
  user_id: USER_ID,
  org_id: ORG_ID,
  email: "dev@epure.local",
  display_name: "Dev User",
  role: "owner",
  has_password: true,
  google_linked: false,
};

export const projects: ProjectRow[] = [
  {
    id: PROJECT_WEB,
    org_id: ORG_ID,
    name: "Acme Web",
    slug: "acme-web",
    retention_days: 30,
    ingest_cap_per_hour: 5000,
    created_at: isoDaysAgo(90),
  },
  {
    id: PROJECT_API,
    org_id: ORG_ID,
    name: "Acme API",
    slug: "acme-api",
    retention_days: 30,
    ingest_cap_per_hour: 5000,
    created_at: isoDaysAgo(60),
  },
];

export const setupProgress: SetupProgress = {
  user_id: USER_ID,
  org_id: ORG_ID,
  project_id: PROJECT_WEB,
  project_named: true,
  has_active_key: true,
  dsn_copied_at: isoDaysAgo(30),
  first_issue_seen_at: isoDaysAgo(29),
  completed_at: isoDaysAgo(29),
  complete: true,
  seeded: true,
};

export function buildStats(projectId: string, environment?: string): HeadlineStats {
  const issues = buildIssues().filter((issue) => issue.project_id === projectId);
  const scopedIssues = environment
    ? issues.filter((issue) => issue.environment === environment)
    : issues;
  const events = buildEvents().filter((event) => {
    const issue = issues.find((row) => row.id === event.issue_id);
    if (!issue) {
      return false;
    }
    if (environment && event.environment !== environment) {
      return false;
    }
    const ageMs = Date.now() - new Date(event.occurred_at).getTime();
    return ageMs <= 7 * 24 * 60 * 60 * 1000;
  });

  return {
    project_id: projectId,
    environment: environment ?? null,
    unresolved: scopedIssues.filter((issue) => issue.status === "unresolved" && !issue.snoozed).length,
    events_7d: events.length,
    regressions: scopedIssues.filter((issue) => issue.status === "regression" && !issue.snoozed).length,
    snoozed: scopedIssues.filter((issue) => issue.snoozed).length,
  };
}

export const alerts: AlertRow[] = [
  {
    id: "f1000001-0000-4000-8000-000000000001",
    org_id: ORG_ID,
    project_id: PROJECT_WEB,
    issue_id: "a1000001-0000-4000-8000-000000000001",
    kind: "velocity_spike",
    fired_at: isoHoursAgo(2),
    payload_json: {
      title: "TypeError: Cannot read properties of undefined (reading 'total')",
      current_window: 47,
      previous_window: 8,
      ratio: 5.875,
    },
    read_at: null,
    ignored: false,
  },
  {
    id: "f1000001-0000-4000-8000-000000000002",
    org_id: ORG_ID,
    project_id: PROJECT_WEB,
    issue_id: "a1000001-0000-4000-8000-000000000003",
    kind: "regression",
    fired_at: isoHoursAgo(0.5),
    payload_json: {
      title: "Hydration failed because the server rendered HTML didn't match the client",
      release: "web@2.15.0",
      resolved_in_release: "web@2.14.0",
    },
    read_at: null,
    ignored: false,
  },
  {
    id: "f1000001-0000-4000-8000-000000000003",
    org_id: ORG_ID,
    project_id: PROJECT_WEB,
    issue_id: "a1000001-0000-4000-8000-000000000005",
    kind: "new_issue",
    fired_at: isoHoursAgo(6),
    payload_json: {
      title: "AuthError: Token expired",
      release: "web@2.15.0",
    },
    read_at: isoHoursAgo(5),
    ignored: false,
  },
  {
    id: "f1000001-0000-4000-8000-000000000004",
    org_id: ORG_ID,
    project_id: PROJECT_WEB,
    issue_id: "a1000001-0000-4000-8000-000000000001",
    kind: "event_milestone",
    fired_at: isoHoursAgo(4),
    payload_json: {
      title: "TypeError: Cannot read properties of undefined (reading 'total')",
      threshold: 500,
      event_count: 512,
    },
    read_at: null,
    ignored: false,
  },
  {
    id: "f1000001-0000-4000-8000-000000000005",
    org_id: ORG_ID,
    project_id: PROJECT_WEB,
    issue_id: "a1000001-0000-4000-8000-000000000002",
    kind: "users_affected",
    fired_at: isoHoursAgo(8),
    payload_json: {
      title: "PaymentError: Card declined by issuer",
      threshold: 50,
      unique_user_count: 53,
    },
    read_at: isoHoursAgo(7),
    ignored: true,
  },
];

export const releases: ReleaseSummary[] = [
  {
    id: "r1000001-0000-4000-8000-000000000001",
    project_id: PROJECT_WEB,
    version: "web@2.15.0",
    artifact_count: 2,
    last_upload_at: isoDaysAgo(1),
    first_seen_at: isoDaysAgo(1),
    last_seen_at: isoHoursAgo(2),
    issue_count: 3,
    event_count: 47,
    regression_count: +1,
    new_issue_count: 1,
  },
  {
    id: "r1000001-0000-4000-8000-000000000002",
    project_id: PROJECT_WEB,
    version: "web@2.14.0",
    artifact_count: 2,
    last_upload_at: isoDaysAgo(7),
    first_seen_at: isoDaysAgo(7),
    last_seen_at: isoDaysAgo(2),
    issue_count: 5,
    event_count: 112,
    regression_count: 0,
    new_issue_count: 2,
  },
  {
    id: "r1000001-0000-4000-8000-000000000003",
    project_id: PROJECT_WEB,
    version: "web@2.13.2",
    artifact_count: 1,
    last_upload_at: isoDaysAgo(14),
    first_seen_at: isoDaysAgo(14),
    last_seen_at: isoDaysAgo(10),
    issue_count: 2,
    event_count: 28,
    regression_count: 0,
    new_issue_count: 0,
  },
  {
    id: "r1000002-0000-4000-8000-000000000001",
    project_id: PROJECT_API,
    version: "api@1.8.3",
    artifact_count: 0,
    last_upload_at: null,
    first_seen_at: null,
    last_seen_at: null,
    issue_count: 0,
    event_count: 0,
    regression_count: 0,
    new_issue_count: 0,
  },
];

export const dsnKeys: DsnKeyRow[] = [
  {
    id: "22222222-2222-2222-2222-222222222222",
    project_id: PROJECT_WEB,
    public_key: DSN_PUBLIC_KEY,
    label: "Production browser",
    revoked_at: null,
    created_at: isoDaysAgo(30),
  },
  {
    id: "22222222-2222-2222-2222-222222222223",
    project_id: PROJECT_API,
    public_key: "b2c3d4e5f6g7h8i9j0k1",
    label: "API server",
    revoked_at: null,
    created_at: isoDaysAgo(30),
  },
];

export const members: MemberRow[] = [
  {
    user_id: USER_ID,
    email: "dev@epure.local",
    display_name: "Dev User",
    role: "owner",
    created_at: isoDaysAgo(90),
  },
  {
    user_id: "44444444-4444-4444-4444-444444444444",
    email: "member@epure.local",
    display_name: null,
    role: "member",
    created_at: isoDaysAgo(45),
  },
];

export const invitations: InvitationRow[] = [
  {
    id: "i1000001-0000-4000-8000-000000000001",
    email: "qa@acme-corp.com",
    role: "member",
    expires_at: isoDaysAgo(-7),
    created_at: isoHoursAgo(24),
  },
];

export const webhooks: WebhookRow[] = [
  {
    id: "w1000001-0000-4000-8000-000000000001",
    project_id: PROJECT_WEB,
    url: "https://hooks.slack.com/services/T000/B000/XXXX",
    format: "slack",
    events: ["issue_created", "regression"],
    secret_prefix: "whsec_a1b2c3d4",
    created_at: isoDaysAgo(20),
  },
];
