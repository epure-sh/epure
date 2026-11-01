// web/src/ui/components/card.tsx
// Tier 2 Component: Consolidated Card System (Cluster 4)
// Consolidates Calm Ledger Card, Orbit PolarCard, and SectionCard.

import * as React from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { cn } from "@/lib/cn";

export type CardVariant = "default" | "interactive" | "selected" | "inset" | "flat";
export type CardPadding =
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

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Visual & physical interaction variant */
  variant?: CardVariant;
  /** Inner padding token */
  padding?: CardPadding;
  /** Hover lift and pointer feedback */
  interactive?: boolean;
  /** Selected accent wash */
  selected?: boolean;
  /** Wraps card in a react-router Link */
  to?: LinkProps["to"];
  /** Red warning border and background */
  danger?: boolean;
  /** Removes padding for flush content (charts, tables) */
  flush?: boolean;
  /** Shorthand title */
  title?: React.ReactNode;
  /** Shorthand description */
  description?: React.ReactNode;
  /** Shorthand header actions slot */
  headerActions?: React.ReactNode;
  /** Shorthand footer slot */
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: "p-0",
  xs: "p-2",
  s: "p-3",
  m: "p-4",
  l: "p-5",
  xl: "p-6",
  "2xl": "p-8",
  "3xl": "p-10",
  "4xl": "p-12",
  "5xl": "p-14",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "default",
      padding,
      interactive = false,
      selected = false,
      to,
      danger = false,
      flush = false,
      title,
      description,
      headerActions,
      footer,
      children,
      className,
      onClick,
      ...props
    },
    ref,
  ) => {
    // Resolve variant
    const resolvedVariant: CardVariant =
      selected
        ? "selected"
        : interactive || Boolean(to) || variant === "interactive"
          ? "interactive"
          : variant;

    const isInteractive = resolvedVariant === "interactive";
    const isSelected = resolvedVariant === "selected";
    const isInset = resolvedVariant === "inset";
    const isFlat = resolvedVariant === "flat";

    const resolvedPaddingClass =
      padding != null ? PADDING_CLASSES[padding] : flush ? "p-0" : undefined;

    const hasShorthandHeader = Boolean(title || description || headerActions);

    const cardContent = (
      <div
        ref={ref}
        data-slot="card"
        data-variant={resolvedVariant}
        data-interactive={isInteractive ? "true" : undefined}
        className={cn(
          "epure-card relative overflow-hidden transition-all duration-fast",
          // Base surface
          !isFlat && !isInset && "rounded-panel border border-border-subtle bg-surface-1 text-fg-primary shadow-tactile",
          isInset && "rounded-lg border border-border bg-surface-inset text-fg-primary",
          isFlat && "rounded-lg border border-transparent bg-transparent text-fg-primary",
          // Interactive states
          isInteractive && [
            "cursor-pointer hover:border-border-strong hover:bg-surface-elevated hover:shadow-md",
            "active:scale-[0.99] motion-reduce:active:scale-100",
          ],
          // Selected states
          isSelected && "border-accent bg-accent-muted/20 shadow-xs",
          // Danger state
          danger && "border-semantic-danger/60 bg-semantic-danger/5",
          resolvedPaddingClass,
          className,
        )}
        onClick={onClick}
        {...props}
      >
        {hasShorthandHeader ? (
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex flex-col gap-0.5">
              {title ? <CardTitle>{title}</CardTitle> : null}
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
            {headerActions ? <div className="flex items-center gap-2">{headerActions}</div> : null}
          </CardHeader>
        ) : null}

        {children}

        {footer ? <CardFooter>{footer}</CardFooter> : null}
      </div>
    );

    if (to) {
      return (
        <Link to={to} data-slot="polar-card-link" className="block h-full min-w-0 no-underline text-inherit">
          {cardContent}
        </Link>
      );
    }

    return cardContent;
  },
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-header"
      className={cn(
        "flex flex-col gap-1 p-5 border-b border-border-subtle bg-surface-1/50",
        className,
      )}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" }
