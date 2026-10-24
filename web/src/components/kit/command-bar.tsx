// src/components/kit/command-bar.tsx
import * as React from "react";
import { useHotkeys } from "react-hotkeys-hook";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { MagnifyingGlass } from "@/components/ui/icon";

export interface CommandItemDef {
  id: string;
  label: string;
  group?: string;
  shortcut?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
}

export interface CommandBarProps {
  items?: CommandItemDef[];
  placeholder?: string;
  triggerPlaceholder?: string;
  onSearchChange?: (query: string) => void;
}

export function CommandBar({
  items = [],
  placeholder = "Type a command or search...",
  triggerPlaceholder = "Search issues, projects, commands... (⌘K)",
}: CommandBarProps) {
  const [open, setOpen] = React.useState(false);

  // Global shortcut ⌘K / Ctrl+K
  useHotkeys("mod+k", (e) => {
    e.preventDefault();
    setOpen((prev) => !prev);
  });

  // Group items by category
  const grouped = React.useMemo(() => {
    const map = new Map<string, CommandItemDef[]>();
    for (const item of items) {
      const g = item.group || "Suggestions";
      if (!map.has(g)) {
        map.set(g, []);
      }
      map.get(g)!.push(item);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <>
      <div
        data-slot="command-bar-trigger"
        onClick={() => setOpen(true)}
        className="cursor-pointer w-full"
      >
        <Input
          readOnly
          size="sm"
          leadingIcon={<MagnifyingGlass weight="bold" />}
          trailingShortcut="⌘K"
          placeholder={triggerPlaceholder}
          className="cursor-pointer pointer-events-none"
        />
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={placeholder} />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {grouped.map(([groupName, groupItems]) => (
            <CommandGroup key={groupName} heading={groupName}>
              {groupItems.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => {
                    item.onSelect();
                    setOpen(false);
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {item.shortcut && (
                    <kbd className="rounded border border-border-subtle bg-surface-3/70 px-1 font-mono text-[10px] text-fg-muted">
                      {item.shortcut}
                    </kbd>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
