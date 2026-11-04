> Follow-up: the four primary release blockers below are addressed by the durable ingestion implementation. See [the current contract](durable-ingestion.md) for guarantees, bounds and remaining protocol limits. The original audit below records the pre-hardening findings.

# Ingester engineering audit — 2026-11-04

Scope: the uncommitted ingestion changes on top of 5fabdc6. This audit is not a production capacity certification or a claim that Epure outperforms other trackers. Tests used real HTTP requests and local PostgreSQL, with separate restricted ingest/app database roles. No production traffic, customer data, or deployment was changed.

## Design observed

HTTP validates/scrubs the input, applies quota/noise/dedup policies, resolves a preview issue key, applies exact/locus token buckets and enqueues sampled bodies. One worker prepares batches of up to 64. A 250 ms flusher writes suppressed occurrence counts and telemetry. The new code adds source-map AST caching, canonical grouping, wrapper detection, fan-in tracking, four-band SimHash routing, batched event insertion, tag facets and session buckets.

Important wiring gaps: `check_wire_spike` is not called by HTTP ingestion. The worker computes canonical grouping on raw event frames; source-mapped frames are stored separately. The nonempty preview fingerprint still wins, so the new canonical fingerprint does not become the persisted identity. Project grouping configuration is added by the migration but not applied to this call. The new dual-EWMA result is ignored. These are not completed features merely because their unit tests pass.

## Corrections made

- Stored bodies, occurrence totals, hourly counters, body totals, release registration and tag facets now commit in the same per-organization transaction, using `INSERT ... RETURNING`. Conflict/replay rows do not increase those totals.
- Multi-row updates sum duplicate issue IDs and duplicate hourly keys instead of relying on arbitrary PostgreSQL `UPDATE FROM` matches or causing repeated-upsert errors.
- A telemetry flush is atomic across its categories and organizations. Tenant context is explicitly reset inside the transaction. Failed telemetry, suppressed-count and outcome flushes retain their data for retry, including variant labels.
- Map draining removes entries while holding their shard locks. A writer cannot increment an orphaned counter between an atomic swap and a later removal.
- The worker finishes before the shutdown notification triggers the final telemetry flush.
- Removed the worker's locus-only issue shortcut: a canonical locus must not override the actual persisted/custom fingerprint or a later merge.
- The existing issue-upsert path initializes durable grouping fields and rollups instead of inserting a parallel incomplete issue representation.
- Lifecycle processing receives the prior issue state; regression alerts no longer classify every existing issue as new. The existing velocity tracker is recorded after persistence. Unique-user lookups use the scoped state instead of an unscoped read, and failures after commit do not trigger whole-event batch replay.
- Canonical grouping distinguishes semantic templates/error codes, retains line buckets when source context is unavailable, removes immediate caller identity from the causal-site key, and restricts LSH to matching exception/file/function/template scope and adjacent line buckets.
- An unbound wire hash is never suppressed: there must first be a known issue to receive its count. This helper remains outside the active HTTP path.
- The mixed-organization test now uses the actual restricted ingestion pool. Its original assertion used the privileged migration pool, which bypasses RLS.

## Evidence

- Envelope suite: 74 existing tests plus five new adversarial grouping tests passed.
- Server library: 51 tests passed, including failed-flush retention and concurrent drains.
- 20,000 real HTTP events, 16 concurrent clients: exactly 20,000 issue occurrences and 20,000 hourly occurrences; 101 bodies stored and correctly reflected in body counters. A separate issue survives and three deliveries of its SDK event ID count once.
- One measured development-build run acknowledged 20,000 requests in 1.274 seconds (~15,704/s). The complete stress/replay/fault test took 2.96 seconds. This is a heavily coalesced local workload, not sustained durable throughput, a full-body benchmark, or a production SLO.
- Eight threads concurrently recorded 160,000 issue increments and 160,000 tag increments while draining: no increments lost.
- Replayed a persisted batch: no extra occurrence/body count. Injected a real foreign-key failure after counter updates: all changes rolled back; a corrected retry applied both duplicate-key deltas.
- HTTP store, envelope SDK/compression matrix, quota, spike sampling, merge/split and strict-role organization isolation passed.
- On a fresh separate database, source-map processing, real regression webhook delivery, snooze behavior, unique-user tracking and velocity-alert tests passed. Running latest-event tests after historical SDK fixtures can select unrelated future-dated events; this contamination was diagnosed rather than accepted as an ingestion failure.
- Strict all-target Clippy initially found warnings in the incoming changes. Grouping/worker warnings were cleaned up; chunk-upload style warnings are outside this ingestion hardening. Do not claim a warning-free full repository check.

Logs are in `/Users/amomo/Documents/ChatGPT/epure/repairs/ingester-audit/`.

## Remaining release gates, in priority order

