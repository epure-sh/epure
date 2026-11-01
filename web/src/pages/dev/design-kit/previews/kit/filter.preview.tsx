import { FilterBar } from "@/components/kit/filter-bar";
import { INBOX_FEED_TOOLBAR_SHELL_CLASS } from "@/components/kit/inbox-read-cue";
import { FilterChip } from "@/ui/components";
import { FilterPanel } from "@/ui/block";
import { PreviewBlock, MatrixCell, PreviewRow } from "../../shared";

export default function FilterPreview() {
  return (
    <PreviewBlock
      id="filter"
      title="Filter"
      description="Boxed toolbar · compact chips · clear selected state."
    >
      <MatrixCell label="Filter bar (boxed)">
        <div className={INBOX_FEED_TOOLBAR_SHELL_CLASS}>
          <FilterBar
            options={[
              { key: "all", label: "All", count: 40 },
              { key: "unresolved", label: "Unresolved", count: 12 },
              { key: "resolved", label: "Resolved", count: 28 },
            ]}
            activeKey="unresolved"
            onSelect={() => undefined}
            onReset={() => undefined}
          />
        </div>
      </MatrixCell>
      <PreviewRow label="Chips · selected vs idle" className="mt-3">
        <FilterChip label="All" active={false} />
        <FilterChip label="Unresolved" active count={12} />
        <FilterChip label="Resolved" active={false} />
        <FilterChip label="is:unresolved" variant="query" filterKey="is" onRemove={() => undefined} />
      </PreviewRow>
      <div className="mt-3">
        <MatrixCell label="Panel">
          <FilterPanel
            query="is:unresolved level:error"
            presets={[
              { label: "Unresolved", token: "is:unresolved" },
              { label: "Error", token: "level:error" },
            ]}
            onQueryChange={() => undefined}
          />
        </MatrixCell>
      </div>
    </PreviewBlock>
  );
}
