// src/components/kit/page-shell.tsx — Phase 4: Orbit Box chrome
import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";

export interface PageShellProps {
  title?: string;
  description?: string;
  /** Renders after the title on the left (e.g. section tabs). */
  leadingActions?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  density?: "standard" | "full-bleed";
}

/**
 * Standard density: full-width content pane with `--epure-page-gutter` (see tokens.css),
 * matching TopStrip so page edges align with the navbar.
 */
export function PageShell({
  leadingActions,
  actions,
  children,
  density = "standard",
}: PageShellProps) {
  const showHeader = Boolean(leadingActions || actions);

  return (
    <Box
      data-slot="page-shell"
      flexDirection="column"
      height="100%"
      minHeight={0}
      flex={1}
      // Page wash — matches `--surface-canvas` / `bg-canvas` on feed routes.
      backgroundColor="background-secondary"
    >
      {showHeader ? (
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
        >
          {leadingActions ? (
            <Box alignItems="center" minWidth={0} flex={1}>
              {leadingActions}
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
      ) : null}

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
          <Box
            data-slot="page-shell-column"
            flexDirection="column"
            width="100%"
            rowGap="xl"
            flexShrink={0}
          >
            {children}
          </Box>
        </Box>
      )}
    </Box>
  );
}
