import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PreviewBlock } from "../../shared";

export default function TooltipPreview() {
  return (
    <PreviewBlock id="tooltip" title="Tooltip">
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm">Hover</Button></TooltipTrigger><TooltipContent>G then I</TooltipContent></Tooltip>
    </PreviewBlock>
  );
}