import { TextArea } from "@polar-sh/orbit/TextArea";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function TextAreaPreview() {
  return (
    <PreviewBlock
      id="textarea"
      title="TextArea"
      description="Polar Orbit TextArea."
    >
      <PreviewRow label="Basic">
        <TextArea
          className="w-full max-w-md"
          placeholder="Describe the incident…"
          rows={4}
        />
      </PreviewRow>
    </PreviewBlock>
  );
}
