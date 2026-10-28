import { InboxLifecycleCue } from "@/components/kit/inbox-lifecycle-cue";
import { PreviewBlock } from "../../shared";

export default function InboxLifecycleCuePreview() {
  return (
    <PreviewBlock id="inbox-lifecycle-cue" title="InboxLifecycleCue">
      <div className="space-y-2">
        <InboxLifecycleCue kinds={["came_back"]} />
        <InboxLifecycleCue kinds={["snoozed"]} />
        <InboxLifecycleCue kinds={["resolved"]} />
      </div>
    </PreviewBlock>
  );
}
