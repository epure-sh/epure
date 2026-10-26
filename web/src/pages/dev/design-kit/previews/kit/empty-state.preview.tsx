import { EmptyState } from "@/components/kit/empty-state";
import { PreviewBlock } from "../../shared";

export default function EmptyStatePreview() {
  return (
    <PreviewBlock id="empty-state" title="EmptyState"><EmptyState title="No issues" description="Quiet empty" actionLabel="View resolved" onAction={() => undefined} /></PreviewBlock>
  );
}