---
name: epure-wire
description: >-
  Point an official Sentry SDK at an Epure DSN and send one test exception.
  Use when integrating Epure, swapping from Sentry, setting SENTRY_DSN, or
  confirming a 202 and an issue. Host setup is epure-setup. Triage is epure-agent.
---

# Epure wire

No Epure client SDK. Use the official Sentry SDK and set `dsn` to the Epure DSN from the project settings.

If Epure is not running, load **epure-setup** first. Production DSNs use the HTTPS hostname, not port 8080.

## Before editing

Ask once, numbered, unless the user already answered:

1. Which app or package (path)?
2. Runtime (Node, browser, Next.js, Python, …). Infer from files when obvious.
3. Fresh install, or already on Sentry (DSN swap only)?
4. Environment tag: `local`, `staging`, or `production`.

## Fresh install

1. Install the official Sentry SDK for that runtime.
2. `Sentry.init` (or the runtime equivalent) at startup with the DSN.
3. Set `tracesSampleRate`, `profilesSampleRate`, and replay sample rates to `0`.
4. One test path: `captureException(new Error("Epure setup test"))`, behind a dev guard when appropriate.

## Sentry migration

1. Find `Sentry.init` or the framework wrapper.
2. Replace only `dsn`. Keep release, environment, and integrations that are not tracing or replay.
3. Set tracing, replay, and profiling sample rates to `0`.
4. Epure stores exceptions. Do not promise performance or replay parity.

## Verify

- Ingest returns **202**. The issue can lag about a second.
- Match the Epure environment filter to the SDK `environment` tag.
- Empty list: wrong DSN, wrong project id in the URL, network block, or filter mismatch.
- **401** `invalid_dsn` on a public-key DSN: host must be **v0.1.5+**. Official SDKs do not send a secret. `EPURE_INGEST_PASSWORD` is the Postgres role, not an SDK field.

## After the issue exists

Load **epure-agent** (queue, context, resolve) or **epure-triage** if the user pasted Copy for AI markdown.

## Docs

- https://epure.sh/docs/get-started/quickstart
- https://epure.sh/docs/platforms

## Output

Packages installed, files touched, the test command, and what should show under Issues.
