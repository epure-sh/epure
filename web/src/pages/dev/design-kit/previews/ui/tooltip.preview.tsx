import { Button } from "@polar-sh/orbit/Button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@polar-sh/orbit";
import { PreviewBlock, PreviewRow } from "../../shared";

export default function TooltipPreview() {
  return (
    <PreviewBlock
      id="tooltip"
      title="Tooltip"
      description="Polar Orbit Tooltip."
    >
      <PreviewRow label="Basic">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              Hover
            </Button>
          </TooltipTrigger>
          <TooltipContent>Contextual hint</TooltipContent>
        </Tooltip>
      </PreviewRow>
    </PreviewBlock>
  );
}
