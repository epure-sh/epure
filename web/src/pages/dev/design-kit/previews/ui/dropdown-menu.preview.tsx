import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PreviewBlock } from "../../shared";

export default function DropdownMenuPreview() {
  return (
    <PreviewBlock id="dropdown-menu" title="Dropdown menu">
      <DropdownMenu><DropdownMenuTrigger asChild><Button size="sm" variant="outline">Menu</Button></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Triage</DropdownMenuLabel>
          <DropdownMenuItem>Resolve</DropdownMenuItem>
          <DropdownMenuCheckboxItem checked>Subscribe</DropdownMenuCheckboxItem>
          <DropdownMenuSub><DropdownMenuSubTrigger>Snooze</DropdownMenuSubTrigger><DropdownMenuSubContent><DropdownMenuItem>1h</DropdownMenuItem></DropdownMenuSubContent></DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value="p1"><DropdownMenuRadioItem value="p1">P1</DropdownMenuRadioItem></DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </PreviewBlock>
  );
}