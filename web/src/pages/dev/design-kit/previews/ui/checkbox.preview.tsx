import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function CheckboxPreview() {
  const [a, setA] = React.useState(false);
  const [b, setB] = React.useState(true);
  return (
    <PreviewBlock id="checkbox" title="Checkbox" description="16px · zero layout shift">
      <PreviewRow label="States">
        <label className="flex items-center gap-2 text-xs"><Checkbox checked={a} onCheckedChange={(v) => setA(Boolean(v))} /> Unchecked</label>
        <label className="flex items-center gap-2 text-xs"><Checkbox checked={b} onCheckedChange={(v) => setB(Boolean(v))} /> Checked</label>
        <label className="flex items-center gap-2 text-xs"><Checkbox checked="indeterminate" /> Indeterminate</label>
        <label className="flex items-center gap-2 text-xs opacity-50"><Checkbox disabled checked /> Disabled</label>
      </PreviewRow>
    </PreviewBlock>
  );
}