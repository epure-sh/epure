// web/src/ui/block/index.ts
// Tier 3: Block Tier & Multi-Component View Sections
// Consolidates page-level composite blocks, feed rows, navigation trees, telemetry sections,
// domain inspection panels, and setup wizards.

// Group 1: Feed & Row Blocks
export * from "./issue-feed-row";
export * from "./feed-list-shell";
export * from "./feed-skeletons";

// Group 2: Navigation & Shell Blocks
export * from "./settings-nav";
export * from "./page-shell";
export * from "./page-chrome";
export * from "./project-page-title";
export * from "./breadcrumb-timeline";

// Group 3: Occurrences & Telemetry Blocks
export * from "./occurrence-line-chart-path";
export * from "./occurrence-line-chart";
export * from "./issue-occurrences";
export * from "./issue-occurrence-timeline";
export * from "./issue-impact-strip";
export * from "./issue-context-fields";
export * from "./issue-context-snapshot";

// Group 4: Domain Panels & Setup Blocks
export * from "./stack-trace-panel";
export * from "./issue-detail-tabs";
export * from "./issue-detail-overlay";
export * from "./issue-overview-panel";
export * from "./issue-more-panel";
export * from "./more-panel";
export * from "./setup-connect-panel";
export * from "./setup-checklist";
export * from "./setup-connect-guide";
export * from "./setup-waiting-panel";
export * from "./dual-sending-card";

// Group 5: Filtering & Error Boundaries
export * from "./filter-panel";
export * from "./route-error-boundary";
