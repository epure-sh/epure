import { useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SegmentedControlPreview() {
  const [value, setValue] = useState<"7d" | "30d" | "90d">("7d");
  return (
    <PreviewBlock
      id="segmented-control"
      title="SegmentedControl"
      description="Orbit SegmentedControl"
    >
      <PreviewRow label="Window">
        <SegmentedControl
          value={value}
          onChange={setValue}
          options={[
            { value: "7d", label: "7d" },
            { value: "30d", label: "30d" },
            { value: "90d", label: "90d" },
          ]}
        />
      </PreviewRow>
    </PreviewBlock>
  );
}
