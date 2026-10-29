import { PageShell } from "@/components/kit/page-shell";
import { PreviewBlock } from "../../shared";

export default function PageShellPreview() {
  return (
    <PreviewBlock id="page-shell" title="PageShell" description="standard vs full-bleed density">
      <div className="h-32 overflow-hidden rounded-control border border-border-subtle"><PageShell title="Nested shell" description="standard density"><p className="text-xs text-fg-muted">Gutter + centered max-w column (1024)</p></PageShell></div>
    </PreviewBlock>
  );
}