import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import type { ReactNode } from "react";

/** Orbit-docs Section — titled block of Examples. */
export function DocsSection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box as="section" flexDirection="column" rowGap="xl" marginBottom="3xl" width="100%">
      {title || description ? (
        <Box flexDirection="column" rowGap="s">
          {title ? (
            <Text variant="heading-xs" as="h2">
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text variant="body" color="muted">
              {description}
            </Text>
          ) : null}
        </Box>
      ) : null}
      {children}
    </Box>
  );
}
