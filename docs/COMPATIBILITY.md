# SDK & protocol compatibility

epure is **exception-only error monitoring**. It accepts payloads from official Sentry SDKs when you change the DSN. It does **not** implement the full Sentry protocol.

Phase 1 covers grouped exceptions, readable stacks, breadcrumbs, releases, alerts, and webhooks. Transactions, session replay, profiling, and mobile symbolication are out of scope. If your SDK sends those product lines, epure accepts the HTTP request where applicable, extracts the exception event, and discards the rest.

**Do not expect 100% Sentry parity.** Treat epure as a deliberate subset: production throws → grouped issue → stack you can read → ship the fix.

For the golden path after install, see [QUICKSTART.md](./QUICKSTART.md). For switching from Sentry, see [MIGRATION.md](./MIGRATION.md). Wire contract reference: [ingest.openapi.yaml](./ingest.openapi.yaml).

---

## Test depth legend

Status labels reflect **automated tests in this repository** as of **2026-09-12**. Fixtures live in [`fixtures/sentry/`](../fixtures/sentry/).

| Label | Meaning |
|---|---|
| **E2E tested** | Integration test posts the fixture through the running server (`POST` envelope or store) and asserts a persisted issue row in PostgreSQL. |
| **Parse tested** | Unit test in `crates/envelope` parses the fixture payload without the HTTP stack. |
| **Fixture captured** | Real SDK dump on disk; not exercised end-to-end in CI. Report problems with SDK name + version via [`.github/ISSUE_TEMPLATE/02-compat.yml`](../.github/ISSUE_TEMPLATE/02-compat.yml). |

Sentry JavaScript SDK **8.x and newer** are not CI-proven in this repo. SDKs 7.x match the captured fixtures; newer majors may work but treat them as untested until you verify.

---

## Language matrix (8 fixtures)

| Language | Fixture SDK | Wire path | Parse | Ingest E2E | Sourcemaps |
|---|---|---|---|---|---|
| Browser (JS) | `@sentry/browser` 7.120.0 | envelope | Parse tested | E2E tested | demangle |
| Node.js | `@sentry/node` 7.120.0 | envelope | Parse tested | Fixture captured | demangle |
| Python | — (store fixture) | store | Parse tested | E2E tested | raw frames |
| Go | `sentry-go` 0.28.0 | envelope | Fixture captured | Fixture captured | raw frames |
| Ruby | `sentry-ruby` 5.18.0 | envelope | Fixture captured | Fixture captured | raw frames |
| PHP | `sentry-php` 4.8.0 | envelope | Fixture captured | Fixture captured | raw frames |
| Java | `sentry-java` 7.8.0 | envelope | Fixture captured | Fixture captured | raw frames |
| .NET | `Sentry` 4.9.0 | envelope | Fixture captured | Fixture captured | raw frames |

**Symbolication:** JS/TS stack frames are demangled when you upload `.map` files via the release artifact endpoint. Go, Ruby, PHP, Java, and .NET group on **raw frames** (file, function, line as sent by the SDK). No dSYM, ProGuard, or NDK symbol server in Phase 1.

**CORS:** browser SDK preflight is supported (`OPTIONS` on ingest routes).

**User feedback:** `POST /api/{project_id}/user-feedback/` accepts comments linked to an `event_id`.

---

## Supported ingest endpoints

| Endpoint | Method | Purpose | Response |
|---|---|---|---|
| `/api/{project_id}/envelope/` | `POST` | Primary Sentry envelope ingest | **202 Accepted** (async persist) |
| `/api/{project_id}/envelope/` | `OPTIONS` | CORS preflight for browser SDKs | **200** / **204** |
| `/api/{project_id}/store/` | `POST` | Legacy single-event JSON (gzip/zlib supported) | **202 Accepted** (some legacy SDKs also accept **200**) |
| `/api/{project_id}/store/` | `OPTIONS` | CORS preflight | **200** |
| `/api/{project_id}/releases/{version}/files/` | `POST` | Source map / artifact upload (`@sentry/cli`, CI plugins) | **201 Created** |
| `/api/{project_id}/releases/{version}/files/` | `OPTIONS` | CORS preflight | **204** |
| `/api/{project_id}/user-feedback/` | `POST` | Crash dialog feedback tied to `event_id` | **201 Created** |
| `/api/{project_id}/user-feedback/` | `OPTIONS` | CORS preflight | **204** |

**Authentication:** DSN credentials via `X-Sentry-Auth` header (`Sentry sentry_version=7, sentry_key=…, sentry_secret=…`) or query parameters `sentry_key` + `sentry_secret`. Revoked keys return **403**. Default per-project ingest cap: **5000 events/hour** (excess dropped). Maximum request body: **2 MB**.

