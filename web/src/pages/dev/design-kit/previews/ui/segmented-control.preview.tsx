import { useState } from "react";
import { SegmentedControl } from "@polar-sh/orbit/SegmentedControl";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SegmentedControlPreview() {
  const [value, setValue] = useState<"7d" | "30d" | "90d">("7d");
  return (
    <PreviewBlock
      id="segmented-control"
      title="SegmentedControl"
      description="Polar Orbit SegmentedControl."
    >
      <PreviewRow label="Basic">
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
      <PreviewRow label="Size · sm" className="mt-3">
        <SegmentedControl
          size="sm"
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
