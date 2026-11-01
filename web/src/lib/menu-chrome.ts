/**
 * Shared floating-menu chrome (DropdownMenu, Select, Command rows).
 * Card: --radius-control + p-1. Rows: --radius-menu-item (control − padding).
 * Force radius: Orbit `twMerge` does not treat custom `rounded-control` as conflicting
 * with `rounded-xl` / `rounded-lg`, so without `!` the Orbit class wins in CSS order.
 */
export const MENU_SURFACE =
  "overflow-hidden !rounded-control !border-2 !border-border-strong bg-surface-1 p-1 text-fg-primary shadow-float";

/**
 * Select/Orbit content already pads the viewport (`p-1`). Same card chrome, no extra inset.
 * Force border: Orbit SelectContent merges `border-none` after className.
 */
export const MENU_SURFACE_PADDED_CHILD =
  "overflow-hidden !rounded-control !border-2 !border-solid !border-border-strong bg-surface-1 p-0 text-fg-primary shadow-float";

/** Row / item radius — use ! when Orbit merges a conflicting rounded-* after className. */
export const MENU_ITEM_RADIUS = "rounded-menu-item";
export const MENU_ITEM_RADIUS_FORCE = "!rounded-menu-item";
