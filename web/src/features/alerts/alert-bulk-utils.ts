import type { AlertRow } from "../../lib/api";

export type BulkAlertAvailability = {
  resolve: boolean;
  reopen: boolean;
  snooze: boolean;
  unsnooze: boolean;
};

export function bulkAlertAvailability(alerts: AlertRow[]): BulkAlertAvailability {
  if (alerts.length === 0) {
    return { resolve: false, reopen: false, snooze: false, unsnooze: false };
  }
  return {
    resolve: alerts.some((row) => !row.read_at && !row.ignored),
    reopen: alerts.some((row) => Boolean(row.read_at) && !row.ignored),
    snooze: alerts.some((row) => !row.ignored),
    unsnooze: alerts.some((row) => row.ignored),
  };
}
