import { useState } from "react";
import { AlertDetailPanel } from "@/features/alerts/alert-detail-panel";
import { AlertListRow } from "@/features/alerts/alert-row";
import { AlertsSectionToggle } from "@/features/alerts/alerts-section-toggle";
import { PreviewBlock, PreviewRow } from "../shared";
import { DESIGN_KIT_SAMPLE_ALERTS } from "../fixtures/sample-alerts";

const project = "550e8400-e29b-41d4-a716-446655440000";

export function AlertsSection() {
  const [section, setSection] = useState<"history" | "configure">("history");
  const [focusedId, setFocusedId] = useState(DESIGN_KIT_SAMPLE_ALERTS[0]?.id ?? "");
  const focused =
    DESIGN_KIT_SAMPLE_ALERTS.find((row) => row.id === focusedId) ??
    DESIGN_KIT_SAMPLE_ALERTS[0] ??
    null;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-fg-primary">Alerts patterns</h2>
        <p className="max-w-2xl text-xs leading-relaxed text-fg-muted">
          History master–detail: alert title with error title underneath (no firing badge / +N proof).
          Full seed data lives in{" "}
          <code className="font-mono text-[11px]">playground/fixtures/seed.ts</code>.
        </p>
      </div>

      <PreviewBlock id="alerts-toggle" title="Section toggle" description="History | Configure">
        <AlertsSectionToggle value={section} onChange={setSection} />
      </PreviewBlock>

      <PreviewBlock
        id="alerts-master-detail"
        title="History list + detail"
        description="Select a row — title + error line only"
      >
        <div className="grid min-h-[22rem] overflow-hidden rounded-panel border border-border-subtle lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-3 overflow-auto border-b border-border-subtle bg-canvas p-4 lg:border-b-0 lg:border-r">
            {DESIGN_KIT_SAMPLE_ALERTS.map((alert) => (
              <AlertListRow
                key={alert.id}
                alert={alert}
                layout="embedded"
                detailActive={alert.id === focusedId}
                onActivate={() => setFocusedId(alert.id)}
              />
            ))}
          </div>
          <AlertDetailPanel
            alert={focused}
            projectId={project}
            webhookCount={2}
            onAcknowledge={() => undefined}
            onReopen={() => undefined}
            onMute={() => undefined}
            onUnmute={() => undefined}
          />
        </div>
      </PreviewBlock>

      <PreviewRow label="Live app">
        <p className="text-xs text-fg-muted">
          Acme Web → Alerts uses 18+ seeded signals. Reset:{" "}
          <code className="font-mono text-[11px]">window.__EPURE_PLAYGROUND__.reset()</code>
        </p>
      </PreviewRow>
    </section>
  );
}
