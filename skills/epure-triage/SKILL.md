---
name: epure-triage
description: >-
  Triage self-hosted Epure / Sentry-compatible exceptions in Cursor or Claude Code.
  Use when the user mentions Epure, DSN swap, Markdown issue export, Copy for AI,
  production exceptions from a self-hosted Sentry alternative, or fixing issues
  exported from the Epure dashboard. Prefer Markdown clipboard today; use MCP
  tools only if the user already configured them.
---

# Epure triage (Markdown → fix → resolve)

Epure ships a **Markdown / Copy for AI** bridge today. Agents should root-cause from that export, propose a minimal patch, and leave resolve to the human UI unless MCP write tools are explicitly available.

## When to use

- User pasted Epure “Copy for AI” / issue Markdown
- “Triage this Epure / self-hosted Sentry issue”
- After `epure-setup`, first production exception landed
- Mentions of ⌘⇧C / Ctrl+Shift+C / command palette “Copy for AI”

## Product facts (do not hallucinate)

- **Ingest:** official Sentry SDKs → Epure DSN (envelope/store). Exception-focused.
- **UI action:** Issues view button **Copy for AI**; command palette; hotkey **⌘⇧C** (macOS) / **Ctrl+Shift+C** (others). Implemented in `web/src/features/issues/export-markdown.ts` (`buildIssueAiClipboard` → prompt + `buildIssueExportMarkdown`).
- **Clipboard contents typically include:** one-shot fix prompt (root cause / culprit / patch / regression guard), exception summary, in-app stack (vendor frames omitted), breadcrumbs, runtime + tags, user journey hints.
- **Also:** “Copy for AI & ignore” exists on resolve-with-AI dialog — same export family; still no server-side LLM.

## Workflow (today — no MCP required)

1. Confirm the paste is an Epure export (look for the fix prompt headers and issue metadata).
2. Treat stacks/breadcrumbs as ground truth; **do not invent** tracing, replay, logs, or metrics Epure did not capture.
3. Identify likely culprit (prefer in-app frames with source context).
4. Propose a **minimal** patch + a regression test or guard when feasible.
5. Tell the user how to verify (repro → new event or silence) and to **Resolve** (or ignore) in the Epure dashboard.
6. If setup is missing, point them at `epure-setup` / README try-path — do not invent deploy paths.

### Suggested assistant stance when user pastes export

```text
Root-cause from the Epure Markdown only. Propose a concrete patch.
Do not invent telemetry Epure doesn’t store (traces, replay, logs).
Call out uncertainty when frames lack context / sourcemaps.
```

## MCP (optional — only if already configured)

A thin triage MCP is **planned** (tools along the lines of `list_issues`, `get_issue`, `get_latest_event`, `export_issue_markdown`, `update_issue`, `list_projects`). **Do not claim MCP is available** unless the user’s environment already exposes those tools.

If MCP **is** present:

1. `list_issues` (unresolved) → pick issue  
2. `export_issue_markdown` / `get_latest_event`  
3. Patch in the working tree  
4. `update_issue` with `resolve` only after user confirms the fix  

If MCP is **absent**: Markdown clipboard + UI resolve is the complete supported loop.

## Honesty constraints

- Partial Sentry compatibility — don’t promise every SDK feature works.
- Out of scope: APM, log search, Seer-style “analyze on server”, creating issues via agent as a primary path.
- Footprint / perf claims: only cite dated README method (**2026-09-23** `docker stats`) or user-supplied numbers.

## Install line (for humans sharing the skill)

```bash
npx skills add epure-sh/epure --skill epure-triage
```

(Requires these files merged under `skills/epure-triage/` in `epure-sh/epure`.)
