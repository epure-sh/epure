/** Shared grid templates for issues feed header + rows — keep in sync. */
export const FEED_GRID_FULL =
  "grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_3rem_7.5rem_3.25rem_3.25rem_2.75rem_2.5rem]";

export const FEED_GRID_COMPACT = "grid-cols-[2.5rem_minmax(0,1fr)_4.5rem_3.25rem]";

/** Cell padding — must match between header and row. */
export const FEED_CELL_CHECKBOX = "flex items-center justify-center px-1.5 py-1.5";
export const FEED_CELL_ISSUE = "min-w-0 px-3 py-1.5 lg:px-4";
export const FEED_CELL_TEXT = "px-2 py-1.5";
export const FEED_CELL_TREND = "min-w-0 px-2 py-1.5";
export const FEED_CELL_NUMERIC = "px-2 py-1.5 text-right";
export const FEED_CELL_PRIORITY = "flex items-center justify-center px-2 py-1.5";

/** Header-only vertical dividers between columns. */
export const FEED_HEADER_CELL = "flex h-auto items-center border-r border-border py-2";
