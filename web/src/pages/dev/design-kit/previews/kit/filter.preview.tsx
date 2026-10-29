import { FilterBar } from "@/components/kit/filter-bar";
import { FilterChip } from "@/ui/filter-chip";
import { FilterPanel } from "@/ui/filter-panel";
import { PreviewBlock, MatrixCell, PreviewRow } from "../../shared";

export default function FilterPreview() {
  return (
    <PreviewBlock
      id="filter"
      title="Filter"
      description="Bar · chips · panel — one filter family."
    >
      <MatrixCell label="Filter bar">
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
      </MatrixCell>
      <PreviewRow label="Chips" className="mt-3">
        <FilterChip label="is:unresolved" active />
        <FilterChip label="level:error" />
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
