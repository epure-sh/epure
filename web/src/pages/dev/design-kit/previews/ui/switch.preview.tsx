import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SwitchPreview() {
  const [on, setOn] = React.useState(true);
  return (
    <PreviewBlock id="switch" title="Switch">
      <PreviewRow label="Controlled">
        <div className="flex items-center gap-2"><Switch checked={on} onCheckedChange={setOn} id="sw" /><Label htmlFor="sw">Alerts email</Label></div>
        <Switch disabled />
      </PreviewRow>
    </PreviewBlock>
  );
}