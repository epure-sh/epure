import type { RefObject } from "react";
import { useState } from "react";
import { MagnifyingGlass } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FilterChip } from "../../ui/filter-chip";
import {
  applyFilterToken,
  extractChips,
  removeChipToken,
} from "./query-utils";
import { IssuesFeedFilterSuggestions } from "./issues-feed-filter-suggestions";

export interface IssuesFeedQueryBarProps {
  query: string;
  searchText: string;
  onSearchChange: (text: string) => void;
  onQueryChange: (query: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}

/** Full-width search row with inline `key:value` chips (Sentry-style), Epure tokens. */
export function IssuesFeedQueryBar({
  query,
  searchText,
  onSearchChange,
  onQueryChange,
  searchInputRef,
  className,
}: IssuesFeedQueryBarProps) {
  const chips = extractChips(query);
  const [filtersOpen, setFiltersOpen] = useState(false);

  function handlePickToken(token: string) {
    onQueryChange(applyFilterToken(query, token));
    searchInputRef?.current?.focus();
  }

  return (
    <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
      <PopoverAnchor asChild>
        <div
          data-slot="issues-feed-query"
          className={cn(
            "flex min-h-8 w-full flex-wrap items-center gap-1.5 rounded-md border border-border-subtle bg-surface-1 px-2 py-1 focus-within:border-border-strong focus-within:bg-surface-2/40",
            className,
          )}
        >
          <MagnifyingGlass className="size-3.5 shrink-0 text-fg-muted" weight="bold" aria-hidden />

          {chips.map((chip) => {
            const colon = chip.token.indexOf(":");
            const chipValue = colon >= 0 ? chip.token.slice(colon + 1) : chip.label;
            return (
              <FilterChip
                key={chip.token}
                variant="query"
                filterKey={colon >= 0 ? chip.token.slice(0, colon) : chip.key}
                label={chipValue}
                tokenHint={chip.token}
                onRemove={() => onQueryChange(removeChipToken(query, chip.token))}
              />
            );
          })}

      <Input
        ref={searchInputRef}
        variant="ghost"
        size="auto"
        data-tour="issues-feed-search"
        wrapperClassName="min-w-[6rem] flex-1 border-0 px-0 py-0 shadow-none"
        className="h-7"
        placeholder={chips.length > 0 ? "Add text or filter…" : "Search issues or add filters…"}
        aria-label="Search issues"
            aria-expanded={filtersOpen}
            aria-controls="issues-feed-filter-suggestions"
            value={searchText}
            trailingShortcut="/"
            onFocus={() => setFiltersOpen(true)}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                if (searchText) {
                  onSearchChange("");
                }
                setFiltersOpen(false);
                event.currentTarget.blur();
              }
            }}
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        id="issues-feed-filter-suggestions"
        align="start"
        side="bottom"
        sideOffset={6}
        className="w-[min(calc(100vw-2rem),36rem)] p-3"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest("[data-slot='issues-feed-query']")) {
            event.preventDefault();
          }
        }}
      >
        <IssuesFeedFilterSuggestions query={query} onPickToken={handlePickToken} />
      </PopoverContent>
    </Popover>
  );
}
