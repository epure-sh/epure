import { Truncated } from "@polar-sh/orbit";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function TruncatedPreview() {
  return (
    <PreviewBlock
      id="truncated"
      title="Truncated"
      description="Single-line truncate with optional full-value tooltip."
    >
      <PreviewRow label="Basic">
        <div className="w-48">
          <Truncated>A very long string that will not fit in this narrow column</Truncated>
        </div>
      </PreviewRow>
      <PreviewRow label="Lines · 2">
        <div className="w-56">
          <Truncated lines={2}>
            Multi-line clamp keeps two rows then ellipsizes the rest of this longer paragraph so
            the layout stays dense.
          </Truncated>
        </div>
      </PreviewRow>
    </PreviewBlock>
  );
}
