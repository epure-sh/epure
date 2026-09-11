export type WebhookFormat = "slack" | "discord" | "generic";

export const WEBHOOK_EVENT_OPTIONS = [
  {
    id: "issue_created",
    label: "New issue",
    description: "First time a fingerprint appears — matches the New issue alert.",
  },
  {
    id: "regression",
    label: "Came back",
    description: "Resolved issue returns in a newer release — matches the Came back alert.",
  },
  {
    id: "velocity_spike",
    label: "Velocity spike",
    description: "Event rate jumps sharply in a rolling 15-minute window.",
  },
  {
    id: "custom_rule",
    label: "Custom rule",
    description: "A project Alert rule matched.",
  },
] as const;

export type WebhookEventId = (typeof WEBHOOK_EVENT_OPTIONS)[number]["id"];

const SAMPLE = {
  title: "TypeError: Cannot read properties of undefined (reading 'total')",
  release: "web@2.15.0",
  eventCount: 47,
  issueId: "a1000001-0000-4000-8000-000000000001",
  projectId: "550e8400-e29b-41d4-a716-446655440000",
  status: "unresolved",
};

export function previewWebhookPayload(format: WebhookFormat, event: string): string {
  const title = SAMPLE.title;
  const release = SAMPLE.release;
  const count = SAMPLE.eventCount;

  if (format === "slack") {
    return JSON.stringify(
      {
        text: `*${event}*: ${title} (${release})`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${event}*\n*${title}*\nRelease: \`${release}\`\nEvents: ${count}`,
            },
          },
        ],
      },
      null,
      2,
    );
  }

  if (format === "discord") {
    return JSON.stringify(
      {
        content: `**${event}**: ${title} (release \`${release}\`, ${count} events)`,
      },
      null,
      2,
    );
  }

  return JSON.stringify(
    {
      event,
      issue_id: SAMPLE.issueId,
      project_id: SAMPLE.projectId,
      title,
      status: SAMPLE.status,
      release,
      event_count: count,
    },
    null,
    2,
  );
}
