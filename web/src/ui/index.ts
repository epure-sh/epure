// web/src/ui/index.ts
// Root Barrel: Epure UI Three-Tier Architecture
// Re-exports all symbols from Primitives, Components, and Block tiers,
// alongside explicit backwards-compatible aliases for legacy consumers.

// ---------------------------------------------------------------------------
// Tier 1: Primitives (Foundation tokens, brand, typography, layout, atomic elements)
// ---------------------------------------------------------------------------
export * from "./primitives";

// ---------------------------------------------------------------------------
// Tier 2: Components (Composite variant-driven controls)
// ---------------------------------------------------------------------------
export * from "./components";

// ---------------------------------------------------------------------------
// Tier 3: Block (Page-level composite blocks, feed rows, navigation trees, panels)
// ---------------------------------------------------------------------------
export * from "./block";

// Resolve any duplicate star exports
export { Skeleton } from "./primitives";

// ---------------------------------------------------------------------------
// Explicit Backwards-Compatible Aliases
// ---------------------------------------------------------------------------
export {
  ApplyWithAiButton,
  type ApplyWithAiButtonProps,
  PolarCard,
  type PolarCardProps,
  FairUseBanner,
  type FairUseBannerProps,
  SourceCodeBlock,
  type SourceCodeBlockProps,
} from "./components";

export {
  IssueRowShell,
  type IssueRowShellProps,
  IssueRow,
  type IssueRowProps,
  WorkspaceSettingsNav,
  PageHeader,
  type PageHeaderProps,
  SimpleFeedHeader,
  type SimpleFeedHeaderProps,
  IssueRecentOccurrences,
  type IssueRecentOccurrencesProps,
  IssueOccurrencesTable,
  type IssueOccurrencesTableProps,
} from "./block";
