import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";

export interface MetricPulseCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  badges?: React.ReactNode;
  trend?: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
}

/** Compact metric tile — white PolarCard surface (background-primary), not gray card wash. */
export function MetricPulseCard({
  label,
  value,
  hint,
  badges,
  trend,
  loading = false,
  onClick,
}: MetricPulseCardProps) {
  const interactive = typeof onClick === "function";

  return (
    <Box
      as="div"
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      data-slot="metric-pulse-card"
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor={
        interactive
          ? { base: "background-primary", hover: "background-secondary" }
          : "background-primary"
      }
      boxShadow="s"
      padding="l"
      flexDirection="column"
      rowGap="s"
      minHeight={108}
      width="100%"
      textAlign="left"
      cursor={interactive ? "pointer" : undefined}
      transitionProperty={interactive ? "common" : undefined}
      transitionDuration={interactive ? "fast" : undefined}
    >
      <Box alignItems="start" justifyContent="between" columnGap="s">
        <Text as="span" variant="caption" color="muted">
          {label}
        </Text>
        {trend}
      </Box>
      <Text as="div" variant="heading-m" color={loading ? "muted" : "default"} tabularNums>
        {loading ? "…" : value}
      </Text>
      {badges || hint ? (
        <Box alignItems="center" columnGap="s" flexWrap="wrap" marginTop="auto" paddingTop="xs">
          {badges}
          {hint ? (
            <Text as="span" variant="caption" color="muted">
              {hint}
            </Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}
