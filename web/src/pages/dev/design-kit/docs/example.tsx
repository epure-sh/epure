import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import type { ReactNode } from "react";
import { DocsCodeBlock } from "./code-block";

/**
 * Orbit-docs Example — live preview frame + optional code.
 * Prefer this over MDX; registry pages are TSX (see orbit.polar.sh).
 */
export function DocsExample({
  title,
  description,
  code,
  align = "start",
  children,
}: {
  title?: string;
  description?: ReactNode;
  code?: string;
  align?: "start" | "center" | "stretch";
  children: ReactNode;
}) {
  return (
    <Box flexDirection="column" rowGap="m" width="100%">
      {title || description ? (
        <Box flexDirection="column" rowGap="xs">
          {title ? (
            <Text variant="heading-xxs" as="h3">
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
      <Box
        flexDirection="column"
        borderRadius="l"
        borderWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        backgroundColor="background-primary"
        overflow="hidden"
        width="100%"
      >
        <Box
          flexDirection="column"
          alignItems={align}
          justifyContent="center"
          rowGap="l"
          padding="xl"
          minHeight={120}
          width="100%"
        >
          {children}
        </Box>
        {code ? <DocsCodeBlock code={code} /> : null}
      </Box>
    </Box>
  );
}
