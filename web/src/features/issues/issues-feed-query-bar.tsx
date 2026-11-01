import type { RefObject } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MagnifyingGlass } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FilterChip } from "@/ui/components";
import {
  applyFilterToken,
  extractChips,
  removeChipToken,
  type QueryChip,
} from "./query-utils";
import { IssuesFeedFilterSuggestions } from "./issues-feed-filter-suggestions";

/** Keep the omnibar one line: show this many chips, collapse the rest into +N. */
const OMNIBAR_VISIBLE_CHIPS = 2;

export interface IssuesFeedQueryBarProps {
  query: string;
  searchText: string;
  onSearchChange: (text: string) => void;
  onQueryChange: (query: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}

function OmnibarChip({
  chip,
  onRemove,
}: {
  chip: QueryChip;
  onRemove: () => void;
}) {
  const colon = chip.token.indexOf(":");
  const chipValue = colon >= 0 ? chip.token.slice(colon + 1) : chip.label;
  return (
    <FilterChip
      variant="query"
      filterKey={chip.plain ? undefined : colon >= 0 ? chip.token.slice(0, colon) : chip.key}
      label={chip.plain ? chip.label : chipValue}
      tokenHint={chip.token}
      className="max-w-[9rem] shrink-0"
      onRemove={onRemove}
    />
  );
}

/** Search row with inline `key:value` chips (Sentry-style), Epure tokens. */
export function IssuesFeedQueryBar({
  query,
  searchText,
  onSearchChange,
  onQueryChange,
  searchInputRef,
  className,
  placeholder,
  ariaLabel = "Search issues",
}: IssuesFeedQueryBarProps) {
  const chips = extractChips(query);
  const visibleChips = chips.slice(0, OMNIBAR_VISIBLE_CHIPS);
  const overflowChips = chips.slice(OMNIBAR_VISIBLE_CHIPS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const defaultPlaceholder =
    chips.length > 0 ? "Add text or filter…" : "Search issues or add filters…";
  const searchPlaceholder = placeholder ?? defaultPlaceholder;

  function handlePickToken(token: string) {
    onQueryChange(applyFilterToken(query, token));
    searchInputRef?.current?.focus();
  }

  function removeToken(token: string) {
    onQueryChange(removeChipToken(query, token));
  }

  return (
    <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
      <PopoverAnchor asChild>
        <div
          data-slot="issues-feed-query"
          data-tour="issues-feed-search"
          className={cn(
            "flex min-h-8 w-full max-w-full flex-wrap items-center gap-1 rounded-full border border-border-subtle bg-canvas px-2.5 py-1 focus-within:border-border-strong focus-within:bg-surface-2/40",
            className,
          )}
        >
          <MagnifyingGlass className="size-3.5 shrink-0 text-fg-muted" weight="bold" aria-hidden />

          {visibleChips.map((chip) => (
            <OmnibarChip key={chip.token} chip={chip} onRemove={() => removeToken(chip.token)} />
          ))}

          {overflowChips.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className={cn(
                    "inline-flex h-6 shrink-0 items-center rounded-full border border-border-subtle bg-surface-1 px-1.5",
                    "font-mono text-[10px] tabular-nums text-fg-muted hover:border-border hover:text-fg-primary focus-ring",
                  )}
                  aria-label={`${overflowChips.length} more filters`}
                >
                  +{overflowChips.length}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {overflowChips.map((chip) => {
                  const colon = chip.token.indexOf(":");
                  const key = colon >= 0 ? chip.token.slice(0, colon) : chip.key;
                  const value = chip.plain
                    ? chip.label
                    : colon >= 0
                      ? chip.token.slice(colon + 1)
                      : chip.label;
                  return (
                    <DropdownMenuItem
                      key={chip.token}
                      className="gap-2 text-xs"
                      onSelect={(event) => {
                        event.preventDefault();
                        removeToken(chip.token);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {chip.plain ? value : (
                          <>
                            <span className="text-fg-muted">{key}</span>
                            <span className="text-fg-muted">:</span>
                            {value}
                          </>
                        )}
                      </span>
                      <span className="shrink-0 text-fg-muted">Remove</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <Input
            ref={searchInputRef}
            variant="ghost"
            size="auto"
            wrapperClassName="flex h-6 min-h-0 min-w-[5rem] flex-1 basis-[5rem] items-center border-0 px-0 py-0 shadow-none"
            className="h-6 min-h-0 py-0 text-xs leading-none"
            placeholder={searchPlaceholder}
            aria-label={ariaLabel}
            aria-expanded={filtersOpen}
            aria-controls="issues-feed-filter-suggestions"
            value={searchText}
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
