import { Alert } from "@/components/ui/alert";
import { FairUseBanner } from "@/ui/fair-use-banner";
import { SharedProjectBadge } from "@/ui/shared-project-badge";
import { PreviewBlock, MatrixCell, PreviewRow } from "../../shared";

export default function BannerPreview() {
  return (
    <PreviewBlock
      id="banner"
      title="Banner"
      description="Product banners as Alert tones · fair-use · shared project."
    >
      <div className="grid grid-cols-1 gap-3">
        <MatrixCell label="Fair use">
          <FairUseBanner message="You are approaching the fair-use soft limit for this workspace." />
        </MatrixCell>
        <MatrixCell label="Alert · warning">
          <Alert variant="warning" title="Attention" description="Supporting detail for the warning." />
        </MatrixCell>
        <MatrixCell label="Alert · danger">
          <Alert variant="danger" title="Action required" description="Resolve before continuing." />
        </MatrixCell>
        <MatrixCell label="Alert · info">
          <Alert variant="info" title="Notice" description="Informational notice." />
        </MatrixCell>
      </div>
      <PreviewRow label="Shared project" className="mt-3">
        <SharedProjectBadge />
      </PreviewRow>
    </PreviewBlock>
  );
}
