import { AskAgentCard } from "@/components/kit/ask-agent-card";
import { PreviewBlock } from "../../shared";

export default function AskAgentCardPreview() {
  return (
    <PreviewBlock id="ask-agent-card" title="AskAgentCard"><AskAgentCard title="Copilot" description="Diagnose stack" promptText="Explain NPE" onAskAgent={() => undefined} /></PreviewBlock>
  );
}