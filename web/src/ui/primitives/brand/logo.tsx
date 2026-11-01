// web/src/ui/primitives/brand/logo.tsx
// Epure brand identity: title-case name rule, canonical Chain Link Mark #25, and logo components.

import * as React from "react";
import type { ButtonHTMLAttributes, SVGProps } from "react";
import { cn } from "@/lib/utils";

/** Canonical brand name. Rule: Always Title Case "Epure" — never "EPURE" or "epure". */
export const BRAND_NAME = "Epure" as const;

/** Canonical mark index (#25 Chain Link). */
export const CANONICAL_MARK_INDEX = 25 as const;

/** Chain Link geometry paths (stadium 54×32, diagonal cuts at 27.5°, stroke 8.5). */
const CHAIN_LINK_LEFT =
  "M31.85 0H16A16 16 0 0 0 0 16a16 16 0 0 0 16 16h1.65L22.075 23.5H16A7.5 7.5 0 0 1 8.5 16 7.5 7.5 0 0 1 16 8.5h11.425Z";
const CHAIN_LINK_RIGHT =
  "M36.35 0 31.925 8.5H38A7.5 7.5 0 0 1 45.5 16 7.5 7.5 0 0 1 38 23.5H26.575L22.15 32H38a16 16 0 0 0 16-16 16 16 0 0 0-16-16Z";
const CHAIN_LINK_TRANSFORM = "translate(6.0000 10.0741) scale(0.370370)";

export interface EpureBrandIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Pure SVG Chain Link Mark #25 (currentColor, no background container).
 */
export function EpureBrandIcon({
  size = 18,
  className,
  ...props
}: EpureBrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={BRAND_NAME}
      className={cn("shrink-0", className)}
      {...props}
    >
      <g fill="currentColor" transform={CHAIN_LINK_TRANSFORM}>
        <path d={CHAIN_LINK_LEFT} />
        <path d={CHAIN_LINK_RIGHT} />
      </g>
    </svg>
  );
}

export interface EpureBrandMarkProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Canonical Chain Link mark #25 seated on rounded-radius container.
 */
export function EpureBrandMark({
  size = 32,
  className,
  ...props
}: EpureBrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={BRAND_NAME}
      className={cn("shrink-0", className)}
      {...props}
    >
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <g className="fill-accent-contrast" transform={CHAIN_LINK_TRANSFORM}>
        <path d={CHAIN_LINK_LEFT} />
        <path d={CHAIN_LINK_RIGHT} />
      </g>
    </svg>
  );
}

export interface LogoWordmarkProps extends React.HTMLAttributes<HTMLSpanElement> {}

/**
 * Epure title-case wordmark.
 */
export function LogoWordmark({ className, ...props }: LogoWordmarkProps) {
  return (
    <span
      className={cn(
        "font-display font-medium tracking-[0.015em] text-ink select-none",
        className,
      )}
      {...props}
    >
      {BRAND_NAME}
    </span>
  );
}

export interface LogoLockupProps extends React.HTMLAttributes<HTMLSpanElement> {
  markSize?: number;
  variant?: number;
}

/**
 * Mark + Wordmark lockup.
 */
export function LogoLockup({
  markSize = 28,
  variant = CANONICAL_MARK_INDEX,
  className,
  ...props
}: LogoLockupProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
      {...props}
    >
      <LogoMark variant={variant} size={markSize} />
      <LogoWordmark className="text-base" />
    </span>
  );
}

export interface LogoNavButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  markSize?: number;
}

/**
 * Interactive navbar logo trigger.
 */
export function LogoNavButton({
  markSize = 24,
  className,
  ...props
}: LogoNavButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "epure-navbar-logo inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
      aria-label={`${BRAND_NAME} home`}
      {...props}
    >
      <EpureBrandMark size={markSize} />
    </button>
  );
}

export type LogoVariant =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25;

export const LOGO_CANONICAL_VARIANT: LogoVariant = 25;

export const LOGO_VARIANT_NAMES: Record<LogoVariant, string> = {
  1: "Signal Ledger",
  2: "Live Strike",
  3: "Valve Gate",
  4: "Stack Frame",
  5: "Monogram e",
  6: "Noise to Signal",
  7: "Pure Spike",
  8: "Spike Valve",
  9: "Pure Frame",
  10: "Surfaced Card",
  11: "Uneven Bars",
  12: "Bold e",
  13: "Orbit",
  14: "Funnel",
  15: "Bracket Frame",
  16: "Beacon",
  17: "Épuré Cut",
  18: "Ledger Rupture",
  19: "Pure Blade",
  20: "Open C",
  21: "Épure Glyph",
  22: "Silence Break",
  23: "Keystone",
  24: "Twin Gate",
  25: "Chain Link (Canonical)",
};

function MarkPaths({ variant }: { variant: LogoVariant }) {
  const fg = "currentColor";

  switch (variant) {
    case 25:
      return (
        <g fill={fg} transform={CHAIN_LINK_TRANSFORM}>
          <path d={CHAIN_LINK_LEFT} />
          <path d={CHAIN_LINK_RIGHT} />
        </g>
      );
    case 7:
      return (
        <>
          <rect x={5} y={21} width={22} height={5} rx={2.5} fill={fg} />
          <rect x={13} y={6} width={6} height={16} rx={3} fill={fg} />
        </>
      );
    case 18:
      return (
        <>
          <rect x={5} y={7} width={22} height={4.5} rx={2} fill={fg} />
          <rect x={5} y={20.5} width={22} height={4.5} rx={2} fill={fg} />
          <rect x={5} y={13.5} width={8} height={5} rx={2} fill={fg} />
          <rect x={19} y={13.5} width={8} height={5} rx={2} fill={fg} />
          <rect x={13.5} y={9} width={5} height={14} rx={2.5} fill={fg} />
        </>
      );
    default:
      // Canonical fallback
      return (
        <g fill={fg} transform={CHAIN_LINK_TRANSFORM}>
          <path d={CHAIN_LINK_LEFT} />
          <path d={CHAIN_LINK_RIGHT} />
        </g>
      );
  }
}

export interface LogoMarkProps extends SVGProps<SVGSVGElement> {
  variant?: LogoVariant | number;
  size?: number | string;
}

/**
 * General LogoMark component supporting canonical #25 and historical variants.
 */
export function LogoMark({
  variant = LOGO_CANONICAL_VARIANT,
  size = 32,
  className,
  ...props
}: LogoMarkProps) {
  const v = (variant as LogoVariant) in LOGO_VARIANT_NAMES ? (variant as LogoVariant) : 25;
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={`${BRAND_NAME} logo. ${LOGO_VARIANT_NAMES[v]}`}
      className={cn("shrink-0", className)}
      {...props}
    >
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <g className="text-accent-contrast">
        <MarkPaths variant={v} />
      </g>
    </svg>
  );
}
