import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { PreviewBlock } from "../../shared";

export default function CommandPreview() {
  return (
    <PreviewBlock id="command" title="Command (cmdk)">
      <Command className="max-w-md rounded-panel border border-border-subtle"><CommandInput placeholder="Search…" /><CommandList><CommandEmpty>No results</CommandEmpty><CommandGroup heading="Nav"><CommandItem>Issues<CommandShortcut>G I</CommandShortcut></CommandItem></CommandGroup><CommandSeparator /><CommandGroup heading="Actions"><CommandItem>Refresh</CommandItem></CommandGroup></CommandList></Command>
    </PreviewBlock>
  );
}