import { TelemetryChart } from "@/components/kit/telemetry-chart";
import { PreviewBlock, PreviewRow } from "../../shared";
const data = [{ time: "12:00", value: 12 }, { time: "12:30", value: 95 }, { time: "13:00", value: 120 }];
export default function TelemetryChartPreview() {
  return (
    <PreviewBlock id="telemetry-chart" title="TelemetryChart">
      <PreviewRow label="Semantic colors">{(["primary","escalating","regression","healthy","info"] as const).map((c) => (
        <div key={c} className="w-32"><p className="mb-1 font-mono text-[10px] text-fg-muted">{c}</p><TelemetryChart data={data} height={64} color={c} showAxes={false} /></div>
      ))}</PreviewRow>
    </PreviewBlock>
  );
}