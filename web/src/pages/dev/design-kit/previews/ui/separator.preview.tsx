import { Separator } from "@/components/ui/separator";
import { PreviewBlock } from "../../shared";

export default function SeparatorPreview() {
  return (
    <PreviewBlock id="separator" title="Separator">
      <div className="flex h-8 items-center gap-3 text-xs"><span>Issues</span><Separator orientation="vertical" className="h-4" /><span>Settings</span></div>
      <Separator className="my-2" /><p className="text-xs text-fg-muted">Horizontal hairline</p>
    </PreviewBlock>
  );
}