import { TelemetryChart } from "@/components/kit/telemetry-chart";
import { Sparkline } from "@/ui/sparkline";
import { PreviewBlock, MatrixCell } from "../../shared";

const SERIES = [
  { time: "00", value: 4 },
  { time: "04", value: 8 },
  { time: "08", value: 3 },
  { time: "12", value: 12 },
  { time: "16", value: 7 },
  { time: "20", value: 9 },
];

const SPARK = [2, 5, 3, 8, 4, 9, 6, 7];

export default function ChartPreview() {
  return (
    <PreviewBlock
      id="chart"
      title="Chart"
      description="Sparkline · telemetry — occurrence line charts share this family in product."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <MatrixCell label="Sparkline">
          <Sparkline values={SPARK} className="h-10 w-full" />
        </MatrixCell>
        <MatrixCell label="Sparkline · escalating">
          <Sparkline values={[1, 2, 2, 3, 5, 8, 13, 21]} status="escalating" />
        </MatrixCell>
        <MatrixCell label="Telemetry · primary">
          <TelemetryChart data={SERIES} height={100} color="primary" />
        </MatrixCell>
        <MatrixCell label="Telemetry · escalating">
          <TelemetryChart data={SERIES} height={100} color="escalating" />
        </MatrixCell>
      </div>
    </PreviewBlock>
  );
}
