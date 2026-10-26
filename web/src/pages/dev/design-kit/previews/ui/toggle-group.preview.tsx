import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function ToggleGroupPreview() {
  return (
    <PreviewBlock id="toggle-group" title="Toggle group">
      <PreviewRow label="Sizes">
        <ToggleGroup type="single" defaultValue="7d"><ToggleGroupItem value="7d" size="sm">7d</ToggleGroupItem><ToggleGroupItem value="30d" size="sm">30d</ToggleGroupItem></ToggleGroup>
        <ToggleGroup type="single" defaultValue="all"><ToggleGroupItem value="all">All</ToggleGroupItem><ToggleGroupItem value="mine">Mine</ToggleGroupItem></ToggleGroup>
      </PreviewRow>
    </PreviewBlock>
  );
}