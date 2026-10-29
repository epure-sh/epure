import type { ReactNode } from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Grid } from "@polar-sh/orbit/Grid";
import { Text } from "@polar-sh/orbit/Text";
import { ALERT_ROW_TEMPLATE } from "./alert-list-column-header";

/**
 * Day section chrome — Orbit Grid + Text (Polar authoring).
 * Label (Today / Yesterday) = `label`; count = muted mono `caption`.
 */
export function AlertsDayGroup({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <Box as="section" data-slot="alerts-day-group" flexDirection="column" width="100%">
      <Grid
        templateColumns={ALERT_ROW_TEMPLATE}
        alignItems="center"
        width="100%"
        columnGap="m"
        paddingHorizontal="l"
        paddingVertical="s"
        backgroundColor="background-secondary"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
      >
        <Box width={16} height={16} flexShrink={0} aria-hidden />
        <Box alignItems="baseline" columnGap="s" minWidth={0} overflow="hidden">
          <Text as="h2" variant="label" color="muted">
            {label}
          </Text>
          <Text as="span" variant="caption" color="muted" monospace tabularNums>
            {count}
          </Text>
        </Box>
        <Box flexShrink={0} aria-hidden />
      </Grid>
      <Box flexDirection="column" width="100%">
        {children}
      </Box>
    </Box>
  );
}
