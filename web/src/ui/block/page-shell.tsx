// web/src/ui/block/page-shell.tsx
// Tier 3 Block: Master Page Layout Shell & Compound Containers
// Consolidates PageShell, FeedListBody, and StackedCardList.

import * as React from "react";
import { Box } from "../primitives/layout/box";
import { FeedListBody, StackedCardList } from "./feed-list-shell";

export type PageShellDensity = "standard" | "full-bleed" | "feed";

export interface PageShellHeaderProps {
  leadingActions?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PageShellHeader({
  leadingActions,
  actions,
  children,
  className,
}: PageShellHeaderProps) {
  return (
    <Box
      as="header"
      data-slot="page-shell-header"
      alignItems="center"
      justifyContent="between"
      width="100%"
      height={48}
      flexShrink={0}
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-secondary"
      paddingHorizontal="none"
      columnGap="m"
      className={className}
    >
      {leadingActions ? (
        <Box alignItems="center" minWidth={0} flex={1}>
          {leadingActions}
        </Box>
      ) : children ? (
        <Box alignItems="center" minWidth={0} flex={1}>
          {children}
        </Box>
      ) : (
        <Box as="span" minWidth={0} flex={1} aria-hidden />
      )}
      {actions ? (
        <Box alignItems="center" flexShrink={0} columnGap="s">
          {actions}
        </Box>
      ) : null}
    </Box>
  );
}

export interface PageShellColumnProps {
  children: React.ReactNode;
  className?: string;
}

export function PageShellColumn({ children, className }: PageShellColumnProps) {
  return (
    <Box
      data-slot="page-shell-column"
      flexDirection="column"
      width="100%"
      rowGap="xl"
      flexShrink={0}
      className={className}
    >
      {children}
    </Box>
  );
}

export interface PageShellProps {
  title?: string;
  description?: string;
  /** Renders after the title on the left (e.g. section tabs). */
  leadingActions?: React.ReactNode;
  actions?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  density?: PageShellDensity;
  className?: string;
}

/**
 * Master Page Layout container:
 * - standard density: full-width scroll pane with `--epure-page-gutter` (50px).
 * - full-bleed density: unpadded 100% viewport container without auto-scroll.
 * - feed density: secondary feed list scroll container (FeedListBody).
 */
export function PageShell({
  leadingActions,
  actions,
  header,
  children,
  density = "standard",
  className,
}: PageShellProps) {
  const showHeader = Boolean(header || leadingActions || actions);

  return (
    <Box
      data-slot="page-shell"
      flexDirection="column"
      height="100%"
      minHeight={0}
      flex={1}
      backgroundColor="background-secondary"
      className={className}
    >
      {header ?? (showHeader ? (
        <PageShellHeader leadingActions={leadingActions} actions={actions} />
      ) : null)}

      {density === "full-bleed" ? (
        <Box
          as="main"
          flexDirection="column"
          minHeight={0}
          flex={1}
          overflow="hidden"
          backgroundColor="background-secondary"
        >
          {children}
        </Box>
      ) : density === "feed" ? (
        <FeedListBody>{children}</FeedListBody>
      ) : (
        <Box
          as="main"
          data-slot="page-shell-main"
          flexDirection="column"
          width="100%"
          minHeight={0}
          flex={1}
          overflow="auto"
          paddingHorizontal="none"
          paddingVertical="xl"
        >
          <PageShellColumn>{children}</PageShellColumn>
        </Box>
      )}
    </Box>
  );
}

// Attach compound subcomponents
PageShell.Header = PageShellHeader;
PageShell.Body = FeedListBody;
PageShell.StackedList = StackedCardList;
PageShell.Content = PageShellColumn;
