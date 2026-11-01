import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ComponentPlaygroundControls,
  useBadgePlayground,
} from "../../component-playground-controls";
import { PreviewBlock, PreviewRow } from "../../shared";

const variants = [
  "neutral",
  "escalating",
  "regression",
  "healthy",
  "info",
  "warning",
  "error",
  "accent",
  "env",
  "flat",
  "resolved",
  "default",
  "secondary",
] as const;

const sizes = ["compact", "sm", "md", "default"] as const;

export default function BadgePreview() {
  const playground = useBadgePlayground();

  const activeVariant = (playground.error ? "error" : playground.variant) as (typeof variants)[number];
  const activeSize = playground.size as (typeof sizes)[number];

  return (
    <PreviewBlock
      id="badge"
      title="Badge"
      description="Semantic status pills and metadata badges with interactive controls."
      controls={
        <ComponentPlaygroundControls
          axes={playground.axes}
          flags={playground.flags}
        />
      }
    >
      <PreviewRow label="Live Interactive Badge">
        <Badge
          variant={activeVariant}
          size={activeSize}
          className={cn(playground.disabled && "opacity-50 pointer-events-none")}
        >
          {playground.error ? "error · critical" : playground.loading ? "syncing…" : activeVariant}
        </Badge>
      </PreviewRow>
      <PreviewRow label="Variants (sm)">
        {variants.map((v) => (
          <Badge key={v} variant={v} size="sm">
            {v}
          </Badge>
        ))}
      </PreviewRow>
      <PreviewRow label="Sizes (neutral)">
        {sizes.map((s) => (
          <Badge key={s} variant="neutral" size={s}>
            {s}
          </Badge>
        ))}
      </PreviewRow>
    </PreviewBlock>
  );
}
