// src/components/kit/nav-count-pastille.tsx — Phase 4: Orbit Box/Text chip
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { formatCompactCount } from "@/lib/format-count";

export interface NavCountPastilleProps {
  /** Omit or zero hides the pastille. */
  count?: number | null;
  /** Accent wash when the nav item needs attention (e.g. unread alerts). */
  tone?: "neutral" | "accent";
  /** Defaults to "{count} items". */
  ariaLabel?: string;
}

/** Compact sidebar / rail count chip (token radius, mono tabular). */
export function NavCountPastille({
  count,
  tone = "neutral",
  ariaLabel,
}: NavCountPastilleProps) {
  if (count == null || count <= 0) {
    return null;
  }

  const label = formatCompactCount(count);

  return (
    <Box
      as="span"
      display="inline-flex"
      height={16}
      minWidth={16}
      flexShrink={0}
      alignItems="center"
      justifyContent="center"
      borderRadius="s"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor={tone === "accent" ? "background-accent" : "background-secondary"}
      paddingHorizontal="xs"
      aria-label={ariaLabel ?? `${count}`}
      title={String(count)}
    >
      <Text
        as="span"
        variant="caption"
        color={tone === "accent" ? "accent" : "muted"}
        monospace
        tabularNums
      >
        {label}
      </Text>
    </Box>
  );
}
