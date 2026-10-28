import {
  InboxUnreadRail,
  inboxMetaClass,
  inboxPrimaryTitleClass,
  inboxSecondaryLineClass,
} from "@/components/kit/inbox-read-cue";
import { PreviewBlock } from "../../shared";

export default function InboxReadCuePreview() {
  return (
    <PreviewBlock id="inbox-read-cue" title="InboxReadCue">
      <div className="space-y-3">
        <div className="relative rounded-md border border-border-subtle bg-surface-1 p-3">
          <InboxUnreadRail unread={true} />
          <p className={inboxPrimaryTitleClass(true)}>Unread signal with left accent rail</p>
          <p className={inboxSecondaryLineClass(true)}>Secondary metadata line</p>
          <span className={inboxMetaClass(true)}>12m ago</span>
        </div>
        <div className="relative rounded-md border border-border-subtle bg-surface-1 p-3">
          <InboxUnreadRail unread={false} />
          <p className={inboxPrimaryTitleClass(false)}>Read signal without rail</p>
          <p className={inboxSecondaryLineClass(false)}>Muted secondary metadata line</p>
          <span className={inboxMetaClass(false)}>2h ago</span>
        </div>
      </div>
    </PreviewBlock>
  );
}
