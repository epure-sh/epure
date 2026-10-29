import * as React from "react";
import { Input } from "@polar-sh/orbit/Input";
import { Search } from "@polar-sh/orbit/icons";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function InputPreview() {
  const [value, setValue] = React.useState("");

  return (
    <PreviewBlock
      id="input"
      title="Input"
      description="Polar Orbit Input — single-line with optional slots."
    >
      <PreviewRow label="Basic">
        <Input
          placeholder="Enter your name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </PreviewRow>
      <PreviewRow label="Slots" className="mt-3">
        <Input
          placeholder="Search…"
          preSlot={<Search className="h-4 w-4" />}
        />
      </PreviewRow>
    </PreviewBlock>
  );
}
