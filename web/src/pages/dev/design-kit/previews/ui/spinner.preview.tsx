import { Spinner } from "@polar-sh/orbit/Spinner";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SpinnerPreview() {
  return (
    <PreviewBlock id="spinner" title="Spinner" description="Polar Orbit Spinner.">
      <PreviewRow label="Basic">
        <Spinner />
      </PreviewRow>
    </PreviewBlock>
  );
}
