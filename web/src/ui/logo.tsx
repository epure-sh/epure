import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, SVGProps } from "react";

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
  | 24;

/** Ledger Rupture (#18) — round-3 lead: calm ledger torn by one exception. */
export const LEDGER_RUPTURE_GEOMETRY = {
  topBar: { x: 5, y: 7, width: 22, height: 4.5, rx: 2 },
  bottomBar: { x: 5, y: 20.5, width: 22, height: 4.5, rx: 2 },
  midLeft: { x: 5, y: 13.5, width: 8, height: 5, rx: 2 },
  midRight: { x: 19, y: 13.5, width: 8, height: 5, rx: 2 },
  rupture: { x: 13.5, y: 9, width: 5, height: 14, rx: 2.5 },
} as const;

/** Round-3 bold directions (2026-09-14 v3). */
export const LOGO_ROUND3_VARIANTS: LogoVariant[] = [17, 18, 19, 20, 21, 22, 23, 24];

/** Round-2 directions (2026-09-14 v2). */
export const LOGO_ROUND2_VARIANTS: LogoVariant[] = [10, 11, 12, 13, 14, 15, 16];

/** Preview canonical — round 3 until a direction is locked. */
export const LOGO_CANONICAL_VARIANT: LogoVariant = 18;

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
};

type LogoMarkProps = SVGProps<SVGSVGElement> & {
  variant?: LogoVariant;
  size?: number;
};

