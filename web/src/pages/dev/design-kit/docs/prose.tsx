import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import type { ReactNode } from "react";

/** Long-form handbook body — Orbit Box/Text only (LLM-safe). */
export function DocsProse({ children }: { children: ReactNode }) {
  return (
    <Box as="article" flexDirection="column" rowGap="l" width="100%" maxWidth={720}>
      {children}
    </Box>
  );
}

export function DocsP({ children }: { children: ReactNode }) {
  return (
    <Text variant="body" color="default" as="p">
      {children}
    </Text>
  );
}

export function DocsLead({ children }: { children: ReactNode }) {
  return (
    <Text variant="heading-xxs" color="muted" as="p">
      {children}
    </Text>
  );
}

export function DocsH2({ children }: { children: ReactNode }) {
  return (
    <Text variant="heading-xs" as="h2">
      {children}
    </Text>
  );
}

export function DocsH3({ children }: { children: ReactNode }) {
  return (
    <Text variant="heading-xxs" as="h3">
      {children}
    </Text>
  );
}

export function DocsList({ items }: { items: ReactNode[] }) {
  return (
    <Box as="ul" flexDirection="column" rowGap="s" width="100%" paddingLeft="l">
      {items.map((item, index) => (
        <Box as="li" key={index} flexDirection="column" rowGap="xs">
          <Text variant="body" color="default" as="span">
            {item}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

export function DocsRuleCard({
  index,
  title,
  lead,
  body,
}: {
  index: string;
  title: string;
  lead: string;
  body: string;
}) {
  return (
    <Box
      flexDirection="column"
      rowGap="m"
      padding="xl"
      backgroundColor="background-card"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      width="100%"
    >
      <Text variant="label" color="muted" monospace>
        {index}
      </Text>
      <Text variant="heading-xxs" as="h3">
        {title}
      </Text>
      <Text variant="body" color="muted">
        {lead}
      </Text>
      <Text variant="body" color="default">
        {body}
      </Text>
    </Box>
  );
}
