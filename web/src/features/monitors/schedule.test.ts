import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCountdown,
  humanizeSchedule,
  nextRunDates,
  parseStoredSchedule,
  scheduleToStorage,
  slugifyMonitorName,
} from "./schedule";

describe("monitor schedule helpers", () => {
  it("slugifies monitor names", () => {
    assert.equal(slugifyMonitorName("Nightly Stripe Payouts"), "nightly-stripe-payouts");
  });

  it("round-trips interval schedules", () => {
    const stored = scheduleToStorage({ type: "interval", value: 15, unit: "minute" });
    assert.equal(stored, "every 15 minute");
    const parsed = parseStoredSchedule(stored);
    assert.deepEqual(parsed, { type: "interval", value: 15, unit: "minute" });
    assert.equal(humanizeSchedule(parsed!), "Every 15 mins");
  });

  it("humanizes daily crontab", () => {
    const schedule = parseStoredSchedule("0 2 * * *", "Europe/Paris");
    assert.ok(schedule);
    assert.match(humanizeSchedule(schedule!), /02:00|2:00/);
  });

  it("estimates interval next runs", () => {
    const from = new Date("2026-10-29T12:00:00Z");
    const runs = nextRunDates(
      { type: "interval", value: 15, unit: "minute" },
      3,
      from,
    );
    assert.equal(runs.length, 3);
    assert.equal(runs[0].toISOString(), "2026-10-29T12:15:00.000Z");
  });

  it("formats overdue countdown", () => {
    const past = new Date(Date.now() - 3 * 60_000).toISOString();
    assert.match(formatCountdown(past), /Overdue/);
  });
});
