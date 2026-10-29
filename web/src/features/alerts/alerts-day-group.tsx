import type { ReactNode } from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";

/**
 * Day bucket — distinct typography from column header; alert cards stack below with gap.
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
    <Box as="section" data-slot="alerts-day-group" flexDirection="column" rowGap="m" width="100%">
      <Box alignItems="baseline" justifyContent="between" width="100%" paddingTop="xs">
        <Text as="h2" variant="heading-xxs" color="default">
          {label}
        </Text>
        <Text as="span" variant="caption" color="muted" monospace tabularNums>
          {count} {count === 1 ? "alert" : "alerts"}
        </Text>
      </Box>
      <ul className="m-0 flex w-full list-none flex-col gap-6 p-0">{children}</ul>
    </Box>
  );
}