function MarkPaths({ variant }: { variant: LogoVariant }) {
  const fg = "currentColor";

  switch (variant) {
    case 1:
      return (
        <>
          <circle cx="10" cy="11.5" r="2.25" fill={fg} />
          <path
            d="M14 11.5H24"
            stroke={fg}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.42"
          />
          <path
            d="M8 17H22"
            stroke={fg}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.28"
          />
          <path
            d="M8 21H17"
            stroke={fg}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.18"
          />
        </>
      );
    case 2:
      return (
        <>
          <rect x={7} y={8} width={6} height={16} rx={3} fill={fg} />
          <circle cx={21} cy={16} r={5.5} fill={fg} />
        </>
      );
    case 3:
      return (
        <>
          <path
            d="M11 9V23"
            stroke={fg}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path
            d="M21 9V23"
            stroke={fg}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.55"
          />
          <path d="M11 16H21" stroke={fg} strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="16" cy="16" r="2" fill={fg} />
        </>
      );
    case 4:
      return (
        <path
          d="M8 10H19M8 10V21"
          stroke={fg}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 5:
      return (
        <>
          <path
            d="M11 10V22"
            stroke={fg}
            strokeWidth="2.25"
            strokeLinecap="round"
          />
          <path
            d="M11 11.5C11 11.5 20 11.5 20 16C20 20.5 11 20.5 11 20.5"
            stroke={fg}
            strokeWidth="2.25"
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case 6:
      return (
        <>
          <circle cx="11" cy="12" r="1.25" fill={fg} opacity="0.22" />
          <circle cx="21" cy="13" r="1.25" fill={fg} opacity="0.22" />
          <circle cx="14" cy="21" r="1.25" fill={fg} opacity="0.22" />
          <circle cx="18" cy="16" r="3.25" fill={fg} />
        </>
      );
    case 7:
      return (
        <>
          <rect x={5} y={21} width={22} height={5} rx={2.5} fill={fg} />
          <rect x={13} y={6} width={6} height={16} rx={3} fill={fg} />
        </>
      );
    case 8:
      return (
        <>
          <path d="M7 8 L7 24 L17 16 Z" fill={fg} />
          <path d="M25 8 L25 24 L17 16 Z" fill={fg} />
        </>
      );
    case 9:
      return (
        <>
          <path d="M8 8 H22 V12 H12 V22 H8 Z" fill={fg} />
          <rect x="20" y="8" width="5" height="5" rx="1.25" fill={fg} />
        </>
      );
    /* ── Round 2: fresh directions ── */
    case 10:
      /* Surfaced Card — one issue popped from the stack */
      return (
        <>
          <rect x="11" y="13" width="14" height="14" rx="3" fill={fg} />
          <rect x="6" y="7" width="14" height="14" rx="3" fill={fg} />
        </>
      );
    case 11:
      /* Uneven Bars — tall exception beside shorter calm bar */
      return (
        <>
          <rect x="9" y="6" width="5" height="20" rx="2.5" fill={fg} />
          <rect x="18" y="12" width="5" height="14" rx="2.5" fill={fg} />
        </>
      );
    case 12:
      /* Bold e — name-native glyph, filled not stroked */
      return (
        <path
          d="M9 7h3.5v5.5h7c2.8 0 2.8-3.5 0-3.5h-7V7zm0 8.5h3.5v9.5h8.5c2.8 0 2.8-3.5 0-3.5H12.5V15.5H9z"
          fill={fg}
        />
      );
    case 13:
      /* Orbit — small signal beside calm field */
      return (
        <>
          <circle cx="19" cy="19" r="6" fill={fg} />
          <circle cx="11" cy="11" r="4.5" fill={fg} />
        </>
      );
    case 14:
      /* Funnel — epure filters noise to pure signal */
      return (
        <path
          d="M 9 7 L 23 7 L 19 25 L 13 25 Z"
          fill={fg}
        />
      );
    case 15:
      /* Bracket Frame — dev-native code frame around the exception */
      return (
        <>
          <path d="M8 7 H 15 V 10 H 11 V 22 H 15 V 25 H 8 Z" fill={fg} />
          <path d="M24 7 H 17 V 10 H 21 V 22 H 17 V 25 H 24 Z" fill={fg} />
        </>
      );
    case 16:
      return (
        <>
          <rect x="6" y="20" width="20" height="4" rx="2" fill={fg} />
          <circle cx="16" cy="11" r="5" fill={fg} />
        </>
      );
    /* ── Round 3: bold + personalized ── */
    case 17:
      /* Épuré Cut — purification by removing a corner chunk */
      return (
        <path d="M7 25 V7 H21 V12 H12 V25 H7 Z" fill={fg} />
      );
    case 18: {
      /* Ledger Rupture — calm ledger torn open by one exception */
      const g = LEDGER_RUPTURE_GEOMETRY;
      return (
        <>
          <rect
            x={g.topBar.x}
            y={g.topBar.y}
            width={g.topBar.width}
            height={g.topBar.height}
            rx={g.topBar.rx}
            fill={fg}
          />
          <rect
            x={g.bottomBar.x}
            y={g.bottomBar.y}
            width={g.bottomBar.width}
            height={g.bottomBar.height}
            rx={g.bottomBar.rx}
            fill={fg}
          />
          <rect
            x={g.midLeft.x}
            y={g.midLeft.y}
            width={g.midLeft.width}
            height={g.midLeft.height}
            rx={g.midLeft.rx}
            fill={fg}
          />
          <rect
            x={g.midRight.x}
            y={g.midRight.y}
            width={g.midRight.width}
            height={g.midRight.height}
            rx={g.midRight.rx}
            fill={fg}
          />
          <rect
            x={g.rupture.x}
            y={g.rupture.y}
            width={g.rupture.width}
            height={g.rupture.height}
            rx={g.rupture.rx}
            fill={fg}
          />
        </>
      );
    }
    case 19:
      /* Pure Blade — one decisive angular cut through noise */
      return <path d="M6 24 L18 6 H26 L14 24 Z" fill={fg} />;
    case 20:
      /* Open C — epure consumes the stream, only signal passes */
      return (
        <path
          d="M21 9 C21 9 9 9 9 16 C9 23 21 23 21 23 V 20 C14 20 12 16 12 16 C12 12 21 12 21 9 Z"
          fill={fg}
        />
      );
    case 21:
      /* Épure Glyph — ownable name mark, not generic monogram */
      return (
        <path
          d="M8 6 V26 H12 V17 H19 C24 17 24 11 19 11 H12 V6 H8 Z"
          fill={fg}
        />
      );
    case 22:
      /* Silence Break — flat calm shattered by one fat vertical */
      return (
        <>
          <rect x="4" y="19" width="24" height="6" rx="3" fill={fg} />
          <rect x="13" y="5" width="6" height="20" rx="3" fill={fg} />
        </>
      );
    case 23:
      /* Keystone — one bold upward form, exception rising */
      return <path d="M7 24 L16 5 L25 24 Z" fill={fg} />;
    case 24:
      /* Twin Gate — spike valve as two heavy pillars */
      return (
        <>
          <rect x="8" y="6" width="5" height="20" rx="2.5" fill={fg} />
          <rect x="19" y="6" width="5" height="20" rx="2.5" fill={fg} />
        </>
      );
  }
}

export function LogoMark({
  variant = LOGO_CANONICAL_VARIANT,
  size = 32,
  className,
  ...props
}: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={`epure logo — ${LOGO_VARIANT_NAMES[variant]}`}
      className={cn("shrink-0", className)}
      {...props}
    >
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <g className="text-accent-contrast">
        <MarkPaths variant={variant} />
      </g>
    </svg>
  );
}

export function LogoWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-medium tracking-ui text-ink select-none",
        className,
      )}
    >
      epure
    </span>
  );
}

export function LogoLockup({
  variant = LOGO_CANONICAL_VARIANT,
  markSize = 28,
  className,
}: {
  variant?: LogoVariant;
  markSize?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark variant={variant} size={markSize} />
      <LogoWordmark className="text-base" />
    </span>
  );
}

const NAVBAR_LOGO_SIZE = 24;

export function LogoNavButton({
  variant = LOGO_CANONICAL_VARIANT,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: LogoVariant }) {
  return (
    <button
      type="button"
      className={cn(
        "epure-navbar-logo inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md focus-ring",
        className,
      )}
      aria-label="epure home"
      {...props}
    >
      <LogoMark variant={variant} size={NAVBAR_LOGO_SIZE} />
    </button>
  );
}

export function LogoExplorationRow({
  className,
  variants = LOGO_ROUND3_VARIANTS,
}: {
  className?: string;
  variants?: LogoVariant[];
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {variants.map((variant) => (
        <div
          key={variant}
          className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-4"
        >
          <span className="font-mono text-xs text-ink-muted">{variant}</span>
          <LogoLockup variant={variant} markSize={32} />
          <span className="text-center text-xs text-ink-subtle">
            {LOGO_VARIANT_NAMES[variant]}
            {variant === LOGO_CANONICAL_VARIANT ? " · lead" : null}
          </span>
        </div>
      ))}
    </div>
  );
}
