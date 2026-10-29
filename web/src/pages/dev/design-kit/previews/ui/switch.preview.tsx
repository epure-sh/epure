import * as React from "react";
import { Switch } from "@polar-sh/orbit/Switch";
import { Text } from "@polar-sh/orbit/Text";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SwitchPreview() {
  const [on, setOn] = React.useState(true);
  return (
    <PreviewBlock id="switch" title="Switch" description="Polar Orbit Switch.">
      <PreviewRow label="State">
        <div className="flex items-center gap-2">
          <Switch checked={on} onCheckedChange={setOn} id="sw" />
          <Text variant="body" as="label">
            Alerts email
          </Text>
        </div>
        <Switch disabled />
      </PreviewRow>
    </PreviewBlock>
  );
}
