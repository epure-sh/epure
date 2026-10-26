import * as React from "react";
import { FilterBar } from "@/components/kit/filter-bar";
import { PreviewBlock } from "../../shared";

export default function FilterBarPreview() {
  const [key, setKey] = React.useState("all");
  return (
    <PreviewBlock id="filter-bar" title="FilterBar">
      <FilterBar options={[{ key: "unresolved", label: "Unresolved", count: 42 }, { key: "escalating", label: "Escalating", count: 5 }]} activeKey={key} onSelect={setKey} onReset={() => setKey("all")} />
    </PreviewBlock>
  );
}