import type { SetupPlatformId } from "./setup-platform-snippets";
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
  platformId?: SetupPlatformId;
  platformLabel?: string;
  installCommand?: string;
  packageName?: string;
}

const PLATFORM_DOC_PATH: Partial<Record<SetupPlatformId, string>> = {
  javascript: "/platforms/javascript/browser",
  typescript: "/platforms/javascript/browser",
  react: "/platforms/javascript/browser",
  node: "/platforms/javascript/node",
  nextjs: "/platforms/javascript/nextjs",
  python: "/platforms/python",
  go: "/platforms/go",
  php: "/platforms/php",
  ruby: "/platforms/ruby",
  java: "/platforms/java",
  dotnet: "/platforms/dotnet",
};

function platformDocUrl(platformId?: SetupPlatformId): string {
  const path = platformId ? PLATFORM_DOC_PATH[platformId] : undefined;
  return path ? `${EPURE_DOCS_URL}${path}` : `${EPURE_DOCS_URL}/platforms`;
}

/** Condensed skill body embedded in copied prompts (full skill: `.cursor/skills/epure-wire/SKILL.md`). */
export const EPURE_WIRE_SKILL_INSTALL_HINT =
  "Optional: save the skill block below as `.cursor/skills/epure-wire/SKILL.md` in this repo.";

function embeddedSkillBlock(): string {
  return [
    "---",
    "name: epure-wire",
    "description: Wire Epure via official Sentry SDKs; DSN swap for migrations.",
    "---",
    "",
    "# Epure wire",
    "",
    "- Ask: app path, stack, fresh vs Sentry, environment tag.",
    "- Fresh: install Sentry SDK, init with DSN, sample rates 0, one test exception.",
    "- Sentry: replace dsn only; disable tracing/replay/profiling.",
    "- Verify: 202 ingest, issue in Epure within ~30s.",
    `- Docs: ${EPURE_DOCS_QUICKSTART_URL}`,
  ].join("\n");
}

function discoveryBlock(input: SetupAiPromptInput): string[] {
  const stackHint = input.platformLabel
    ? `User picked **${input.platformLabel}** in Epure. Confirm or correct.`
    : "Infer stack from the repo (package.json, go.mod, requirements.txt, etc.).";

  const pathQuestion =
    input.path === "sentry"
      ? "They chose **Sentry migration**. Find existing `Sentry.init`, compare behavior, swap DSN only."
      : "They chose **fresh install**. No prior Sentry, or greenfield in this service.";

  return [
    "## Interactive discovery (do this first)",
    "",
    "Send **one** message with numbered questions. **Wait for answers** before editing files (unless they say skip).",
    "",
    "1. **Scope:** Which app, service, or folder in this repo should send errors to Epure?",
    "2. **Stack:** " + stackHint,
    "3. **Starting point:** " + pathQuestion,
    "4. **Environment:** What should the SDK `environment` tag be (`local`, `staging`, `production`)? Epure’s issue filter must match.",
    input.path === "sentry"
      ? "5. **Sentry today:** Cloud or self-hosted? Keep both side-by-side temporarily, or cut over fully?"
      : "5. **Package manager:** npm, pnpm, yarn, pip, etc. (infer if obvious).",
    "6. **Agent:** Using Cursor Agent? If yes, " + EPURE_WIRE_SKILL_INSTALL_HINT,
  ];
}

function workflowBlock(input: SetupAiPromptInput): string[] {
  const platformDoc = platformDocUrl(input.platformId);

  if (input.phase === "verify") {
    return [
      "## Verify workflow",
      "",
      "Goal: confirm **one exception** reaches Epure Issues.",
      "",
      "1. Ensure the app was restarted after `Sentry.init` changes.",
      "2. Trigger a test error (dev-only guard OK): `captureException(new Error('Epure setup test'))` or equivalent.",
      "3. Tell the user to open Epure **Issues** for this project. The row may take a few seconds after **202** ingest.",
      "4. If empty: check DSN, environment filter, ad blockers, and that the DSN host matches their Epure deployment.",
    ];
  }

  if (input.path === "sentry") {
    return [
      "## Implementation workflow (Sentry → Epure)",
      "",
      "1. Search the repo for `Sentry.init`, `@sentry/`, or `sentry-sdk`.",
      "2. Replace **only** the `dsn` with the Epure DSN below; keep release/environment unless they enable tracing/replay.",
      "3. Set `tracesSampleRate`, `profilesSampleRate`, and replay sample rates to **0**.",
      "4. Summarize what still differs vs Sentry (Epure is exception-only, no replay/APM parity). Link: " +
        EPURE_DOCS_MIGRATION_URL,
      "5. Add or run a one-shot test exception.",
      "",
      "Stack doc: " + platformDoc,
    ];
  }

  return [
    "## Implementation workflow (fresh)",
    "",
    "1. Install the official Sentry SDK for this stack (see platform doc).",
    "2. Initialize at startup with the Epure DSN below; set sample rates to **0** for tracing/replay/profiling.",
    "3. Minimal diff. No extra observability libraries.",
    "4. Add a clear test path for one exception.",
    "",
    "Quickstart: " + EPURE_DOCS_QUICKSTART_URL,
    "Stack doc: " + platformDoc,
  ];
}

export function buildSetupAiPrompt(input: SetupAiPromptInput): string {
  const { dsn, path, phase, projectName, platformLabel } = input;

  return [
    "# Epure setup: wire error monitoring in this repository",
    "",
    "You are a senior engineer pairing with the user. Epure uses **official Sentry SDKs**; Epure-specific config is the **DSN** (and honest exception-only scope).",
    "",
    "## Locked context",
    projectName ? `- Epure project name: **${projectName}**` : null,
    `- DSN (use exactly): \`${dsn}\``,
    `- Setup path: **${path === "sentry" ? "Migrate from Sentry (DSN swap)" : "Fresh install"}**`,
    platformLabel ? `- Stack hint: **${platformLabel}**` : null,
    input.packageName ? `- Package: \`${input.packageName}\`` : null,
    input.installCommand ? `- Install: \`${input.installCommand}\`` : null,
    `- Phase: **${phase === "verify" ? "Verify first issue" : "Connect SDK"}**`,
    "",
    ...discoveryBlock(input),
    "",
    "## Reference docs",
    `- Quickstart: ${EPURE_DOCS_QUICKSTART_URL}`,
    `- Platforms: ${platformDocUrl(input.platformId)}`,
    `- Sentry comparison (migration honesty): ${EPURE_DOCS_MIGRATION_URL}`,
    `- Index: ${EPURE_DOCS_URL}`,
    "",
    "## Optional Cursor skill",
    "",
    EPURE_WIRE_SKILL_INSTALL_HINT,
    "",
    "```markdown",
    embeddedSkillBlock(),
    "```",
    "",
    ...workflowBlock(input),
    "",
    "## Constraints",
    "- Smallest correct diff; no drive-by refactors.",
    "- Exception-only: do not enable transactions, session replay, or profiling.",
    "- Do not claim 100% Sentry parity.",
    "- JS/TS: prefer Sentry SDK **7.x** unless the repo already pins another major.",
    "",
    "## When finished",
    "Reply with: packages installed, files changed, how to trigger the test error, and what they should see in Epure Issues.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}
