import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, ShieldWarning, Sparkle } from "@/components/ui/icon";
import { PreviewBlock } from "../shared";

export function StatesSection() {
  return (
    <div id="states" className="scroll-mt-24 space-y-4">
      <PreviewBlock
        id="states-matrix"
        title="4-state stress matrix"
        description="Default · active · busy · error — verify contrast and control heights stay on the 24/28/32px grid."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-3 rounded-control border border-border-subtle bg-surface-1 p-3">
            <h4 className="flex items-center gap-1.5 border-b border-border-subtle pb-1.5 text-xs font-semibold text-fg-primary">
              <CheckCircle className="size-3.5 text-healthy" />
              Idle
            </h4>
            <Button variant="secondary" size="sm" className="w-full">
              Normal
            </Button>
            <Input size="sm" placeholder="Search…" />
            <Badge variant="neutral">Idle</Badge>
          </div>
          <div className="space-y-3 rounded-control border border-border-strong bg-surface-2/60 p-3">
            <h4 className="flex items-center gap-1.5 border-b border-border-subtle pb-1.5 text-xs font-semibold text-fg-primary">
              <Sparkle className="size-3.5 text-primary" />
              Active
            </h4>
            <Button variant="primary" size="sm" className="w-full">
              Selected
            </Button>
            <Input size="sm" defaultValue="active-query" />
            <Badge variant="info">
              Active
            </Badge>
          </div>
          <div className="space-y-3 rounded-control border border-border-subtle bg-surface-1 p-3">
            <h4 className="flex items-center gap-1.5 border-b border-border-subtle pb-1.5 text-xs font-semibold text-fg-primary">
              <Clock className="size-3.5 text-regression" />
              Busy
            </h4>
            <Button variant="secondary" size="sm" loading className="w-full">
              Processing
            </Button>
            <Input size="sm" disabled placeholder="Syncing…" />
            <Badge variant="regression">
              Sync
            </Badge>
          </div>
          <div className="space-y-3 rounded-control border border-escalating/40 bg-surface-1 p-3">
            <h4 className="flex items-center gap-1.5 border-b border-escalating/30 pb-1.5 text-xs font-semibold text-escalating">
              <ShieldWarning className="size-3.5 text-escalating" />
              Error
            </h4>
            <Button variant="danger" size="sm" className="w-full">
              Resolve spike
            </Button>
            <Input size="sm" defaultValue="ERR_TIMEOUT" />
            <Badge variant="escalating">
              Critical
            </Badge>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}
