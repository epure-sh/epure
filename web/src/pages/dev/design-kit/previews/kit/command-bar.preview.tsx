import { Terminal, Gear } from "@/components/ui/icon";
import { CommandBar } from "@/components/kit/command-bar";
import { toast } from "@/components/ui/sonner";
import { PreviewBlock } from "../../shared";

export default function CommandBarPreview() {
  return (
    <PreviewBlock id="command-bar" title="CommandBar">
      <CommandBar items={[
        { id: "i", label: "Issues", group: "Nav", shortcut: "G I", icon: <Terminal className="size-4" />, onSelect: () => toast.info("Issues") },
        { id: "s", label: "Settings", group: "Nav", icon: <Gear className="size-4" />, onSelect: () => toast.info("Settings") },
      ]} />
    </PreviewBlock>
  );
}