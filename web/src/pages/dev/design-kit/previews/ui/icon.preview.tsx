import { Icon, ArrowRight, Gear } from "@/components/ui/icon";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function IconPreview() {
  return (
    <PreviewBlock id="icon" title="Icon (Phosphor)">
      <PreviewRow label="Wrapper"><Icon icon={ArrowRight} size={14} /><Icon icon={Gear} size={18} weight="bold" /></PreviewRow>
      <PreviewRow label="Direct"><ArrowRight className="size-4" /><Gear weight="fill" className="size-4 text-accent" /></PreviewRow>
    </PreviewBlock>
  );
}