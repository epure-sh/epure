/**
 * PolarCard — Epure Orbit extension (no Orbit Card primitive).
 *
 * Authored like a Polar component: closed token API, Box/Text only, typed
 * variants — no public `className` / hex / dark:. See web/AGENTS.md
 * “Epure Orbit extensions”.
 */
import * as React from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import "./polar-card.css";

/** Orbit positive spacing tokens + flush. */
export type PolarCardPadding =
  | "none"
  | "xs"
  | "s"
  | "m"
  | "l"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl";

export type PolarCardVariant = "default" | "interactive" | "selected";

export interface PolarCardProps {
  children: React.ReactNode;
  /**
   * Visual / interaction variant (Polar-style closed lever).
   * - `default` — static tile
   * - `interactive` — hover lift + shadow (gallery / clickable)
   * - `selected` — secondary wash (current plan / multi-select)
   */
  variant?: PolarCardVariant;
  /** Soft hover lift. Prefer `variant="interactive"`; kept for callers. */
  interactive?: boolean;
  /** Selected wash. Prefer `variant="selected"`; kept for callers. */
  selected?: boolean;
  /** Inner padding token; `none` for flush bodies. Default `xl`. */
  padding?: PolarCardPadding;
  /** Router link — wraps card; implies interactive chrome. */
  to?: LinkProps["to"];
  onClick?: React.MouseEventHandler<HTMLElement>;
  role?: React.AriaRole;
  tabIndex?: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
}

function resolveVariant(
  variant: PolarCardVariant | undefined,
  interactive: boolean,
  selected: boolean,
  linked: boolean,
): PolarCardVariant {
  if (variant) {
    return variant;
  }
  if (selected) {
    return "selected";
  }
  if (interactive || linked) {
    return "interactive";
  }
  return "default";
}

export function PolarCard({
  children,
  variant: variantProp,
  interactive = false,
  selected = false,
  padding = "xl",
  to,
  onClick,
  role,
  tabIndex,
  onKeyDown,
}: PolarCardProps) {
  const variant = resolveVariant(variantProp, interactive, selected, Boolean(to));
  const lift = variant === "interactive" || Boolean(to);
  const isSelected = variant === "selected";
  const pad = padding === "none" ? undefined : padding;

  const card = (
    <Box
      as="div"
      data-slot="polar-card"
      data-variant={variant}
      data-interactive={lift ? "true" : undefined}
      borderRadius="xl"
      backgroundColor={
        isSelected
          ? "background-secondary"
          : lift
            ? { base: "background-primary", hover: "background-secondary" }
            : "background-primary"
      }
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      boxShadow={lift ? { base: "m", hover: "l" } : "m"}
      transform={lift ? { hover: "translateY(-2px)" } : undefined}
      transitionProperty={lift ? "common" : undefined}
      transitionDuration={lift ? "fast" : undefined}
      ease={lift ? "decelerate" : undefined}
      cursor={lift ? { hover: "pointer" } : undefined}
      padding={pad}
      flexDirection="column"
      width="100%"
      height="100%"
      overflow="hidden"
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
    >
      {children}
    </Box>
  );

  if (to) {
    return (
      <Link to={to} data-slot="polar-card-link">
        {card}
      </Link>
    );
  }

  return card;
}

export interface PolarCardHeaderProps {
  children: React.ReactNode;
}

export function PolarCardHeader({ children }: PolarCardHeaderProps) {
  return (
    <Box
      data-slot="polar-card-header"
      alignItems="start"
      justifyContent="between"
      columnGap="m"
      width="100%"
      flexShrink={0}>
      {children}
    </Box>
  );
}

export interface PolarCardTitleProps {
  children: React.ReactNode;
  as?: "h2" | "h3" | "h4";
}

export function PolarCardTitle({ children, as = "h3" }: PolarCardTitleProps) {
  return (
    <Text as={as} variant="heading-xxs">
      {children}
    </Text>
  );
}

export interface PolarCardDescriptionProps {
  children: React.ReactNode;
}

export function PolarCardDescription({ children }: PolarCardDescriptionProps) {
  return (
    <Text as="p" variant="caption" color="muted">
      {children}
    </Text>
  );
}

export interface PolarCardBodyProps {
  children: React.ReactNode;
  rowGap?: Exclude<PolarCardPadding, "none">;
}

export function PolarCardBody({ children, rowGap = "l" }: PolarCardBodyProps) {
  return (
    <Box
      data-slot="polar-card-body"
      flexDirection="column"
      rowGap={rowGap}
      width="100%"
      flex={1}
      minHeight={0}>
      {children}
    </Box>
  );
}

export interface PolarCardFooterProps {
  children: React.ReactNode;
  /** `row` = actions bar; `column` = stacked graph region. Default `row`. */
  orientation?: "row" | "column";
  /** Grow to fill leftover card height (gallery graphs). */
  grow?: boolean;
  rowGap?: Exclude<PolarCardPadding, "none">;
}

export function PolarCardFooter({
  children,
  orientation = "row",
  grow = false,
  rowGap = "s",
}: PolarCardFooterProps) {
  return (
    <Box
      data-slot="polar-card-footer"
      flexDirection={orientation === "column" ? "column" : "row"}
      alignItems={orientation === "column" ? "stretch" : "center"}
      justifyContent={orientation === "column" ? undefined : "between"}
      rowGap={orientation === "column" ? rowGap : undefined}
      columnGap={orientation === "row" ? "m" : undefined}
      width="100%"
      paddingTop="m"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      flex={grow ? 1 : undefined}
      minHeight={grow ? 0 : undefined}>
      {children}
    </Box>
  );
}

/** Hover-revealed trailing affordance (“Open →”) — parent-hover via polar-card.css. */
export function PolarCardOpenHint({ children }: { children: React.ReactNode }) {
  return (
    <Box
      data-slot="polar-card-open-hint"
      alignItems="center"
      justifyContent="end"
      columnGap="s"
      width="100%"
      flexShrink={0}
      color="text-secondary">
      {children}
    </Box>
  );
}
