import assert from "node:assert/strict";
import { groupingLabel } from "./grouping-label";

const base = {
  merge_reason: "crash_site",
  spike_coalesced: 0,
  coalesced_variants: [
    "src/a.ts:charge | timed out after <NUM>ms",
    "src/b.ts:refund | timed out after <NUM>ms",
  ],
};

assert.equal(groupingLabel(base), "Grouped by: Same crash site (2 call paths)");
assert.equal(
  groupingLabel({ ...base, spike_coalesced: 4120 }),
  "Grouped by: Spike coalesced (4,120 events throttled, 2 variants sampled)",
);
assert.equal(
  groupingLabel({ merge_reason: "cycle_folded", spike_coalesced: 0, coalesced_variants: [] }),
  "Grouped by: Loop cycle folded",
);
assert.equal(groupingLabel({ merge_reason: "exact_stack" }), "Grouped by: Exact stack");
