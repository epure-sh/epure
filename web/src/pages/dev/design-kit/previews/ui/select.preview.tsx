import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@polar-sh/orbit/Select";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SelectPreview() {
  return (
    <PreviewBlock
      id="select"
      title="Select"
      description="Polar Orbit Select — Radix dropdown."
    >
      <PreviewRow label="Basic">
        <Select defaultValue="a">
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Option A</SelectItem>
            <SelectItem value="b">Option B</SelectItem>
            <SelectItem value="c">Option C</SelectItem>
          </SelectContent>
        </Select>
      </PreviewRow>
    </PreviewBlock>
  );
}
