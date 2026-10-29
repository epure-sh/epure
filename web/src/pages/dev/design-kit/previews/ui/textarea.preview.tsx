import { TextArea } from "@/components/ui/textarea";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function TextAreaPreview() {
  return (
    <PreviewBlock id="textarea" title="TextArea" description="Orbit TextArea">
      <PreviewRow label="Default">
        <TextArea
          className="w-full max-w-md"
          placeholder="Describe the incident…"
          rows={4}
        />
      </PreviewRow>
      <PreviewRow label="Non-resizable">
        <TextArea
          className="w-full max-w-md"
          resizable={false}
          placeholder="Fixed height"
          rows={3}
        />
      </PreviewRow>
    </PreviewBlock>
  );
}
