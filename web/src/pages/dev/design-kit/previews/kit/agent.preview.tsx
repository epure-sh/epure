import { AskAgentCard } from "@/components/kit/ask-agent-card";
import { ApplyWithAiButton } from "@/ui/apply-with-ai-button";
import { IssueAiCopilotCard } from "@/ui/issue-ai-copilot-card";
import {
  DESIGN_KIT_SAMPLE_EVENT,
  DESIGN_KIT_SAMPLE_ISSUE,
} from "../../fixtures/sample-issue";
import { PreviewBlock, MatrixCell, PreviewRow } from "../../shared";

export default function AgentPreview() {
  return (
    <PreviewBlock
      id="agent"
      title="Agent"
      description="AI copilot cards · apply-with-AI as a button example."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <MatrixCell label="Ask agent">
          <AskAgentCard promptText="Explain this stack trace" />
        </MatrixCell>
        <MatrixCell label="Issue copilot">
          <IssueAiCopilotCard
            issue={DESIGN_KIT_SAMPLE_ISSUE}
            event={DESIGN_KIT_SAMPLE_EVENT}
          />
        </MatrixCell>
      </div>
      <PreviewRow label="Apply with AI" className="mt-3">
        <ApplyWithAiButton prompt="Fix null check in checkout" />
      </PreviewRow>
    </PreviewBlock>
  );
}
