import type { AlertRow } from "@/lib/api";

const org = "11111111-1111-1111-1111-111111111111";
const project = "550e8400-e29b-41d4-a716-446655440000";

/** Minimal set for design-kit previews (playground seed is the full matrix). */
export const DESIGN_KIT_SAMPLE_ALERTS: AlertRow[] = [
  {
    id: "dk-alert-firing",
    org_id: org,
    project_id: project,
    issue_id: "a1000001-0000-4000-8000-000000000001",
    kind: "velocity_spike",
    fired_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    payload_json: {
      title: "TypeError: Cannot read properties of undefined (reading 'total')",
      current_window: 47,
      previous_window: 8,
      ratio: 5.875,
      event_count: 462_000,
      unique_user_count: 111_000,
    },
    read_at: null,
    ignored: false,
  },
  {
    id: "dk-alert-muted",
    org_id: org,
    project_id: project,
    issue_id: "a1000001-0000-4000-8000-000000000004",
    kind: "new_issue",
    fired_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    payload_json: {
      title: "AuthError: Token expired",
      event_count: 67,
      unique_user_count: 1,
    },
    read_at: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    ignored: true,
  },
  {
    id: "dk-alert-custom",
    org_id: org,
    project_id: project,
    issue_id: "a1000001-0000-4000-8000-000000000002",
    kind: "custom",
    fired_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    payload_json: {
      rule_name: "Payment guard — production",
      rule_kind: "velocity_spike",
      title: "PaymentError: Card declined by issuer",
      environment: "production",
      event_count: 194_000,
      unique_user_count: 42_000,
      issue_ids: [
        "a1000001-0000-4000-8000-000000000001",
        "a1000001-0000-4000-8000-000000000002",
      ],
    },
    read_at: null,
    ignored: false,
  },
];
