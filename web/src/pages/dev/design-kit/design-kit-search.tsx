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

const KIND_ORDER: CatalogEntry["kind"][] = ["section", "ui", "kit", "feature"];

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
    items: filtered.filter((e) => e.kind === kind).slice(0, kind === "section" ? 24 : 40),
  })).filter((g) => g.items.length > 0);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Jump to brand, token, component…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No catalog match.</CommandEmpty>
        {byKind.map(({ kind, items }) => (
          <CommandGroup
            key={kind}
            heading={
              kind === "section"
                ? "Sections"
                : kind === "ui"
                  ? "UI primitives"
                  : kind === "kit"
                    ? "Kit"
                    : "Feature UI"
            }
          >
            {items.map((entry) => (
              <CommandItem
                key={`${entry.kind}:${entry.id}`}
                value={`${entry.label} ${entry.group} ${entry.keywords}`}
                onSelect={() => {
                  onSelect(entry.id);
                  onOpenChange(false);
                }}
              >
                <span className="truncate">{entry.label}</span>
                <CommandShortcut>{entry.group}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/** ⌘K / Ctrl+K — Storybook-style global find. */
export function useDesignKitSearchHotkey(onOpen: () => void) {
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpen]);
}
