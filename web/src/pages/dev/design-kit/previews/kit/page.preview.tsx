import { PageShell } from "@/components/kit/page-shell";
import { Button } from "@/components/ui/button";
import { PageChrome } from "@/ui/page-chrome";
import { SimpleFeedHeader } from "@/ui/simple-feed-header";
import { PreviewBlock, MatrixCell } from "../../shared";

export default function PagePreview() {
  return (
    <PreviewBlock
      id="page"
      title="Page"
      description="Shell · chrome · feed header — density variants of one page family."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <MatrixCell label="Shell · standard">
          <div className="h-28 overflow-hidden rounded-control border border-border-subtle">
            <PageShell title="Nested shell" description="standard density">
              <p className="text-xs text-fg-muted">Gutter + centered column</p>
            </PageShell>
          </div>
        </MatrixCell>
        <MatrixCell label="Chrome · with actions">
          <div className="overflow-hidden rounded-control border border-border-subtle">
            <PageChrome
              actions={
                <Button size="xs" variant="secondary">
                  Action
                </Button>
              }
              context={<span className="text-xs text-fg-muted">Context strip</span>}
            />
          </div>
        </MatrixCell>
        <MatrixCell label="Feed header">
          <div className="overflow-hidden rounded-control border border-border-subtle">
            <SimpleFeedHeader
              stats={<span>12 unresolved</span>}
              actions={
                <Button size="xs" variant="ghost">
                  Filter
                </Button>
              }
            />
          </div>
        </MatrixCell>
      </div>
    </PreviewBlock>
  );
}
