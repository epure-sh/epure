import { Status } from "@/components/ui/status";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function StatusPreview() {
  return (
    <PreviewBlock id="status" title="Status" description="Orbit Status">
      <PreviewRow label="Colors">
        <div className="flex flex-wrap gap-2">
          <Status status="healthy" color="green" />
          <Status status="degraded" color="yellow" />
          <Status status="error" color="red" />
          <Status status="info" color="blue" />
        </div>
      </PreviewRow>
    </PreviewBlock>
  );
}
