---
name: epure-triage
description: >-
  Fix an Epure exception from MCP, epure-cli, or Copy for AI markdown. Use when
  the user pastes an Epure issue, asks to triage a self-hosted Sentry error, or
  names Copy for AI, ⌘⇧C, or Ctrl+Shift+C. Host setup is epure-setup. Tokens
  and tool names are epure-agent.
---

# Epure triage

Prefer tools when `EPURE_URL` and `EPURE_TOKEN` work. Markdown from the dashboard is the same context when they do not.

## Tool path

Follow **epure-agent**:

1. `epure_queue` or `epure-cli queue`.
2. `epure_issue_context` or `epure-cli context ISSUE_UUID --format markdown`.
3. Patch from in-app frames. Run tests.
4. `epure_triage_resolve` or `epure-cli triage resolve` only after the user confirms. `write:triage` required. Ignore and snooze are the same rule.

Production `EPURE_URL` is `https://your-hostname`, not `http://IP:8080`.

## Markdown path

UI: **Copy for AI**, command palette, **⌘⇧C** / **Ctrl+Shift+C**. Built in `web/src/features/issues/export-markdown.ts`.

The paste has a fix prompt, exception summary, in-app stack (vendor frames omitted), breadcrumbs, runtime, tags.

1. Confirm it is an Epure export.
2. Treat that text as ground truth. Do not add tracing, replay, or logs.
3. Minimal patch plus a regression guard when feasible.
4. Tell the user how to verify, then **Resolve** in the UI, or call the triage tool if a token exists.

## If the host is down

Load **epure-setup**. Do not invent a deploy. If login loops on port 8080, they opened HTTP against the prod Secure cookie. Send them to the HTTPS URL.

## Honesty

Partial Sentry compatibility. No APM, log search, or server-side LLM. Footprint numbers only from the README method dated **2026-09-23**, or numbers the user measured.
