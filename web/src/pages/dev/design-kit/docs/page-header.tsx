import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import type { ReactNode } from "react";

/** Orbit-docs PageHeader — title + optional eyebrow / description. */
export function DocsPageHeader({
  eyebrow,
  title,
  description,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Box
      as="header"
      flexDirection="column"
      rowGap="l"
      paddingBottom="xl"
      marginBottom="2xl"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      width="100%"
    >
      {eyebrow ? (
        <Text variant="label" color="muted">
          {eyebrow}
        </Text>
      ) : null}
      <Box
        alignItems="center"
        justifyContent="between"
        columnGap="l"
        flexWrap="wrap"
        rowGap="m"
        width="100%"
      >
        <Text variant="heading-s" as="h1">
          {title}
        </Text>
        {trailing}
      </Box>
      {description ? (
        <Text variant="heading-xxs" color="muted">
          {description}
        </Text>
      ) : null}
    </Box>
  );
}
