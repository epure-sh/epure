---
name: epure-wire
description: >-
  Point an official Sentry SDK at an Epure DSN and send one test exception.
  Use when adding Epure error tracking to an app, switching from Sentry by
  changing the DSN, setting SENTRY_DSN, uploading JS source maps, or checking
  that an event arrived. Instance setup is epure-setup. MCP and CLI are
  epure-agent.
---

# Epure wire

Epure has no SDK of its own. Use the official Sentry SDK for the runtime and set its `dsn` to the Epure DSN. If there is no Epure instance yet, load **epure-setup** first.

## Before editing

Ask once, numbered, unless the answers are already known:

1. Which app or package (path)?
2. Runtime: Node, browser, Next.js, Python, Ruby, PHP, Go… Infer it from the files when obvious.
3. Fresh install, or already on Sentry (DSN change only)?
4. The DSN, or where it is stored (for example `SENTRY_DSN` in the environment). Never commit a DSN to a public repo.

## Fresh install

1. Install the official Sentry SDK for the runtime. For Next.js, `npx @sentry/wizard@latest -i nextjs` is fine; then change the DSN it wrote.
2. Initialise it at startup with the Epure DSN.
3. Set `tracesSampleRate`, `profilesSampleRate`, `replaysSessionSampleRate` and `replaysOnErrorSampleRate` to `0`. Epure stores errors only and drops those payloads.
4. Set `environment` to `production`, `staging` or `local`. The Issues view currently filters on exactly these three. Map preview or development deploys to `staging` or `local`, or their events won't show.
5. Add one test path: `Sentry.captureException(new Error("Epure test event"))`, behind a dev guard when appropriate.

```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: "staging",
  sendDefaultPii: false,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  profilesSampleRate: 0,
});
```

## Switching from Sentry

1. Find `Sentry.init` or the framework wrapper (`sentry.client.config.*`, `instrumentation.ts`, etc.).
2. Change only `dsn`. Keep `release`, `environment` and the integrations that aren't tracing or replay.
3. Set the tracing, replay and profiling sample rates to `0`.
4. Suggest trying it on staging first; rolling back means restoring the old DSN.
5. Don't promise performance, replay or Seer parity. Epure tracks errors.

Which SDKs and versions are tested: https://epure.sh/docs/sdk-matrix.

## Source maps (JS/TS only)

Symbolication covers JavaScript and TypeScript. Maps match an event when the event's `release` equals the release they were uploaded to. The supported upload is one HTTP POST per `.map` file to `/api/PROJECT_ID/releases/RELEASE/files/`, authenticated with the DSN key, up to 32 MiB per file. Copy the exact command from https://epure.sh/docs/guides/source-maps.

Uploads through `sentry-cli` or Sentry's bundler plugins don't yet give readable frames on Epure. Don't configure them for Epure. Other languages show raw frames.

## Verify

- Ingest answers **202**. The issue can take about a second to appear.
- The Issues environment filter must match the SDK `environment`.
- Nothing shows: wrong DSN, wrong project id in the DSN path, a network block, or an environment outside production/staging/local.
- **401** `invalid_dsn` with a public-key DSN means the self-hosted server is older than v0.1.5; upgrade it. Official SDKs don't send a secret key.

## Report back

Packages installed, files changed, the test command, and what should appear under **Issues**. Then offer **epure-agent** so the coding agent can read issues directly.

Docs: https://epure.sh/docs/platforms · https://epure.sh/guides/point-your-dsn · https://epure.sh/guides/verify-ingest
