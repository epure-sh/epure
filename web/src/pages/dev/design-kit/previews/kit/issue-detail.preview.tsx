import { IssueImpactMetrics } from "@/ui/issue-impact-strip";
import { KeyboardHintsFooter } from "@/ui/keyboard-hints-footer";
import { StatBar } from "@/ui/stat-bar";
import { DESIGN_KIT_SAMPLE_ISSUE } from "../../fixtures/sample-issue";
import { PreviewBlock, MatrixCell } from "../../shared";

export default function IssueDetailPreview() {
  return (
    <PreviewBlock
      id="issue-detail"
      title="Issue detail"
      description="Detail flow pieces — impact, stats, keyboard hints. Overlay/tabs live in product."
    >
      <div className="grid grid-cols-1 gap-3">
        <MatrixCell label="Impact">
          <IssueImpactMetrics issue={DESIGN_KIT_SAMPLE_ISSUE} />
        </MatrixCell>
        <MatrixCell label="Stat bar">
          <StatBar
            items={[
              { label: "Unresolved", value: 12 },
              { label: "Events (7d)", value: 1402 },
            ]}
          />
        </MatrixCell>
        <MatrixCell label="Keyboard hints">
          <KeyboardHintsFooter />
        </MatrixCell>
      </div>
    </PreviewBlock>
  );
}
