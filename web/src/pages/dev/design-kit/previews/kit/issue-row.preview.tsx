import * as React from "react";
import { InboxLifecycleCue } from "@/components/kit/inbox-lifecycle-cue";
import { InboxUnreadRail } from "@/components/kit/inbox-read-cue";
import { IssueRowShell } from "@/components/kit/issue-row-shell";
import { ListRow } from "@/ui/list-row";
import { PreviewBlock, MatrixCell } from "../../shared";

export default function IssueRowPreview() {
  const [sel, setSel] = React.useState(false);
  return (
    <PreviewBlock
      id="issue-row"
      title="Issue row"
      description="Shell · list row · read/lifecycle cues as row states."
    >
      <div className="relative overflow-hidden rounded-control border border-border-subtle">
        <InboxUnreadRail unread />
        <IssueRowShell
          id="1"
          bulkSelected={sel}
          focused={sel}
          onSelectChange={setSel}
          escalating
          title="NullPointer in checkout"
          subtitle="checkout.ts:142"
          eventsCount="14k"
          usersCount="832"
          timeAgo="2m"
          age="3d"
          priority="critical"
        />
        <IssueRowShell
          id="2"
          title="Lock timeout"
          subtitle="session.rs:88"
          eventsCount="2k"
          usersCount="149"
          timeAgo="14m"
          age="1w"
          priority="high"
        />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <MatrixCell label="List row">
          <ListRow variant="flat" className="flex-col gap-0.5 px-3 py-2">
            <span className="text-sm font-medium">List row</span>
            <span className="text-xs text-fg-muted">Flat variant</span>
          </ListRow>
        </MatrixCell>
        <MatrixCell label="Lifecycle cues">
          <div className="space-y-1">
            <InboxLifecycleCue kinds={["came_back"]} />
            <InboxLifecycleCue kinds={["snoozed", "resolved"]} />
          </div>
        </MatrixCell>
      </div>
    </PreviewBlock>
  );
}