Dashboard session cookies are **not** valid on ingest routes.

---

## Envelope item handling

Sentry envelopes are newline-delimited: envelope headers, then repeated `{item_headers}\n{item_payload}` blocks. epure scans items and keeps exception events only.

| Item type | Phase 1 behavior |
|---|---|
| `event` | Parsed, scrubbed, grouped, persisted |
| `transaction` | Accepted at HTTP layer, **discarded** (no APM storage) |
| `attachment` | Ignored (metadata not stored at scale) |
| `session` | Ignored |
| `replay_event` / `replay_recording` | Ignored |
| `profile` / `profile_chunk` | Ignored |
| `check_in` (cron monitor) | Ignored |
| Unknown types | Skipped during scan |

If an envelope contains only non-event items (for example, a transaction with no paired exception), ingest returns **400** with `no event item found in envelope`.

---

## SDK settings — disable unsupported product lines

Official SDKs default to sending transactions, profiles, or replay when those features are enabled. Disable them so clients stop shipping volume epure will discard anyway.

### JavaScript / TypeScript (browser and Node)

```javascript
import * as Sentry from "@sentry/browser"; // or "@sentry/node"

Sentry.init({
  dsn: "http://{public_key}@your-host:8080/{project_id}",
  tracesSampleRate: 0,
  profilesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
```

For SDK v8+, also set `enableTracing: false` if your init options expose it.

### Python

```python
import sentry_sdk

sentry_sdk.init(
    dsn="http://{public_key}@your-host:8080/{project_id}",
    traces_sample_rate=0.0,
    profiles_sample_rate=0.0,
    enable_tracing=False,
)
```

### Go

```go
err := sentry.Init(sentry.ClientOptions{
    Dsn:              "http://{public_key}@your-host:8080/{project_id}",
    TracesSampleRate: 0.0,
    EnableTracing:    false,
})
```

### Ruby

```ruby
Sentry.init do |config|
  config.dsn = "http://{public_key}@your-host:8080/{project_id}"
  config.traces_sample_rate = 0.0
  config.profiles_sample_rate = 0.0
end
```

### PHP

```php
\Sentry\init([
    'dsn' => 'http://{public_key}@your-host:8080/{project_id}',
    'traces_sample_rate' => 0.0,
    'profiles_sample_rate' => 0.0,
]);
```

### Java

```java
Sentry.init(options -> {
    options.setDsn("http://{public_key}@your-host:8080/{project_id}");
    options.setTracesSampleRate(0.0);
    options.setProfilesSampleRate(0.0);
});
```

### .NET

```csharp
SentrySdk.Init(options =>
{
    options.Dsn = "http://{public_key}@your-host:8080/{project_id}";
    options.TracesSampleRate = 0.0;
    options.ProfilesSampleRate = 0.0;
});
```

These settings do not affect exception capture. They reduce wasted bandwidth and SDK-side work for product lines epure does not store.

---

## Explicit non-support (Phase 1)

| Category | Status |
|---|---|
| Distributed tracing / APM spans | Not stored; transaction items discarded |
| Performance monitoring UI | Not built |
| Session replay (DOM) | Not stored |
| Continuous profiling / flamegraphs | Not stored |
| Session health / release health sessions | Not stored |
| Cron monitor check-ins | Ignored |
| Generic log ingestion | Not supported (breadcrumbs inside events only) |
| iOS / Android SDK symbolication | No Cocoa/Android fixtures; no dSYM / ProGuard / NDK |
| Native mobile crash reporting as a launch pillar | Deferred |
| Historical event import from Sentry | Not supported — see [MIGRATION.md](./MIGRATION.md) |
| ClickHouse, Kafka, Redis on the ingest path | Not in OSS stack |
| Dashboard auth on ingest routes | DSN only |

This list is intentional. epure refuses observability-suite scope to keep the self-host footprint small and triage calm.

---

## How epure compares

Measured **epure** figures from this repository (**2026-09-12**, Docker Desktop, M-series Mac). **Competitor figures come from their documentation as of 2026-09** — re-verify before you rely on them for capacity planning.

