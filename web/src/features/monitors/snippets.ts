import type { MonitorSchedule } from "./schedule";
import { scheduleToStorage } from "./schedule";

export type SnippetPlatform = "node" | "python" | "go" | "cli" | "curl";

export interface SnippetContext {
  slug: string;
  schedule: MonitorSchedule;
  timezone: string;
  checkinMarginMins: number;
  maxRuntimeMins: number;
  environment: string;
  projectId?: string | null;
  dsnHint?: string;
}

function monitorConfigJson(ctx: SnippetContext): string {
  const schedule =
    ctx.schedule.type === "interval"
      ? `{ type: "interval", value: ${ctx.schedule.value}, unit: "${ctx.schedule.unit}" }`
      : `{ type: "crontab", value: "${ctx.schedule.value}" }`;
  return `{
    schedule: ${schedule},
    checkin_margin: ${ctx.checkinMarginMins},
    max_runtime: ${ctx.maxRuntimeMins},
    timezone: "${ctx.timezone}",
  }`;
}

function monitorConfigPython(ctx: SnippetContext): string {
  const schedule =
    ctx.schedule.type === "interval"
      ? `{"type": "interval", "value": ${ctx.schedule.value}, "unit": "${ctx.schedule.unit}"}`
      : `{"type": "crontab", "value": "${ctx.schedule.value}"}`;
  return `{
        "schedule": ${schedule},
        "checkin_margin": ${ctx.checkinMarginMins},
        "max_runtime": ${ctx.maxRuntimeMins},
        "timezone": "${ctx.timezone}",
    }`;
}

export function buildSnippet(platform: SnippetPlatform, ctx: SnippetContext): string {
  const dsn = ctx.dsnHint ?? "https://KEY@ingest.epure.sh/PROJECT";
  const env = ctx.environment || "production";
  const config = monitorConfigJson(ctx);
  const pyConfig = monitorConfigPython(ctx);
  const project = ctx.projectId ?? "PROJECT_ID";
  const scheduleHint = scheduleToStorage(ctx.schedule);

  switch (platform) {
    case "node":
      return `import * as Sentry from "@sentry/node";

Sentry.init({ dsn: "${dsn}", environment: "${env}" });

await Sentry.withMonitor("${ctx.slug}", async () => {
  await runJob();
}, ${config});`;
    case "python":
      return `import sentry_sdk
from sentry_sdk.crons import monitor

sentry_sdk.init(dsn="${dsn}", environment="${env}")

@monitor(
    monitor_slug="${ctx.slug}",
    monitor_config=${pyConfig},
)
def run_job():
    ...
`;
    case "go":
      return `// Start
checkInId := sentry.CaptureCheckIn(
  &sentry.CheckIn{
    MonitorSlug: "${ctx.slug}",
    Status:      sentry.CheckInStatusInProgress,
  },
  &sentry.MonitorConfig{ /* schedule: ${scheduleHint} */ },
)

// Finish
sentry.CaptureCheckIn(
  &sentry.CheckIn{
    ID:          *checkInId,
    MonitorSlug: "${ctx.slug}",
    Status:      sentry.CheckInStatusOK,
  },
  nil,
)`;
    case "cli":
      return `# Wrap any command (system crontab / Docker entrypoint)
sentry-cli monitors run ${ctx.slug} -- \\
  ./bin/run-job

# Or emit a single check-in
sentry-cli monitors checkin ${ctx.slug} --status ok`;
    case "curl":
      return `# Zero-SDK fallback for GitHub Actions, Vercel Crons, pg_cron
curl -X POST "https://ingest.epure.sh/api/${project}/envelope/" \\
  -H "Content-Type: application/x-sentry-envelope" \\
  --data-binary $'{"sent_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}\\n{"type":"check_in"}\\n{"monitor_slug":"${ctx.slug}","status":"ok","environment":"${env}","monitor_config":{"schedule":{"type":"${ctx.schedule.type}","value":${
        ctx.schedule.type === "interval"
          ? ctx.schedule.value
          : `"${ctx.schedule.value}"`
      }${
        ctx.schedule.type === "interval" ? `,"unit":"${ctx.schedule.unit}"` : ""
      },"checkin_margin":${ctx.checkinMarginMins},"max_runtime":${ctx.maxRuntimeMins},"timezone":"${ctx.timezone}"}}\\n'`;
  }
}

export const SNIPPET_TABS: Array<{ id: SnippetPlatform; label: string; language: string }> = [
  { id: "node", label: "Node.js", language: "typescript" },
  { id: "python", label: "Python", language: "python" },
  { id: "go", label: "Go / Rust / PHP", language: "go" },
  { id: "cli", label: "CLI / Bash", language: "bash" },
  { id: "curl", label: "cURL", language: "bash" },
];
