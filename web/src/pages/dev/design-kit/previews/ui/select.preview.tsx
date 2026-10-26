import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function SelectPreview() {
  return (
    <PreviewBlock id="select" title="Select">
      <PreviewRow label="Trigger sizes">
        <Select defaultValue="a"><SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">sm option</SelectItem></SelectContent></Select>
        <Select defaultValue="b"><SelectTrigger size="md" className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="b">md option</SelectItem></SelectContent></Select>
      </PreviewRow>
    </PreviewBlock>
  );
}