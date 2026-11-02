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
  if (!ctx.dsnHint) return "# Select a project with an active DSN key to generate this snippet.";
  const dsn = ctx.dsnHint;
  const parsedDsn = new URL(dsn);
  const path = parsedDsn.pathname.replace(/\/$/, "");
  const split = path.lastIndexOf("/");
  const endpoint = `${parsedDsn.origin}${path.slice(0, split)}/api/${path.slice(split + 1)}/envelope/`;
  const env = ctx.environment || "production";
  const config = monitorConfigJson(ctx);
  const pyConfig = monitorConfigPython(ctx);
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
      return `// Initialize the Go SDK before starting the job.
if err := sentry.Init(sentry.ClientOptions{Dsn: "${dsn}", Environment: "${env}"}); err != nil {
  log.Fatal(err)
}
defer sentry.Flush(10 * time.Second)

// Start
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
      return `export SENTRY_DSN="${dsn}"
# Wrap any command (system crontab / Docker entrypoint)
sentry-cli monitors run ${ctx.slug} -- \\
  ./bin/run-job

# Or emit a single check-in
sentry-cli monitors checkin ${ctx.slug} --status ok`;
    case "curl":
      return `# Send a real completion only after your job succeeds.
curl --fail-with-body -X POST "${endpoint}" \\
  -H "Content-Type: application/x-sentry-envelope" \\
  -H "X-Sentry-Auth: Sentry sentry_version=7,sentry_key=${decodeURIComponent(parsedDsn.username)}" \\
  --data-binary @- <<'EPURE_CHECK_IN'
${JSON.stringify({ dsn })}
${JSON.stringify({ type: "check_in" })}
${JSON.stringify({ monitor_slug: ctx.slug, status: "ok", environment: env, monitor_config: {
  schedule: ctx.schedule.type === "interval" ? { type: "interval", value: ctx.schedule.value, unit: ctx.schedule.unit } : { type: "crontab", value: ctx.schedule.value },
  checkin_margin: ctx.checkinMarginMins, max_runtime: ctx.maxRuntimeMins, timezone: ctx.timezone,
} })}
EPURE_CHECK_IN`;
  }
}

export const SNIPPET_TABS: Array<{ id: SnippetPlatform; label: string; language: string }> = [
  { id: "node", label: "Node.js", language: "typescript" },
  { id: "python", label: "Python", language: "python" },
  { id: "go", label: "Go", language: "go" },
  { id: "cli", label: "CLI / Bash", language: "bash" },
  { id: "curl", label: "cURL", language: "bash" },
];
