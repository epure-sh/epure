import * as React from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  buildCatalogIndex,
  matchCatalogEntry,
  type CatalogEntry,
} from "./catalog-index";

const CATALOG = buildCatalogIndex();

const KIND_ORDER: CatalogEntry["kind"][] = ["foundation", "primitive", "kit"];

const KIND_LABEL: Record<CatalogEntry["kind"], string> = {
  foundation: "Foundations",
  primitive: "Primitives",
  kit: "Kit",
};

export function DesignKitSearch({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = React.useState("");

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = React.useMemo(
    () => CATALOG.filter((entry) => matchCatalogEntry(entry, query)),
    [query],
  );

  const byKind = KIND_ORDER.map((kind) => ({
    kind,
    items: filtered.filter((e) => e.kind === kind).slice(0, kind === "foundation" ? 16 : 48),
  })).filter((g) => g.items.length > 0);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Jump to foundations, primitive, kit…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No catalog match.</CommandEmpty>
        {byKind.map(({ kind, items }) => (
          <CommandGroup key={kind} heading={KIND_LABEL[kind]}>
            {items.map((entry) => (
              <CommandItem
                key={entry.id}
                value={`${entry.label} ${entry.group} ${entry.keywords}`}
                onSelect={() => {
                  onSelect(entry.id);
                  onOpenChange(false);
                }}
              >
                <span className="font-mono text-xs">{entry.label}</span>
                <CommandShortcut>{entry.group}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function useDesignKitSearchHotkey(open: () => void) {
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}
