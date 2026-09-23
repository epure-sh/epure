import type { TimelineBucket } from "../../lib/api";
import { fetchProjectActivity } from "../../lib/api";
import { emptyListTrendBuckets } from "../issues/issue-feed-utils";

/**
 * Soften day spikes into a rounder curve for project-card sparklines.
 * Does not invent volume — only adjacent-day averaging for visual rounding.
 */
export function roundProjectActivityBuckets(
  buckets: TimelineBucket[],
): TimelineBucket[] {
  if (buckets.length === 0) {
    return buckets;
  }

  return buckets.map((bucket, index) => {
    const left = buckets[Math.max(0, index - 1)].count;
    const mid = bucket.count;
    const right = buckets[Math.min(buckets.length - 1, index + 1)].count;
    return {
      ...bucket,
      count: Math.max(0, Math.round((left + mid * 3 + right) / 5)),
    };
  });
}

/** Load real 30d project event histogram (server-side), then lightly round. */
export async function fetchProjectActivityBuckets(
  projectId: string,
): Promise<TimelineBucket[]> {
  try {
    const buckets = await fetchProjectActivity(projectId);
    if (buckets.length === 0) {
      return emptyListTrendBuckets();
    }
    return roundProjectActivityBuckets(buckets);
  } catch {
    return emptyListTrendBuckets();
  }
}
