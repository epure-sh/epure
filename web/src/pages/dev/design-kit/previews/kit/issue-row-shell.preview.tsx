import * as React from "react";
import { IssueRowShell } from "@/components/kit/issue-row-shell";
import { PreviewBlock } from "../../shared";

export default function IssueRowShellPreview() {
  const [sel, setSel] = React.useState(false);
  return (
    <PreviewBlock id="issue-row-shell" title="IssueRowShell">
      <div className="overflow-hidden rounded-control border border-border-subtle">
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
    </PreviewBlock>
  );
}
