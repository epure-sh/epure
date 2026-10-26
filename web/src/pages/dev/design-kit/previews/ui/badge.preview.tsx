import { Badge } from "@/components/ui/badge";
import { PreviewBlock, PreviewRow } from "../../shared";

const variants = ["neutral","escalating","regression","healthy","info","warning","error","accent","env","flat","resolved","default","secondary"] as const;
const sizes = ["compact","sm","md","default"] as const;

export default function BadgePreview() {
  return (
    <PreviewBlock id="badge" title="Badge">
      <PreviewRow label="Variants (sm)">
        {variants.map((v) => (
          <Badge key={v} variant={v} size="sm">{v}</Badge>
        ))}
      </PreviewRow>
      <PreviewRow label="Sizes (neutral)">
        {sizes.map((s) => (
          <Badge key={s} variant="neutral" size={s}>{s}</Badge>
        ))}
      </PreviewRow>
    </PreviewBlock>
  );
}
