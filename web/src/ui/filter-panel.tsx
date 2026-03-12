import { useEffect, useMemo, useState, type RefObject } from "react";
import { cn } from "../lib/cn";
import { Button } from "./button";
import { FilterChip } from "./filter-chip";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export interface FilterPreset {
  label: string;
  token: string;
}

export interface FilterPanelProps {
  query: string;
  presets: readonly FilterPreset[];
  onQueryChange: (value: string) => void;
  onApply?: () => void;
  className?: string;
  advancedInputRef?: RefObject<HTMLInputElement | null>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  timeWindow?: string;
  timeWindowOptions?: readonly { value: string; label: string }[];
  onTimeWindowChange?: (value: string) => void;
  sort?: string;
  sortOptions?: readonly { value: string; label: string }[];
  onSortChange?: (value: string) => void;
}

function toggleToken(query: string, token: string): string {
  const prefix = `${token.split(":")[0]}:`;
  const has = query.split(/\s+/).includes(token);
  if (has) {
    return query
      .split(/\s+/)
      .filter((part) => !part.startsWith(prefix))
      .join(" ")
      .trim();
  }
  const without = query
    .split(/\s+/)
    .filter((part) => !part.startsWith(prefix))
    .join(" ")
    .trim();
  return without ? `${without} ${token}` : token;
}

export function FilterPanel({
  query,
  presets,
  onQueryChange,
  onApply,
  className,
  advancedInputRef,
  open: controlledOpen,
  onOpenChange,
  timeWindow,
  timeWindowOptions,
  onTimeWindowChange,
  sort,
  sortOptions,
  onSortChange,
}: FilterPanelProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [draft, setDraft] = useState(query);

  useEffect(() => {
    if (!open) {
      setDraft(query);
    }
  }, [open, query]);

  const activePresets = useMemo(
    () =>
      presets.filter((preset) => query.split(/\s+/).includes(preset.token)),
    [query, presets],
  );

  const draftPresets = useMemo(
    () =>
      presets.filter((preset) => draft.split(/\s+/).includes(preset.token)),
    [draft, presets],
  );

  function apply() {
    onQueryChange(draft);
    onApply?.();
    setOpen(false);
  }

  return (
    <div className={cn("epure-filter-panel", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {timeWindowOptions && onTimeWindowChange && timeWindow ? (
          <Select value={timeWindow} onValueChange={onTimeWindowChange}>
            <SelectTrigger aria-label="Time range" className="h-8 w-auto min-w-[9rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeWindowOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {sortOptions && onSortChange && sort ? (
          <Select value={sort} onValueChange={onSortChange}>
            <SelectTrigger aria-label="Sort issues" className="h-8 w-auto min-w-[11rem] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-sm">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" className="h-8 border border-border px-3 text-xs">
              Filter
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-96 space-y-3">
            <p className="text-sm text-ink">Filter issues</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => {
                const active = draftPresets.some((item) => item.token === preset.token);
                return (
                  <FilterChip
                    key={preset.token}
                    label={preset.label}
                    active={active}
                    onClick={() => setDraft(toggleToken(draft, preset.token))}
                  />
                );
              })}
            </div>
            <Input
              ref={advancedInputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Advanced: is:unresolved level:error"
              aria-label="Advanced issue query"
              className="font-mono text-xs"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  apply();
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" className="text-xs" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button className="text-xs" onClick={apply}>Apply</Button>
            </div>
          </PopoverContent>
        </Popover>

        {activePresets.map((preset) => (
          <FilterChip
            key={preset.token}
            label={preset.label}
            active
            onRemove={() => {
              const next = toggleToken(query, preset.token);
              onQueryChange(next);
              setDraft(next);
            }}
          />
        ))}
      </div>
    </div>
  );
}
