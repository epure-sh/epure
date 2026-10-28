import type { IssueSummary } from "./api";

export function groupingLabel(
  issue: Pick<IssueSummary, "merge_reason" | "spike_coalesced" | "coalesced_variants">,
): string | null {
  const variants = Array.isArray(issue.coalesced_variants) ? issue.coalesced_variants.length : 0;
  const coalesced = issue.spike_coalesced ?? 0;
  if (coalesced > 0) {
    const sampled = variants > 0 ? `, ${variants} variants sampled` : "";
    return `Grouped by: Spike coalesced (${coalesced.toLocaleString("en-US")} events throttled${sampled})`;
  }
  switch (issue.merge_reason) {
    case "crash_site":
      return variants > 1
        ? `Grouped by: Same crash site (${variants} call paths)`
        : "Grouped by: Same crash site";
    case "cycle_folded":
      return "Grouped by: Loop cycle folded";
    case "message_template":
      return "Grouped by: Templated message";
    case "custom":
      return "Grouped by: SDK fingerprint";
    case "exact_stack":
      return "Grouped by: Exact stack";
    default:
      return null;
  }
}
