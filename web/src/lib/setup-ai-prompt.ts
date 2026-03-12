import {
  EPURE_DOCS_MIGRATION_URL,
  EPURE_DOCS_QUICKSTART_URL,
  EPURE_DOCS_URL,
} from "./docs-url";

export type SetupPath = "fresh" | "sentry";

export type SetupPhase = "connect" | "verify";

export interface SetupAiPromptInput {
  dsn: string;
  path: SetupPath;
  phase: SetupPhase;
  projectName?: string;
}

export function buildSetupAiPrompt({
  dsn,
  path,
  phase,
  projectName,
}: SetupAiPromptInput): string {
  const guideUrl = path === "sentry" ? EPURE_DOCS_MIGRATION_URL : EPURE_DOCS_QUICKSTART_URL;

  return [
    "# Wire Epure error monitoring into my app",
    "",
    "You are a senior engineer. Integrate **Epure** (Sentry-compatible error monitoring) in **one response**.",
    "",
    "## Context",
    projectName ? `- Project: **${projectName}**` : null,
    `- DSN: \`${dsn}\``,
    `- Docs: ${guideUrl} (follow for stack-specific steps)`,
    phase === "verify" ? "- Goal: confirm a test error reaches Epure." : "- Goal: install SDK and call Sentry.init with this DSN.",
    "",
    "## Do",
    path === "sentry"
      ? "1. Find existing Sentry.init — replace only the `dsn` value.\n2. Keep other SDK options; set traces/replay/profiling sample rates to 0.\n3. Trigger one test error."
      : "1. Install the official Sentry SDK for my stack.\n2. Call Sentry.init with the DSN at app startup.\n3. Trigger one test error.",
    "",
    "## Constraints",
    "- Minimal diff. No transactions, replay, or profiling.",
    `- Full guide: ${EPURE_DOCS_URL}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
