# SDK & protocol compatibility

Exception-only monitoring. Official Sentry SDKs work when you change the DSN. **Not** full Sentry protocol parity.

Phase 1: grouped exceptions, stacks, breadcrumbs, releases, alerts, webhooks. Transactions, replay, profiling, sessions, and mobile symbolication are discarded or unsupported.

Install: [QUICKSTART.md](./QUICKSTART.md) · Cutover: [MIGRATION.md](./MIGRATION.md) · Wire: [ingest.openapi.yaml](./ingest.openapi.yaml)

## Test depth

| Label | Meaning |
|---|---|
| **E2E tested** | HTTP ingest → Postgres issue row in CI |
| **Parse tested** | `crates/envelope` unit parse |
| **Fixture captured** | Real dump on disk; not CI ingest — file [compat issue](../.github/ISSUE_TEMPLATE/02-compat.yml) |

Sentry JS **8.x+** not CI-proven. Fixtures: [`fixtures/sentry/`](../fixtures/sentry/). As of **2026-09-12**.

## Language matrix

| Language | SDK | Wire | Parse | Ingest | Maps |
|---|---|---|---|---|---|
| Browser | `@sentry/browser` 7.120.0 | envelope | Parse | **E2E** | demangle |
| Node | `@sentry/node` 7.120.0 | envelope | Parse | Fixture | demangle |
| Python | store fixture | store | Parse | **E2E** | raw |
| Go | `sentry-go` 0.28.0 | envelope | Fixture | Fixture | raw |
| Ruby | `sentry-ruby` 5.18.0 | envelope | Fixture | Fixture | raw |
| PHP | `sentry-php` 4.8.0 | envelope | Fixture | Fixture | raw |
| Java | `sentry-java` 7.8.0 | envelope | Fixture | Fixture | raw |
| .NET | `Sentry` 4.9.0 | envelope | Fixture | Fixture | raw |

JS/TS demangle needs `.map` upload per release. No dSYM / ProGuard / NDK.

## Endpoints

| Endpoint | Method | Response |
|---|---|---|
| `/api/{project_id}/envelope/` | POST | **202** |
| `/api/{project_id}/store/` | POST | **202** (legacy also accepts **200**) |
| `/api/{project_id}/releases/{version}/files/` | POST | **201** (sourcemaps) |
| `/api/{project_id}/user-feedback/` | POST | **201** |
| same paths | OPTIONS | CORS preflight |

Auth: `X-Sentry-Auth` or `sentry_key` / `sentry_secret` query. Revoked → **403**. Cap: **5000 events/hour**. Body max: **2 MB**. Dashboard cookies do not work on ingest.

## Envelope items

| Item | Behavior |
|---|---|
| `event` | Persist |
| `transaction` / `session` / `replay_*` / `profile*` / `check_in` / `attachment` | Discarded / ignored |
| Envelope with no event | **400** `no event item found` |

## SDK trim (required)

```javascript
Sentry.init({
  dsn: "http://{public_key}@your-host:8080/{project_id}",
  tracesSampleRate: 0,
  profilesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
```

Same idea in every language: zero traces / profiles / replay. Per-language snippets: collapsed below.

<details>
<summary>Python / Go / Ruby / PHP / Java / .NET</summary>

```python
sentry_sdk.init(dsn="...", traces_sample_rate=0.0, profiles_sample_rate=0.0, enable_tracing=False)
```

```go
sentry.Init(sentry.ClientOptions{Dsn: "...", TracesSampleRate: 0.0, EnableTracing: false})
```

```ruby
Sentry.init { |c| c.dsn = "..."; c.traces_sample_rate = 0.0; c.profiles_sample_rate = 0.0 }
```

```php
\Sentry\init(['dsn' => '...', 'traces_sample_rate' => 0.0, 'profiles_sample_rate' => 0.0]);
```

```java
Sentry.init(o -> { o.setDsn("..."); o.setTracesSampleRate(0.0); o.setProfilesSampleRate(0.0); });
```

```csharp
SentrySdk.Init(o => { o.Dsn = "..."; o.TracesSampleRate = 0.0; o.ProfilesSampleRate = 0.0; });
```

</details>

## Not in Phase 1

APM / tracing UI · session replay · continuous profiling · release health sessions · cron check-ins · generic logs · iOS/Android symbolication · historical Sentry import · Redis/Kafka/ClickHouse on the path.

## Compare (dated)

Epure measured **2026-09-12**. Competitor figures from their docs as of **2026-09** — re-verify.

| | **Epure** | **Sentry self-host** | **GlitchTip** |
|---|---|---|---|
| Services | **2** | **20+** ([docs](https://develop.sentry.dev/self-hosted/)) | **4+** ([install](https://glitchtip.com/documentation/install)) |
| RAM | **~82 MiB** idle (measured) | **16 GB + swap** ([guide](https://develop.sentry.dev/self-hosted/)) | **512 MB** rec / **256 MB** min |
| Migration | Change DSN | Change DSN | Change DSN |
| License | Apache 2.0 | BSL / SaaS | MIT |

Epure stores a protocol subset. GlitchTip is a solid MIT option with more services. [Bugsink](https://www.bugsink.com/built-to-self-host/) is single-container/SQLite — different storage tradeoff.

<details>
<summary>FAQ</summary>

**Transactions / replay / profiling?** No. Zero sample rates.

**Mobile SDKs?** Exception payloads may ingest; no native symbolication. Raw frames only.

**Drop-in for Sentry self-host?** No. Exception subset + epure-native UI/alerts.

**SDK versions?** Browser + Python store E2E. Node parse + ingest fixture. Others fixture-only. 8.x unproven.

**202 but no issue?** Async worker (~0.18 s warm). Check DSN / cap / logs.

**Custom reporters?** Yes — envelope or store with DSN auth. Examples in [QUICKSTART.md](./QUICKSTART.md).

</details>

Report gaps: [compat template](../.github/ISSUE_TEMPLATE/02-compat.yml) (SDK, version, wire path, redacted payload).

> **Managed hosting:** Epure Cloud — Pro $24/mo · Plus $79/mo. [epure.sh](https://epure.sh)
