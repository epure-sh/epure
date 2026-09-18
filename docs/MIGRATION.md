# Sentry → Epure migration

Keep your official `@sentry/*` SDKs. Change the DSN. No historical import. Rollback = restore the old DSN.

**~15 min** after Epure is up. Install: [QUICKSTART.md](./QUICKSTART.md) · Limits: [COMPATIBILITY.md](./COMPATIBILITY.md)

## What moves

| Moves | Stays behind |
|---|---|
| SDK instrumentation (DSN swap) | Old issues / events / attachments |
| New fingerprints going forward | Transactions, replay, profiles |
| Breadcrumbs + stacks in new events | Sentry alert history |
| Sourcemaps you re-upload | Feedback tied to old `event_id`s |

## Path

| Step | Task |
|---|---|
| 1 | Create project · copy DSN from Settings → DSN keys |
| 2 | Zero traces / replay / profiles in SDK init |
| 3 | Swap `dsn` (or `SENTRY_DSN`) per service |
| 4 | Re-upload JS/TS maps to Epure for each release |
| 5 | Throw a test error · confirm issue |
| 6 | Rebuild webhooks / alerts / invites in Settings |

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

Do not dual-write one deployment. Split by environment if you need a parallel run. Maps do not transfer from Sentry storage — upload to `POST /api/{project_id}/releases/{version}/files/`.

### Rebuild in Epure

| Sentry | Epure |
|---|---|
| Slack / Discord on new issue | Webhook `issue_created` |
| Regression alerts | Webhook `regression` + resolve-in-release |
| Velocity rules | Velocity alerts |
| Mute schedules | Smart snooze |
| Team access | Re-invite (Owner / Admin / Member) |

## Breaks / still works

| Works | Does not |
|---|---|
| Official SDKs via DSN | APM / tracing UI |
| Envelope + store | Replay / profiling |
| JS/TS maps after re-upload | Native mobile symbolication |
| Keyboard triage | Importing Sentry history |

## Rollback

Put the old DSN back and redeploy. Keep it in secrets for the first week.

<details>
<summary>FAQ</summary>

**Import old issues?** No. Archive in Sentry if you need them.

**Run both forever?** Only split by env/service — not one binary dual-write.

**Need replay/APM?** Keep another tool for those. Trim SDK either way.

**GlitchTip?** Mature MIT option, more services. Epure = exception-only, 2 containers, ~82 MiB idle (2026-09-12).

**SDK versions?** Browser + Python E2E. See [COMPATIBILITY.md](./COMPATIBILITY.md). 8.x not CI-proven.

**Grouping?** New fingerprints and IDs. Merge manually when needed.

</details>
