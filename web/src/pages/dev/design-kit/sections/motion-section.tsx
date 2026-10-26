import { Button } from "@/components/ui/button";
import { PreviewBlock, PreviewRow } from "../shared";

export function MotionSection() {
  return (
    <div id="motion" className="scroll-mt-24 space-y-4">
      <PreviewBlock
        id="motion-durations"
        title="Motion tokens"
        description="--duration-fast 80ms · --duration-base 120ms · --duration-panel 160ms · prefers-reduced-motion → 0ms"
      >
        <PreviewRow label="Button press (100ms + 0.5px translate)">
          <Button variant="secondary" size="sm">
            Press me
          </Button>
          <Button variant="primary" size="sm" className="btn-tactile">
            btn-tactile
          </Button>
        </PreviewRow>
        <PreviewRow label="Tailwind animate utilities">
          <span className="inline-flex size-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
          <span className="inline-flex size-2 animate-pulse rounded-full bg-accent" />
          <span className="relative inline-flex size-6 items-center justify-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-healthy opacity-40" />
            <span className="relative size-2 rounded-full bg-healthy" />
          </span>
        </PreviewRow>
        <PreviewRow label="Overlay enter (tw-animate-css)">
          <p className="text-[11px] text-fg-muted">
            Dialog, sheet, popover, dropdown, select, tooltip use animate-in / fade / zoom (95%) — open any overlay in primitives.
          </p>
        </PreviewRow>
      </PreviewBlock>
    </div>
  );
}
