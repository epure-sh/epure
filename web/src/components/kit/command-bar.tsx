// src/components/kit/command-bar.tsx — Phase 4: Orbit Box trigger chrome
import * as React from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
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

  useHotkeys("mod+k", (e) => {
    e.preventDefault();
    setOpen((prev) => !prev);
  });

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
      <Box
        data-slot="command-bar-trigger"
        onClick={() => setOpen(true)}
        cursor="pointer"
        width="100%"
      >
        <Input
          readOnly
          size="sm"
          leadingIcon={<MagnifyingGlass weight="bold" />}
          trailingShortcut="⌘K"
          placeholder={triggerPlaceholder}
          className="cursor-pointer pointer-events-none"
        />
      </Box>

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
                >
                  <Box alignItems="center" justifyContent="between" width="100%">
                    <Box alignItems="center" columnGap="s">
                      {item.icon}
                      <Text as="span" variant="default">
                        {item.label}
                      </Text>
                    </Box>
                    {item.shortcut ? (
                      <Box
                        as="span"
                        borderRadius="s"
                        borderWidth={1}
                        borderStyle="solid"
                        borderColor="border-primary"
                        backgroundColor="background-secondary"
                        paddingHorizontal="xs"
                        paddingVertical="none"
                      >
                        <Text as="span" variant="caption" color="muted" monospace>
                          {item.shortcut}
                        </Text>
                      </Box>
                    ) : null}
                  </Box>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
