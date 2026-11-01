import { Alert } from "@/components/ui/alert";
import { Banner, type BannerTone, type BannerVariant } from "@/ui/components/banner";
import { FairUseBanner } from "@/ui/components";
import { SharedProjectBadge } from "@/ui/components";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ComponentPlaygroundControls,
  useBannerPlayground,
} from "../../component-playground-controls";
import { PreviewBlock, MatrixCell, PreviewRow } from "../../shared";

export default function BannerPreview() {
  const playground = useBannerPlayground();

  const mappedTone: BannerTone =
    playground.error
      ? "danger"
      : playground.tone === "success"
        ? "signal"
        : (playground.tone as BannerTone);

  return (
    <PreviewBlock
      id="banner"
      title="Banner"
      description="Product banners as Alert tones · fair-use · shared project with interactive controls."
      controls={
        <ComponentPlaygroundControls
          axes={playground.axes}
          flags={playground.flags}
        />
      }
    >
      <div className="mb-4">
        <MatrixCell
          label={`Live Interactive Banner · tone(${playground.tone}) · variant(${playground.variant})`}
        >
          <div className={cn(playground.disabled && "opacity-50 pointer-events-none")}>
            <Banner
              tone={mappedTone}
              variant={playground.variant as BannerVariant}
              title={
                playground.error
                  ? "Escalating Incident Alert"
                  : playground.loading
                    ? "Evaluating workspace rules…"
                    : "Notice: Workspace Telemetry Spike"
              }
              description={
                playground.loading
                  ? "Streaming real-time occurrence telemetry from Edge ingest workers."
                  : "Rate limit thresholds reached for the active billing cycle. Review telemetry and ingestion filters."
              }
              action={
                <Button size="xs" variant="outline">
                  {playground.error ? "Acknowledge" : "Review rules"}
                </Button>
              }
            />
          </div>
        </MatrixCell>
      </div>

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
