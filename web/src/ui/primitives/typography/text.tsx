// web/src/ui/primitives/typography/text.tsx
// Orbit Text wrapper with role-driven tags (h1..h6, p), line wrap balance/pretty presets,
// tabular-nums, number/compact formatters, and skeleton state.

import {
  Text as OrbitText,
  type TextColor,
  type TextStyleProps,
  type TextVariant,
} from "@polar-sh/orbit/Text";
import type { ComponentProps } from "react";

export { OrbitText as Text };
export type { TextColor, TextStyleProps, TextVariant };
export type TextProps = ComponentProps<typeof OrbitText>;

const numberFormatter = new Intl.NumberFormat("en-US");
const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact" });

/**
 * Format a numeric or string value with standard US thousands separators (e.g. 10243 -> "10,243").
 */
export function formatNumber(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return numberFormatter.format(n);
}

/**
 * Format a numeric or string value in compact notation (e.g. 1024300 -> "1M").
 */
export function formatCompact(value: number | string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  return compactFormatter.format(n);
}
