import { Alert } from "@/components/ui/alert";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function AlertPreview() {
  return (
    <PreviewBlock id="alert" title="Alert" description="Orbit Alert">
      <PreviewRow label="Info">
        <Alert variant="info" title="Ingest is healthy." description="No open incidents." />
      </PreviewRow>
      <PreviewRow label="Warning">
        <Alert
          variant="warning"
          title="Quota approaching the plan limit."
          description="Upgrade before the next billing cycle."
        />
      </PreviewRow>
    </PreviewBlock>
  );
}
