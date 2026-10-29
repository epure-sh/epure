import {
  IssueImpactLine,
  IssueImpactMetrics,
  IssueOccurrenceTrend,
} from "@/ui/issue-impact-strip";
import { IssueDetailTabs } from "@/ui/issue-detail-tabs";
import { KeyboardHintsFooter } from "@/ui/keyboard-hints-footer";
import { StatBar } from "@/ui/stat-bar";
import { DESIGN_KIT_SAMPLE_ISSUE } from "../../fixtures/sample-issue";
import { DESIGN_KIT_SAMPLE_TIMELINE } from "../../fixtures/sample-issue-detail";
import { PreviewBlock, MatrixCell } from "../../shared";

export default function IssueDetailPreview() {
  return (
    <PreviewBlock
      id="issue-detail"
      title="Issue detail"
      description="Pinned impact header and tabs chrome for the redesigned drawer."
    >
      <div className="grid grid-cols-1 gap-3">
        <MatrixCell label="Impact line">
          <IssueImpactLine issue={DESIGN_KIT_SAMPLE_ISSUE} />
        </MatrixCell>
        <MatrixCell label="Occurrence trend">
          <IssueOccurrenceTrend
            timeline={DESIGN_KIT_SAMPLE_TIMELINE}
            timelineWindow="7d"
          />
        </MatrixCell>
        <MatrixCell label="Impact grid (legacy)">
          <IssueImpactMetrics issue={DESIGN_KIT_SAMPLE_ISSUE} />
        </MatrixCell>
        <MatrixCell label="Tabs chrome">
          <div className="h-72 overflow-hidden rounded-md border border-border">
            <IssueDetailTabs
              issue={DESIGN_KIT_SAMPLE_ISSUE}
              issueTitle={DESIGN_KIT_SAMPLE_ISSUE.title ?? "Issue"}
              timeline={DESIGN_KIT_SAMPLE_TIMELINE}
              overview={<p className="p-3 text-xs text-fg-muted">Context</p>}
              stack={<p className="p-3 text-xs text-fg-muted">Stack</p>}
              breadcrumbs={<p className="p-3 text-xs text-fg-muted">Breadcrumbs</p>}
            />
          </div>
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
