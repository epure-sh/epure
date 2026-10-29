import { Spinner } from "@/components/ui/spinner";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SpinnerPreview() {
  return (
    <PreviewBlock id="spinner" title="Spinner" description="Orbit Spinner">
      <PreviewRow label="Default">
        <Spinner />
      </PreviewRow>
    </PreviewBlock>
  );
}
