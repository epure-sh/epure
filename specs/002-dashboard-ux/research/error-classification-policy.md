# Error classification policy

**Status:** Ratified research (2026-09-13)  
**Agent:** [Error classification feasibility research](d2d7ce91-ad73-4a5e-82c9-eee0fc328c4d)

---

## Summary

**Classify by SDK severity level — yes (mostly shipped).**  
**Classify by product area — Phase 1b only (D11 gated).**  
**Separate “critical” priority field — no; use `level:error` / `level:fatal`.**  
**Exception type taxonomy UI — no; grouping + title is enough.**

---

## What exists today

| Dimension | Stored? | Filterable? | UI |
|-----------|---------|-------------|-----|
| **SDK level** (`fatal`, `error`, `warning`, `info`, `debug`) | `issues.level` from ingest | `level:` query + chips (`error`, `warning`) | Row meta, Overview badge |
| **Exception type** | In `title` + fingerprint hash | Free-text title search only | Title line 1 |
| **Product area** (Auth, Payments, UI) | Heuristics not shipped | — | D11 skipped (80% gate) |
| **Custom priority / critical** | Not in schema | — | Refused |

---

## Recommendations

### Ship / keep (P1)

- Level filter chips (`Error`, `Warning`; optional add `Fatal`)
- Level in row meta and Overview — text label, not dot + text
- Plain-language copy: “Critical issues” → `level:error` preset where helpful

### Phase 1b (gated)

- Area heuristics + filter chips + optional “By area” strip (M5–M6)
- Requires 80% seed-fixture accuracy before UI

### Refused

- ML priority, per-org severity, exception-type sidebar, mandatory domain labels
- Home charts or stat dimensions by type/area

---

## “Critical” mapping

No separate field. In Sentry terms:

- `fatal` + `error` → act-now triage
- `warning` → investigate when time allows
- UI may group `fatal` under Error chip or add a third chip if volume warrants

---

## Open polish (optional)

- [ ] Add `level:fatal` filter chip if ingest volume shows fatals distinct from errors
- [ ] D11 area heuristics when seed gate passes

---

## References

- [metrics-layout-verdict.md](./metrics-layout-verdict.md) — category policy, D11 skip
- [issue-surface-spec.md](./issue-surface-spec.md) — level dot vs meta
- `web/src/features/issues/query-utils.ts` — level presets
- `crates/storage/src/issues.rs` — `issues.level`
