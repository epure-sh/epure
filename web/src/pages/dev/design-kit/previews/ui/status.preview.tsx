import { Status } from "@polar-sh/orbit/Status";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function StatusPreview() {
  return (
    <PreviewBlock id="status" title="Status" description="Polar Orbit Status.">
      <PreviewRow label="Color">
        <Status status="healthy" color="green" />
        <Status status="degraded" color="yellow" />
        <Status status="error" color="red" />
        <Status status="info" color="blue" />
      </PreviewRow>
    </PreviewBlock>
  );
}