| | **epure** | **Sentry self-host** | **GlitchTip** |
|---|---|---|---|
| **Scope** | Exception-only subset | Full Sentry product surface | Error tracking (Sentry SDK ingest) |
| **Containers / services** | **2** (Rust app + PostgreSQL 16) | **20+** typical ([self-hosted guide](https://develop.sentry.dev/self-hosted/)) | **4+** (web, worker, Postgres, Valkey) ([install docs](https://glitchtip.com/documentation/install)) |
| **RAM (published minimum)** | **~82 MiB** idle stack (measured) | **16 GB + 16 GB swap** ([self-hosted guide](https://develop.sentry.dev/self-hosted/)); errors-only profile ~7 GB cited in [self-hosted#3298](https://github.com/getsentry/self-hosted/issues/3298) | **512 MB** recommended / **256 MB** minimum ([install docs](https://glitchtip.com/documentation/install)) |
| **Primary database** | PostgreSQL 16 + RLS | PostgreSQL + ClickHouse + others | PostgreSQL |
| **SDK migration path** | Change DSN | Change DSN | Change DSN |
| **JS/TS sourcemaps** | Yes (upload via release files) | Yes | Yes |
| **Transactions / replay / profiling** | Not supported | Supported | Limited / varies by version |
| **License** | Apache 2.0 | BSL (self-host) / SaaS terms | MIT |

**Reading the table:** epure is lighter on infrastructure because it stores a protocol subset, not because it is a drop-in replacement for Sentry self-host. GlitchTip also targets Sentry SDK compatibility with a smaller footprint than full Sentry; compare scope, not logo count.

[Bugsink](https://www.bugsink.com/built-to-self-host/) is another single-container option (SQLite-backed). epure standardizes on PostgreSQL 16 with RLS for multi-tenant dashboard isolation — different storage tradeoff, same “change the DSN” migration shape.

---

## FAQ

### Do transactions work?

No. Transaction envelope items are discarded. Performance traces and APM dashboards are not part of Phase 1. Set `tracesSampleRate` (or language equivalent) to **0** — see [SDK settings](#sdk-settings--disable-unsupported-product-lines).

### What about session replay?

Not supported. Replay envelope items are ignored. Disable replay sample rates in JS SDK init.

### Can I use iOS, Android, or React Native SDKs?

You can point mobile SDKs at your DSN for exception payloads, but epure does **not** symbolicate native mobile stacks (no dSYM, ProGuard, or NDK). Grouping uses raw frames. Mobile is not a Phase 1 launch pillar; verify behavior before production use.

### Is this a drop-in replacement for Sentry self-host?

No. epure implements an **exception ingest subset** of the Sentry wire protocol. Dashboards, alerts, and webhooks are epure-native. Rebuild release artifact uploads, webhook URLs, and alert rules after migration — see [MIGRATION.md](./MIGRATION.md).

### Will my Sentry SDK version work?

CI proves **browser envelope E2E** (`@sentry/browser` 7.120.0), **Python store E2E**, and **parse tests** for browser and Node fixtures. Node HTTP ingest is fixture-captured only (parse unit test passes; no automated ingest test yet). Five other languages have captured fixtures without CI parse or ingest tests. Newer SDK majors may work; open a compatibility issue with SDK name, version, and a redacted envelope if not.

### What happens to attachments and minidumps?

Attachment items in envelopes are skipped. Native minidump upload endpoints are not implemented.

### Does epure support Performance Monitoring or Profiling?

No. Profile and transaction items are discarded. There is no flamegraph UI.

### How is this different from GlitchTip?

Both accept official Sentry SDKs via DSN change. GlitchTip runs more services (web, worker, Valkey) and publishes higher RAM guidance. epure runs two containers, targets exception-only scope, and measured ~82 MiB idle on 2026-09-12. GlitchTip’s feature set evolves independently — compare their docs for replay, uptime monitoring, and org features.

### Why does ingest return 202 but I do not see the issue yet?

Persistence is asynchronous (Tokio worker queue). Under normal load, issues appear in well under a second; warm ingest-to-visible was **~0.18 s** in measurement on 2026-09-12. If nothing appears after several seconds, check DSN revocation, ingest cap (**403** / cap errors), and server logs.

### Can I send events from curl or custom reporters?

Yes. POST JSON to `/api/{project_id}/store/` or a minimal envelope to `/api/{project_id}/envelope/` with valid DSN auth. Examples in [QUICKSTART.md](./QUICKSTART.md).

---

## Reporting compatibility gaps

Use the [compatibility issue template](../.github/ISSUE_TEMPLATE/02-compat.yml). Include:

- SDK name and exact version
- Language/runtime version
- Wire path (envelope or store)
- Redacted payload or steps to reproduce
- Expected vs actual behavior

---

> **Managed hosting:** epure Cloud — Pro $24/mo · Plus $79/mo. Flat pricing, no per-event overage. [epure.sh](https://epure.sh)
