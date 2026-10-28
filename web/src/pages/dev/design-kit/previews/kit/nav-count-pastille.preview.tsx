import { NavCountPastille } from "@/components/kit/nav-count-pastille";
import { PreviewBlock } from "../../shared";

export default function NavCountPastillePreview() {
  return (
    <PreviewBlock id="nav-count-pastille" title="NavCountPastille">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-fg-secondary">
          <span>Unread alerts</span>
          <NavCountPastille count={5} tone="accent" />
        </div>
        <div className="flex items-center gap-2 text-xs text-fg-secondary">
          <span>All issues</span>
          <NavCountPastille count={142} tone="neutral" />
        </div>
      </div>
    </PreviewBlock>
  );
}
