import { UsageMeterCard } from "@/components/kit/usage-meter-card";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function UsageMeterCardPreview() {
  return (
    <PreviewBlock id="usage-meter-card" title="UsageMeterCard">
      <PreviewRow label="Samples"><UsageMeterCard label="Events" used={450000} limit={1000000} /><UsageMeterCard label="Seats" used={9} limit={10} unit="seats" /></PreviewRow>
    </PreviewBlock>
  );
}