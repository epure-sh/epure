// src/components/kit/section-card.tsx — Phase 4: Orbit Box/Text card chrome
import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";

export interface SectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  danger?: boolean;
  className?: string;
  contentClassName?: string;
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
}: SectionCardProps) {
  const hasHeader = Boolean(title || description || headerActions);

  return (
    <Box
      as="section"
      data-slot="section-card"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor={danger ? "border-warning" : "border-primary"}
      backgroundColor={danger ? "background-danger" : "background-card"}
      boxShadow="s"
      overflow="hidden"
      flexDirection="column"
      // eslint-disable-next-line no-restricted-syntax -- kit API className
      className={className}
    >
      {hasHeader ? (
        <Box
          alignItems="center"
          justifyContent="between"
          borderBottomWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          paddingHorizontal="l"
          paddingVertical="m"
          backgroundColor="background-card"
        >
          <Box flexDirection="column" rowGap="xs" minWidth={0}>
            {title ? (
              <Text as="h3" variant="label">
                {title}
              </Text>
            ) : null}
            {description ? (
              <Text as="p" variant="caption" color="muted">
                {description}
              </Text>
            ) : null}
          </Box>
          {headerActions ? (
            <Box alignItems="center" columnGap="s" flexShrink={0}>
              {headerActions}
            </Box>
          ) : null}
        </Box>
      ) : null}

      <Box
        padding="l"
        color="text-secondary"
        // eslint-disable-next-line no-restricted-syntax -- kit API contentClassName
        className={contentClassName}
      >
        {children}
      </Box>

      {footer ? (
        <Box
          alignItems="center"
          justifyContent="between"
          borderTopWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          backgroundColor="background-secondary"
          paddingHorizontal="l"
          paddingVertical="m"
          color="text-secondary"
        >
          {footer}
        </Box>
      ) : null}
    </Box>
  );
}
