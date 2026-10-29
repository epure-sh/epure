import { useState } from "react";
import {
  CreateMonitorPanel,
  emptyMonitorDraft,
  type CreateMonitorDraft,
} from "@/components/kit/create-monitor";
import { applyTemplate } from "@/components/kit/create-monitor-model";
import { MonitorDurationStrip } from "@/components/kit/monitor-duration-strip";
import { MonitorRow, MonitorTable } from "@/components/kit/monitor-row";
import { PreviewBlock } from "../../shared";

const SAMPLE_RUNS = Array.from({ length: 36 }, (_, i) => {
  const status =
    i === 30 ? "error" : i === 18 ? "missed" : i === 35 ? "in_progress" : "ok";
  const base = 1200 + i * 90 + (i % 4) * 200;
  return {
    id: `run-${i}`,
    status,
    duration_ms: status === "missed" ? null : base,
    created_at: new Date(Date.now() - (36 - i) * 4.5 * 3600_000).toISOString(),
    issue_id: null,
  };
});

export default function MonitorPreview() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [created, setCreated] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>("m1");
  const [draft, setDraft] = useState<CreateMonitorDraft>(() =>
    applyTemplate(
      {
        ...emptyMonitorDraft("production"),
        name: "Nightly Stripe Payouts",
        slug: "nightly-stripe-payouts",
      },
      "nightly",
    ),
  );

  return (
    <>
      <PreviewBlock
        id="monitor-table"
        title="Monitor table"
        description="Issues-style hairlines. Medium dots · avg %. Click expands the same row."
      >
        <MonitorTable>
          <MonitorRow
            monitor={{
              id: "m1",
              name: "Nightly Stripe Payouts",
              slug: "nightly-stripe-payouts",
              environment: "production",
              status: "error",
              paused: false,
              scheduleHuman: "Every day at 2:00 AM (Europe/Paris)",
              scheduleRaw: "0 2 * * *",
              timezone: "Europe/Paris",
              lastCheckInAt: new Date(Date.now() - 4 * 60_000).toISOString(),
              lastDurationMs: 4100,
              nextLabel: "Next in 23h 56m",
              runs: SAMPLE_RUNS,
            }}
            expanded={expandedId === "m1"}
            onToggle={() => setExpandedId((id) => (id === "m1" ? null : "m1"))}
          />
          <MonitorRow
            monitor={{
              id: "m2",
              name: "Billing Sync",
              slug: "billing-sync",
              environment: "production",
              status: "ok",
              paused: false,
              scheduleHuman: "Every 15 mins",
              scheduleRaw: "every 15 minute",
              timezone: "UTC",
              lastCheckInAt: new Date(Date.now() - 8 * 60_000).toISOString(),
              lastDurationMs: 820,
              nextLabel: "Next in 7m",
              runs: SAMPLE_RUNS.filter((_, i) => i % 2 === 0),
            }}
            expanded={expandedId === "m2"}
            onToggle={() => setExpandedId((id) => (id === "m2" ? null : "m2"))}
          />
        </MonitorTable>
      </PreviewBlock>

      <PreviewBlock
        id="monitor-strip"
        title="History dots"
        description="Past 7 days as medium rectangle dots + avg %."
      >
        <MonitorDurationStrip runs={SAMPLE_RUNS} />
      </PreviewBlock>

      <PreviewBlock
        id="monitor-create"
        title="Create monitor"
        description="3-step wizard like alerts: template → setup → defaults / snippet."
      >
        <div className="max-w-lg overflow-hidden rounded-panel border border-border-subtle">
          <CreateMonitorPanel
            step={step}
            draft={draft}
            created={created}
            listening={created}
            connected={false}
            projectId="proj_demo"
            onChange={setDraft}
            onStep={setStep}
            onCreate={() => setCreated(true)}
            onSendTest={() => undefined}
            onDone={() => {
              setStep(1);
              setCreated(false);
            }}
          />
        </div>
      </PreviewBlock>
    </>
  );
}