>(({ as = "h3", className, ...props }, ref) => {
  const Comp = as;
  return (
    <Comp
      ref={ref}
      data-slot="card-title"
      className={cn("text-sm font-semibold tracking-tight text-fg-primary", className)}
      {...props}
    />
  );
});
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="card-description"
    className={cn("text-xs text-fg-muted", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-content"
      className={cn("p-5 text-xs text-fg-secondary", className)}
      {...props}
    />
  ),
);
CardContent.displayName = "CardContent";

/** Alias for CardContent matching PolarCard API */
export const CardBody = CardContent;

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-footer"
      className={cn(
        "border-t border-border-subtle bg-surface-2/40 px-5 py-3 text-xs text-fg-muted flex items-center justify-between",
        className,
      )}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";

export const CardAction = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="card-action"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  ),
);
CardAction.displayName = "CardAction";

// ---------------------------------------------------------------------------
// Backwards Compatibility Wrappers for PolarCard and SectionCard
// ---------------------------------------------------------------------------

export type PolarCardPadding = CardPadding;
export type PolarCardVariant = "default" | "interactive" | "selected";

export interface PolarCardProps {
  children: React.ReactNode;
  variant?: PolarCardVariant;
  interactive?: boolean;
  selected?: boolean;
  padding?: PolarCardPadding;
  to?: LinkProps["to"];
  onClick?: React.MouseEventHandler<HTMLElement>;
  role?: React.AriaRole;
  tabIndex?: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
}

export function PolarCard({
  children,
  variant,
  interactive,
  selected,
  padding = "xl",
  to,
  onClick,
  role,
  tabIndex,
  onKeyDown,
}: PolarCardProps) {
  return (
    <Card
      variant={variant}
      interactive={interactive}
      selected={selected}
      padding={padding}
      to={to}
      onClick={onClick}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
    >
      {children}
    </Card>
  );
}

export function PolarCardHeader({ children }: { children: React.ReactNode }) {
  return (
    <Box
      data-slot="polar-card-header"
      alignItems="start"
      justifyContent="between"
      columnGap="m"
      width="100%"
      flexShrink={0}
    >
      {children}
    </Box>
  );
}

export function PolarCardTitle({
  children,
  as = "h3",
}: {
  children: React.ReactNode;
  as?: "h2" | "h3" | "h4";
}) {
  return (
    <Text as={as} variant="heading-xxs">
      {children}
    </Text>
  );
}

export function PolarCardDescription({ children }: { children: React.ReactNode }) {
  return (
    <Text as="p" variant="caption" color="muted">
      {children}
    </Text>
  );
}

export function PolarCardBody({
  children,
  rowGap = "l",
}: {
  children: React.ReactNode;
  rowGap?: Exclude<PolarCardPadding, "none">;
}) {
  return (
    <Box
      data-slot="polar-card-body"
      flexDirection="column"
      rowGap={rowGap}
      width="100%"
      flex={1}
      minHeight={0}
    >
      {children}
    </Box>
  );
}

export function PolarCardFooter({
  children,
  orientation = "row",
  grow = false,
  rowGap = "s",
}: {
  children: React.ReactNode;
  orientation?: "row" | "column";
  grow?: boolean;
  rowGap?: Exclude<PolarCardPadding, "none">;
}) {
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
      minHeight={grow ? 0 : undefined}
    >
      {children}
    </Box>
  );
}

export function PolarCardOpenHint({ children }: { children: React.ReactNode }) {
  return (
    <Box
      data-slot="polar-card-open-hint"
      alignItems="center"
      justifyContent="end"
      columnGap="s"
      width="100%"
      flexShrink={0}
      color="text-secondary"
    >
      {children}
    </Box>
  );
}

export interface SectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  danger?: boolean;
  className?: string;
  contentClassName?: string;
  flush?: boolean;
}

export function SectionCard({
  title,
  description,
  headerActions,
  children,
  footer,
  danger = false,
  className,
  contentClassName,
  flush = false,
}: SectionCardProps) {
  return (
    <Card
      title={title}
      description={description}
      headerActions={headerActions}
      footer={footer}
      danger={danger}
      flush={flush}
      className={className}
    >
      <div className={cn(!flush && "p-5", contentClassName)}>{children}</div>
    </Card>
  );
}
