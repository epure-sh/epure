import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PreviewBlock } from "../../shared";

export default function LabelPreview() {
  return (
    <PreviewBlock id="label" title="Label">
      <div className="max-w-xs space-y-1.5"><Label htmlFor="ds-email">Webhook URL</Label><Input id="ds-email" size="sm" placeholder="https://…" /></div>
    </PreviewBlock>
  );
}