# Sentry → epure migration

Exception-only error monitoring. Keep your official `@sentry/*` SDKs. Change the DSN. epure does not import historical issues, events, or attachments from Sentry. Plan for a clean cutover or a short parallel run; rollback is restoring the old DSN string.

**Time budget:** ~15 minutes after epure is running. For install and health checks, see [QUICKSTART.md](./QUICKSTART.md). For protocol limits and SDK versions, see [COMPATIBILITY.md](./COMPATIBILITY.md).

---

## What moves and what stays behind

| Moves with you | Does not migrate |
|---|---|
| SDK instrumentation (after DSN swap) | Historical issues and event payloads |
| Grouping logic going forward (new fingerprints) | Sentry performance transactions and spans |
| Breadcrumbs and stack traces in new events | Session replay recordings |
| Release tags you send from the SDK | Profiling data and flamegraphs |
| Sourcemaps you re-upload to epure | Sentry alert rule history and mute state |
| Team workflow (rebuilt in epure) | User feedback tied to old `event_id` values |

## 15-minute path

Assumes epure is running and you are logged in.

| Step | Task | Budget |
|---|---|---|
| 0 | Confirm epure is up (`curl` health check) | 1 min |
| 1 | Create org project; copy DSN from Settings → DSN keys | 2 min |
| 2 | Trim SDK config (disable traces, replay, profiling) | 2 min |
| 3 | Swap `dsn` in each service or env var | 3 min |
| 4 | Re-upload sourcemaps to epure per release | 4 min |
| 5 | Trigger a test error; confirm issue in dashboard | 2 min |
| 6 | Rebuild webhooks and alerts (see list below) | 1 min start* |

\*Full webhook rebuild usually continues after cutover.

### Step 1 — DSN only in application code

Migration changes the destination URL, not your error-capture calls.

```javascript
// Before (Sentry SaaS or self-host)
Sentry.init({ dsn: "https://abc@o123.ingest.sentry.io/456" });

// After (epure — host and keys from your project)
Sentry.init({ dsn: "https://{public_key}@errors.example.com/{project_id}" });
```

Use env vars (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, etc.) the same way — only the value changes. No proprietary epure SDK.

### Step 2 — Trim SDK config before cutover

epure ingests exceptions only. Transactions, replay, profiling, and session payloads are discarded. Zero them out when you swap the DSN (Sentry JS SDK 7.x):

```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  profilesSampleRate: 0,
  autoSessionTracking: false,
});
```

Python (`sentry_sdk.init`):

```python
sentry_sdk.init(
    dsn=os.environ["SENTRY_DSN"],
    traces_sample_rate=0.0,
    profiles_sample_rate=0.0,
    auto_session_tracking=False,
)
```

Other SDKs: same rule. See [COMPATIBILITY.md](./COMPATIBILITY.md) for per-language notes.

### Step 3 — Deploy the DSN swap

Roll out by service. Search for `sentry.io`, `ingest.sentry`, and `SENTRY_DSN`. For parallel evaluation, split by environment — do not dual-write one deployment; issue history will not merge.

### Step 4 — Re-upload sourcemaps

Stack frames are readable in epure only when sourcemaps exist **on epure** for that release. Sentry-hosted artifact storage does not transfer.

1. Match the `release` string in your SDK config.
2. Upload with `@sentry/cli`, a bundler plugin, or CI to `POST /api/{project_id}/releases/{version}/files/`.
3. Update CI if upload URLs still point at Sentry.

Phase 1 symbolication is JS/TS sourcemaps only. Other languages group on raw frames.

### Step 5 — Verify first issue

Trigger a test error per environment. Confirm the issue, breadcrumbs, and demangled frames (if maps uploaded).

### Step 6 — Rebuild integrations

Sentry alert rules, integrations, and webhook secrets do not import. Recreate in epure Settings:

| Integration | epure equivalent |
|---|---|
| Issue-created Slack / Discord | Outbound webhook on `issue_created` |
| Regression notifications | Webhook on `regression`; mark issues resolved-in-release first |
| Velocity / spike rules | Velocity spike alerts (rolling window) |
| Generic HTTP notifier | Signed outbound webhooks |
| Per-issue mute schedules | Smart snooze (duration, occurrence, or unique-user thresholds) |
| Release deploy markers | Upload releases + resolve-in-next-release |
| User crash dialog | `POST /api/{project_id}/user-feedback/` |
| Team access | Re-invite members (Owner / Admin / Member) |

epure webhook JSON has its own schema — see Settings.

---

## What breaks / what does not

| Still works (exception path) | Breaks or not supported |
|---|---|
| Official Sentry SDKs with DSN change | Distributed tracing / APM spans |
| Browser CORS preflight on ingest | Session replay playback |
| Envelope + legacy store ingest | Continuous profiling |
| Breadcrumbs, tags, user context | iOS/Android native symbolication (dSYM, ProGuard) |
| Custom `fingerprint` override | Importing Sentry issue IDs or event history |
| JS/TS sourcemaps after re-upload | Sentry Discover, dashboards, and metric alerts |
| Keyboard triage (`j`/`k`/`e`/`i`) | Sentry Performance and Sessions products |
| PII scrubbing at ingest | Assuming 100% wire-protocol parity |

When in doubt, check [COMPATIBILITY.md](./COMPATIBILITY.md) before filing a compat issue.

---

## Rollback

Restore the previous DSN and redeploy. epure stops receiving events immediately. Keep the old DSN in your secrets manager during the first week.

---

## FAQ

**Can I import old Sentry issues?**  
No. Export from Sentry separately if compliance requires archives.

**Can I run both permanently?**  
Split by environment or service only — not the same deployment.

**We use performance monitoring and replay — what now?**  
Keep another tool for those products, or drop them. Trim SDK config either way.

**How is this different from GlitchTip?**  
[GlitchTip](https://glitchtip.com/documentation/install) is a mature MIT option with a broader Sentry-compat surface and a multi-service stack (web, worker, Postgres, Valkey). epure targets teams who want exception-only scope, PostgreSQL RLS tenancy, and a two-container footprint (~82 MiB idle measured 2026-09-12). Choose based on feature scope and ops budget — not a moral ranking.

**Which SDK versions are proven?**  
Browser 7.120.0 (envelope) and Python store are E2E-tested in CI. Node 7.120.0 has parse tests; HTTP ingest is fixture captured only. See [COMPATIBILITY.md](./COMPATIBILITY.md). SDK 8.x is not CI-proven. Test in staging first.

**Does migration change grouping?**  
Yes — new fingerprints and issue IDs. Use manual merge for edge cases.
