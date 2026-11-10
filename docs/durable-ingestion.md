# Durable ingestion contract

The PostgreSQL commit is the event-acceptance boundary. HTTP 202 for an admitted error means its SDK-ID receipt and queued work have committed. The in-memory channel carries at most one empty wake-up signal; it never owns accepted event data. PostgreSQL storage, fsync, synchronous commit and its volume/backups remain the durability foundation.

A valid SDK event UUID is deduplicated per project across replicas, retries and restarts. Completed receipts remain for at least seven days (daily cleanup); pending and quarantined jobs do not expire. Requests without an SDK ID receive a generated ID and cannot be deduplicated if the sender generates a fresh identity on retry. A changed timestamp does not change the receipt identity. Timestamp fallback is normalized once before admission.

Workers claim up to 64 jobs and about 8 MiB per batch with SKIP LOCKED and two-minute leases. A single oversized admitted job is processed alone. Expired leases are reclaimable by any worker. Body inserts and occurrence/body counters share one transaction. A replay of the same durable body timestamp does not add counts. Suppressed-event counter updates, receipt completion and backlog-budget release share one transaction, so a lost commit reply cannot double the count. Failed jobs retry with capped exponential delay; after 20 attempts they remain quarantined and make readiness fail. One bad body is isolated from the rest of its batch.

## Capacity and overload

- Global pending limit: 512 MiB or 100,000 jobs.
- Per-workspace pending limit: 64 MiB or 25,000 jobs.
- Sample-state admission: 20,000 exact/locus keys globally and 1,024 of each per project. Saturation rejects a new key explicitly; existing keys and other projects retain available capacity.
- Ingestion concurrency: 16 requests per process for envelope, store, and user feedback. Those bodies are limited to 2 MiB. Envelope decompression limit is 10 MiB. Release-file uploads are a separate route: 2 at a time, streamed to disk, 32 MiB per file.
- Queued stacks retain the innermost 128 frames. Source-map files above 32 MiB are not parsed; source-map cache has a 64 MiB estimated-weight budget and is keyed by artifact revision, project and release. Source context lines are bounded to 2,048 characters.
- Velocity tracking uses at most 5,000 active issues and 258 bounded time buckets per issue. It is an approximate alerting window, with bucket width `window / 128`; it is not the authoritative occurrence count.

A full durable backlog or sampler returns 503 rather than acknowledging data it cannot retain. Retrying with the same SDK ID is safe within the receipt retention period. Hourly full-body quotas are also reserved in PostgreSQL, so restarting or adding a replica cannot reset the authoritative quota. Counters do not consume a full-body quota, but a counter is admitted only if its canonical issue or an accepted body exists.

These are bounded defaults, not a throughput promise. Source-map cache weights estimate retained structures, not total process RSS. Deployment capacity still needs monitoring against actual payload distribution and storage latency.

## Grouping revision 2

The public preview and canonical functions now share the same deterministic logic. The worker groups on source-mapped frames, respects project `in_app_include`, and preserves SDK fingerprints. A release-scoped raw key is pinned to a durable canonical alias. Automatic matching requires the same exception, file, function and message template, with guarded Hamming/adjacent-line matching over at most 128 indexed candidates. A project advisory lock serializes alias decisions across replicas; process-local learned fan-in state does not decide production identity. Merge chains are followed to their root.

Different generated bundles can resolve to the same original source issue. Different semantic codes, functions and distant throw sites remain separate in the regression corpus. This is not a claim of perfect grouping: source context and message normalization are heuristics. Existing issue rows are preserved; revision 2 can create a new issue where an older grouping key differed. Stable aliases prevent subsequent cache/restart churn.

## Operations

`/health/ready` now reads the durable backlog. It reports pending jobs, pending bytes and durable lag, and returns 503 for a quarantined job or lag above five minutes. Completed job payloads are cleared immediately; only their receipts remain. Dead letters deliberately retain their payload for repair.

Administrative inspection (inside the database container):

```sql
SELECT status,count(*),min(created_at) FROM ingest_inbox GROUP BY status;
SELECT project_id,event_id,attempts,last_error FROM ingest_inbox WHERE status='dead';
```

After correcting a diagnosed cause, an administrator can replay a selected quarantined receipt without deleting its durable identity:

```sql
UPDATE ingest_inbox SET status='pending',attempts=0,available_at=now(),last_error=NULL
WHERE project_id='<project UUID>' AND event_id='<event UUID>' AND status='dead';
```

Do not delete pending work to silence readiness. Keep database backups and the prior application image before an upgrade. A binary rollback does not remove the durable inbox; finish or replay its jobs on a compatible worker.

Session aggregates commit before acknowledging their envelope. Their current protocol parser does not provide a durable individual-session update ID; do not interpret their retry behavior as exactly-once session accounting. Unique-user counts and tag facets under flood suppression remain sample-derived. External webhook delivery is at least once; receivers should deduplicate delivery IDs.

## Verification

Run `scripts/test-ingester.sh` with dedicated local `DATABASE_URL`, restricted `EPURE_INGEST_DATABASE_URL` and `EPURE_APP_DATABASE_URL`; set `EPURE_AUDIT_EVENTS=20000` for the larger flood. The committed recovery test covers two independent runtimes, concurrent duplicate admission, interruption between body commit and receipt completion, lease reclaim, invalid clock fallback, replay and explicit backlog rejection. Existing SDK, sourcemap, quota, tenant-isolation and alert suites accompany it. Preserve production rollback and measure live readiness after deployment.
