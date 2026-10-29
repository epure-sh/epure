import { SetupDocsLink } from "@/ui/setup-docs-link";
import { SetupPlatformMark } from "@/ui/setup-platform-mark";
import { StepIndicator } from "@/ui/step-indicator";
import { PreviewBlock, MatrixCell, PreviewRow } from "../../shared";

export default function SetupPreview() {
  return (
    <PreviewBlock
      id="setup"
      title="Setup"
      description="Onboarding steps · platform mark · docs link."
    >
      <div className="grid grid-cols-1 gap-3">
        <MatrixCell label="Steps · pills">
          <StepIndicator
            steps={[
              { id: "connect", label: "Connect", complete: true },
              { id: "install", label: "Install", active: true },
              { id: "verify", label: "Verify" },
            ]}
          />
        </MatrixCell>
        <MatrixCell label="Steps · bar">
          <StepIndicator
            variant="bar"
            steps={[
              { id: "connect", label: "Connect", complete: true },
              { id: "install", label: "Install", active: true },
              { id: "verify", label: "Verify" },
            ]}
          />
        </MatrixCell>
      </div>
      <PreviewRow label="Platform · docs" className="mt-3">
        <SetupPlatformMark logo="javascript" />
        <SetupDocsLink href="https://docs.epure.ai">Quickstart</SetupDocsLink>
      </PreviewRow>
    </PreviewBlock>
  );
}
