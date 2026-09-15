import type { EventDetail } from "../../lib/api";

export function flattenJson(value: unknown, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};

  if (value === null || value === undefined) {
    out[prefix || "value"] = String(value);
    return out;
  }

  if (typeof value !== "object") {
    out[prefix || "value"] = String(value);
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      Object.assign(out, flattenJson(item, `${prefix}[${index}]`));
    });
    return out;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    Object.assign(out, flattenJson(nested, path));
  }

  return out;
}

function eventMetadata(event: EventDetail): Record<string, string> {
  return {
    "event.occurred_at": event.occurred_at,
    "event.environment": event.environment ?? "",
    "event.release": event.release ?? "",
    "event.platform": event.platform ?? "",
    "event.user": event.user_email ?? event.user_id ?? "",
    "event.browser": event.browser_name ?? "",
    "event.os": event.os_name ?? "",
  };
}

export interface DiffRow {
  key: string;
  left: string;
  right: string;
}

export function diffEvents(left: EventDetail, right: EventDetail): DiffRow[] {
  const leftFlat = { ...eventMetadata(left), ...flattenJson(left.payload_json) };
  const rightFlat = { ...eventMetadata(right), ...flattenJson(right.payload_json) };
  const keys = Array.from(new Set([...Object.keys(leftFlat), ...Object.keys(rightFlat)])).sort();

  return keys
    .map((key) => ({
      key,
      left: leftFlat[key] ?? "",
      right: rightFlat[key] ?? "",
    }))
    .filter((row) => row.left !== row.right);
}