1. **Durable acceptance.** HTTP 202 still precedes durable storage; the queue and suppressed counters are RAM. A process kill or host failure can lose acknowledged data. Requeue-on-error and graceful shutdown do not solve this. Introduce a bounded checksummed WAL or durable inbox; acknowledge after the required durability point; replay using durable operation IDs. Persist coalesced counts as durable batch operations too. Test SIGKILL, disk full, truncated WAL, database outage and ambiguous commit responses.
2. **Persistent idempotency.** The short process-local SDK-ID cache is not a cross-replica ledger. Event uniqueness is `(id, occurred_at)`; retrying events without SDK timestamps can produce a different fallback timestamp. Suppressed events have no durable ID receipt. Add an organization/project-scoped receipt with an explicit retention policy, atomically with accepted writes; test retries across restart, replicas and timestamp changes. The verified replay test uses the exact same event timestamp.
3. **Bounded memory and fairness.** Several new per-project/per-frame/per-wire maps are unbounded. Existing idle eviction is not a hard cardinality limit. Enforce global and per-tenant byte/key budgets, TTL and admission control without discarding pending deltas. Test high-cardinality distinct sites, messages, tags, releases and tenants; measure resident memory and prove cold issues survive a noisy neighbor.
4. **Wire the canonical grouping deliberately.** Version the grouping strategy per project and persist aliases/seeds, then use symbolicated frames for actual canonical resolution. Keep SDK custom fingerprints authoritative. Shadow-evaluate first against labeled same-root/different-root pairs from multiple platforms. Measure false merges and false splits separately; compare old/new behavior across cold/warm caches, replay order, restart and multiple replicas. Wrapper names and high fan-in alone are insufficient proof of a shared cause.
5. **Complete event/lifecycle semantics.** Test multi-hop merges, sampled-count milestones/regressions, hour-boundary counts, session timestamp/update semantics, privacy and tag/user totals under suppression. Current stored-body facets and distinct users are sample-derived, not an exact census of all suppressed events. The retained-delta fix is not an exactly-once guarantee for an ambiguous database commit response.
6. **Failure isolation and observability.** One failed body can still fail a batch. Exhausted retries need durable quarantine/replay; record losses per event rather than per batch. Surface queue age/bytes, durable backlog, admission rejections, actual stored versus coalesced counts, retry/dead-letter counts, grouping matches by reason, cache pressure and flush latency.
7. **Publish a reproducible capacity result.** Benchmark an optimized binary with mixed platforms, realistic payload sizes, sourcemap hits/misses and distinct sites; compare against the previous revision on the same hardware. Include p50/p95/p99 HTTP latency and durable lag, CPU, RSS, database IOPS/WAL, recovery time and count reconciliation. Cover sustained floods, full-body traffic, many tenants and prolonged database failure. Set measured SLOs; avoid inferring capacity from acknowledged coalesced traffic.

## Research and its implications

- [Sentry: Issue Grouping — Smarter, Faster, Half as Wrong](https://blog.sentry.io/enhancing-issue-grouping/): production grouping quality requires labeled evaluation and explicit false-merge measurement across platforms. Fewer issues alone is not evidence of better grouping.
- [Google: Detecting near-duplicates for web crawling](https://research.google/pubs/detecting-near-duplicates-for-web-crawling/): SimHash and Hamming candidate lookup are efficient similarity tools. Similarity is not proof that two exceptions share a cause; retain semantic and location guards.
- [Drain, ICWS 2017](https://pinjiahe.github.io/files/pdf/research/ICWS17.pdf): structured online message-template extraction is useful for parameterized messages. It does not replace stack/root-cause identity or a labeled evaluation corpus.
- [OpenTelemetry Collector resilience](https://opentelemetry.io/docs/collector/resiliency/): bounded queues, persistent storage and observable retries are separate parts of reliability. An in-memory retry queue does not survive restart.
- [Vector buffering model](https://vector.dev/docs/architecture/buffering-model/) and [end-to-end acknowledgements](https://vector.dev/docs/architecture/end-to-end-acknowledgements/): make the acknowledgement boundary, durability policy and full-buffer behavior explicit; measure tail latency and recovery, not only writes per second.
- [Cloudflare Queues delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/): at-least-once delivery requires consumer idempotency. Batched additive counters require operation-level receipts if retries must be exactly counted.

## Quick rerun

Use a dedicated local PostgreSQL database with the normal migrations and restricted role credentials. Set `DATABASE_URL`, `EPURE_INGEST_DATABASE_URL` and `EPURE_APP_DATABASE_URL`, then run `scripts/test-ingester.sh`. `EPURE_AUDIT_EVENTS=20000` selects the larger flood. Run latest-event lifecycle fixture suites on fresh data, independently of historical SDK fixtures.
