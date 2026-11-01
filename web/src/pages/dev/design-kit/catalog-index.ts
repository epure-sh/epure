/**
 * Flat search index for sidebar filter + ⌘K jump.
 */
import {
  DESIGN_KIT_BLOCK_META,
  DESIGN_KIT_BLOCK_MODULES,
  DESIGN_KIT_COMPONENT_META,
  DESIGN_KIT_COMPONENT_MODULES,
  DESIGN_KIT_FOUNDATION_PAGES,
  DESIGN_KIT_PRIMITIVE_META,
  DESIGN_KIT_PRIMITIVE_MODULES,
} from "./registry";

export type CatalogEntry = {
  id: string;
  label: string;
  group: string;
  kind: "foundation" | "primitive" | "component" | "block";
  keywords: string;
};

export function buildCatalogIndex(): CatalogEntry[] {
  const entries: CatalogEntry[] = [];

  for (const page of DESIGN_KIT_FOUNDATION_PAGES) {
    entries.push({
      id: page.id,
      label: page.label,
      group: "Foundations",
      kind: "foundation",
      keywords: page.keywords,
    });
  }

  for (const mod of DESIGN_KIT_PRIMITIVE_MODULES) {
    const meta = DESIGN_KIT_PRIMITIVE_META[mod];
    entries.push({
      id: mod,
      label: mod,
      group: meta.family,
      kind: "primitive",
      keywords: `primitive ${meta.family} ${meta.orbit ?? ""} ${meta.description}`,
    });
  }

  for (const mod of DESIGN_KIT_COMPONENT_MODULES) {
    const meta = DESIGN_KIT_COMPONENT_META[mod];
    entries.push({
      id: mod,
      label: mod,
      group: meta.family,
      kind: "component",
      keywords: `component ${meta.family} ${meta.description} ${(meta.absorbs ?? []).join(" ")}`,
    });
  }

  for (const mod of DESIGN_KIT_BLOCK_MODULES) {
    const meta = DESIGN_KIT_BLOCK_META[mod];
    entries.push({
      id: mod,
      label: mod,
      group: meta.family,
      kind: "block",
      keywords: `block ${meta.family} ${meta.description} ${(meta.absorbs ?? []).join(" ")}`,
    });
  }

  return entries;
}

export function matchCatalogEntry(entry: CatalogEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${entry.label} ${entry.group} ${entry.kind} ${entry.keywords}`.toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}
