import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PreviewBlock } from "../../shared";

export default function PopoverPreview() {
  return (
    <PreviewBlock id="popover" title="Popover">
      <Popover><PopoverTrigger asChild><Button variant="outline" size="sm">Open</Button></PopoverTrigger><PopoverContent><p className="text-xs text-fg-muted">Occurrence rate +320%</p></PopoverContent></Popover>
    </PreviewBlock>
  );
}