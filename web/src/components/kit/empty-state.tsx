// src/components/kit/empty-state.tsx — Phase 4: Orbit Box/Text
import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { Button } from "@/components/ui/button";
import { Tray } from "@/components/ui/icon";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <Box
      data-slot="empty-state"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight={220}
      borderRadius="m"
      borderWidth={1}
      borderStyle="dashed"
      borderColor="border-primary"
      padding="2xl"
      textAlign="center"
      // eslint-disable-next-line no-restricted-syntax -- kit API className
      className={className}
    >
      <Box
        alignItems="center"
        justifyContent="center"
        width={36}
        height={36}
        borderRadius="s"
        backgroundColor="background-secondary"
        color="text-secondary"
        marginBottom="m"
      >
        {icon || <Tray size={20} weight="regular" />}
      </Box>
      <Text as="h3" variant="label">
        {title}
      </Text>
      {description ? (
        <Box marginTop="xs" maxWidth={384}>
          <Text as="p" variant="caption" color="muted">
            {description}
          </Text>
        </Box>
      ) : null}
      {actionLabel && onAction ? (
        <Box marginTop="l">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
