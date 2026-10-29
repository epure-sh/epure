/**
 * Flat search index for sidebar filter + ⌘K jump.
 * Mirrors Storybook’s “search finds stories by name” + shadcn docs groups.
 */
import {
  DESIGN_KIT_FEATURE_UI_GROUPS,
} from "./feature-ui-registry";
import {
  DESIGN_KIT_KIT_MODULES,
  DESIGN_KIT_SECTIONS,
  DESIGN_KIT_UI_MODULES,
} from "./registry";

export type CatalogEntry = {
  id: string;
  label: string;
  group: string;
  kind: "section" | "ui" | "kit" | "feature";
  keywords: string;
};

export function buildCatalogIndex(): CatalogEntry[] {
  const entries: CatalogEntry[] = [];

  for (const section of DESIGN_KIT_SECTIONS) {
    entries.push({
      id: section.id,
      label: section.label,
      group: section.group,
      kind: "section",
      keywords: section.keywords ?? "",
    });
  }

  for (const mod of DESIGN_KIT_UI_MODULES) {
    entries.push({
      id: mod,
      label: mod,
      group: "UI",
      kind: "ui",
      keywords: `ui primitive orbit wrapper ${mod}`,
    });
  }

  for (const mod of DESIGN_KIT_KIT_MODULES) {
    entries.push({
      id: mod,
      label: mod,
      group: "Kit",
      kind: "kit",
      keywords: `kit composite ${mod}`,
    });
  }

  for (const group of DESIGN_KIT_FEATURE_UI_GROUPS) {
    entries.push({
      id: group.id,
      label: group.label,
      group: "Feature",
      kind: "feature",
      keywords: `feature ${group.description}`,
    });
    for (const mod of group.modules) {
      entries.push({
        id: mod,
        label: mod,
        group: group.label,
        kind: "feature",
        keywords: `feature-ui ${group.id} ${mod}`,
      });
    }
  }

  return entries;
}

export function matchCatalogEntry(entry: CatalogEntry, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${entry.label} ${entry.group} ${entry.kind} ${entry.keywords}`.toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}
