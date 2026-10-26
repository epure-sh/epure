import { Progress, SegmentedProgress } from "@/components/ui/progress";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function ProgressPreview() {
  return (
    <PreviewBlock id="progress" title="Progress">
      <PreviewRow label="Value"><Progress value={62} className="max-w-xs" indicatorClassName="bg-accent" /></PreviewRow>
      <PreviewRow label="Segmented"><SegmentedProgress className="max-w-xs" segments={[{ value: 40, className: "bg-healthy" }, { value: 25, className: "bg-regression" }, { value: 15, className: "bg-escalating" }]} /></PreviewRow>
    </PreviewBlock>
  );
}