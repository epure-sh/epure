import * as React from "react";
import { Checkbox } from "@polar-sh/orbit/Checkbox";
import { Text } from "@polar-sh/orbit/Text";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function CheckboxPreview() {
  const [a, setA] = React.useState(false);
  const [b, setB] = React.useState(true);
  return (
    <PreviewBlock
      id="checkbox"
      title="Checkbox"
      description="Polar Orbit Checkbox."
    >
      <PreviewRow label="State">
        <label className="flex items-center gap-2">
          <Checkbox checked={a} onCheckedChange={(v) => setA(Boolean(v))} />
          <Text variant="body">Unchecked</Text>
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={b} onCheckedChange={(v) => setB(Boolean(v))} />
          <Text variant="body">Checked</Text>
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked="indeterminate" />
          <Text variant="body">Indeterminate</Text>
        </label>
        <label className="flex items-center gap-2 opacity-50">
          <Checkbox disabled checked />
          <Text variant="body">Disabled</Text>
        </label>
      </PreviewRow>
    </PreviewBlock>
  );
}
