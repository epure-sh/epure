import { cn } from "@/lib/utils";
import { FilterChip } from "@/ui/filter-chip";
import {
  FILTER_HELPER_GROUPS,
  queryHasToken,
  type FilterPreset,
} from "./query-utils";

export interface IssuesFeedFilterSuggestionsProps {
  query: string;
  onPickToken: (token: string) => void;
  className?: string;
}

function FilterPresetButton({
  preset,
  active,
  onPick,
}: {
  preset: FilterPreset;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <FilterChip
      label={preset.label}
      active={active}
      className="h-auto py-1 text-[11px]"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
    />
  );
}

/** Filter chips shown when the feed search bar is focused (Sentry-style). */
export function IssuesFeedFilterSuggestions({
  query,
  onPickToken,
  className,
}: IssuesFeedFilterSuggestionsProps) {
  return (
    <div
      data-slot="issues-feed-filter-suggestions"
      className={cn("max-h-[min(50vh,20rem)] space-y-3 overflow-y-auto", className)}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-fg-muted">
        Add filters
      </p>
      {FILTER_HELPER_GROUPS.map((group) => (
        <div key={group.category}>
          <p className="mb-1.5 text-[10px] font-semibold text-fg-muted">{group.label}</p>
          <div className="flex flex-wrap gap-1.5">
            {group.presets.map((preset) => (
              <FilterPresetButton
                key={preset.token}
                preset={preset}
                active={queryHasToken(query, preset.token)}
                onPick={() => onPickToken(preset.token)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
