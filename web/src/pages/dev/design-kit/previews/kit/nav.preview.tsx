import { NavCountPastille } from "@/components/kit/nav-count-pastille";
import { LogoNavButton } from "@/ui/logo";
import { PreviewBlock, MatrixCell, PreviewRow } from "../../shared";

export default function NavPreview() {
  return (
    <PreviewBlock
      id="nav"
      title="Nav"
      description="Count pastille · logo · settings/workspace nav live in product routes."
    >
      <PreviewRow label="Count pastille · tone">
        <NavCountPastille count={8} />
        <NavCountPastille count={8} tone="accent" />
        <NavCountPastille count={120} />
      </PreviewRow>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <MatrixCell label="Logo">
          <LogoNavButton />
        </MatrixCell>
        <MatrixCell label="Hidden when zero">
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            count=0 → <NavCountPastille count={0} />
            <span className="font-mono">(null)</span>
          </div>
        </MatrixCell>
      </div>
    </PreviewBlock>
  );
}
