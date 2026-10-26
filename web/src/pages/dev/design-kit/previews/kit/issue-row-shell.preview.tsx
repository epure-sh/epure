import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { IssueRowShell } from "@/components/kit/issue-row-shell";
import { TelemetryChart } from "@/components/kit/telemetry-chart";
import { PreviewBlock } from "../../shared";
const data = [{ time: "12:00", value: 12 }, { time: "12:30", value: 95 }, { time: "13:00", value: 120 }];
export default function IssueRowShellPreview() {
  const [sel, setSel] = React.useState(false);
  return (
    <PreviewBlock id="issue-row-shell" title="IssueRowShell">
      <div className="overflow-hidden rounded-control border border-border-subtle">
        <IssueRowShell id="1" bulkSelected={sel} focused={sel} onSelectChange={setSel} escalating statusBadge={<Badge variant="escalating" size="sm">Spike</Badge>} title="NullPointer in checkout" subtitle="checkout.ts:142" sparkline={<TelemetryChart data={data} height={20} color="escalating" showAxes={false} />} eventsCount="14k" usersCount="832" timeAgo="2m" priority="critical" />
        <IssueRowShell id="2" title="Lock timeout" subtitle="session.rs:88" statusBadge={<Badge variant="regression" size="sm">Reg</Badge>} eventsCount="2k" usersCount="149" timeAgo="14m" priority="high" />
      </div>
    </PreviewBlock>
  );
}