import { Pill, type PillColor } from "@polar-sh/orbit/Pill";
import { PreviewBlock, PreviewRow } from "../../shared";

const COLORS: PillColor[] = ["gray", "blue", "purple", "yellow", "red", "green"];

/** Polar Orbit Pill. */
export default function PillPreview() {
  return (
    <PreviewBlock
      id="pill"
      title="Pill"
      description="Compact colorful tags — Polar Orbit Pill."
    >
      <PreviewRow label="Color">
        {COLORS.map((color) => (
          <Pill key={color} color={color}>
            {color}
          </Pill>
        ))}
      </PreviewRow>
    </PreviewBlock>
  );
}
