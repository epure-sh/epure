import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PreviewBlock } from "../../shared";

export default function RadioGroupPreview() {
  return (
    <PreviewBlock id="radio-group" title="Radio group">
      <RadioGroup defaultValue="7d" className="flex gap-4">
        <div className="flex items-center gap-2"><RadioGroupItem value="7d" id="7d" /><Label htmlFor="7d">7d</Label></div>
        <div className="flex items-center gap-2"><RadioGroupItem value="14d" id="14d" /><Label htmlFor="14d">14d</Label></div>
      </RadioGroup>
    </PreviewBlock>
  );
}