import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PreviewBlock, PreviewRow } from "../shared";

export function A11ySection() {
  return (
    <div className="space-y-4">
      <PreviewBlock
        id="a11y-notes"
        title="Accessibility checklist"
        description="Radix owns focus traps and aria for overlays. Tokens zero motion under prefers-reduced-motion. Verify APCA contrast on accent-on-paper and danger-on-surface."
      >
        <ul className="list-inside list-disc space-y-1.5 text-xs text-fg-muted">
          <li>
            Focus: <code className="font-mono text-[11px]">.focus-ring</code> /{" "}
            <code className="font-mono text-[11px]">--focus-ring</code> = accent — Tab through
            controls below.
          </li>
          <li>
            Reduced motion: <code className="font-mono text-[11px]">--duration-*</code> → 0ms in{" "}
            <code className="font-mono text-[11px]">design/tokens.css</code>; global hard-cut in{" "}
            <code className="font-mono text-[11px]">src/styles/tokens.css</code>.
          </li>
          <li>Hit targets: controls stay on 32px (h-8) floor; icon buttons use icon / icon-xs sizes.</li>
          <li>Playground: ⌘K jump, Escape closes mobile catalog, sticky sidebar stays landmark.</li>
        </ul>
        <PreviewRow label="Focus probe" className="mt-3">
          <Button size="sm" variant="secondary">
            Tab here
          </Button>
          <Button size="sm" variant="primary">
            Then here
          </Button>
          <Input size="sm" className="max-w-[12rem]" placeholder="And the field" />
        </PreviewRow>
      </PreviewBlock>
    </div>
  );
}
