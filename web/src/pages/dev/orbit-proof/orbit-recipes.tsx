import { Box } from "@polar-sh/orbit/Box";
import { Button } from "@polar-sh/orbit/Button";
import { Grid } from "@polar-sh/orbit/Grid";
import { Spinner } from "@polar-sh/orbit/Spinner";
import { Text } from "@polar-sh/orbit/Text";

/**
 * Phase 1 copy-paste recipes for Orbit Box/Text.
 * Kept under orbit-proof so ESLint Orbit bans apply. See design/ORBIT_RECIPES.md.
 */

export function OrbitRecipeStack() {
  return (
    <Box flexDirection="column" rowGap="l" width="100%">
      <Text variant="label">Vertical stack</Text>
      <Text color="muted">flexDirection=&quot;column&quot; + rowGap</Text>
      <Text color="muted">Third child — spacing is tokenized, not Tailwind gap-*</Text>
    </Box>
  );
}

export function OrbitRecipeCard() {
  return (
    <Box
      borderRadius="l"
      backgroundColor="background-card"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      padding="xl"
      flexDirection="column"
      rowGap="m"
      width="100%"
      maxWidth={420}
    >
      <Text variant="heading-xs" as="h3">
        Card title
      </Text>
      <Text color="muted">
        background-card + border-primary. Tokens flip with the document theme — no theme-variant utilities.
      </Text>
      <Box columnGap="s" alignItems="center">
        <Button variant="default" size="sm">
          Primary
        </Button>
        <Button variant="secondary" size="sm">
          Secondary
        </Button>
      </Box>
    </Box>
  );
}

export function OrbitRecipeToolbar() {
  return (
    <Box
      position="sticky"
      top={0}
      zIndex={10}
      backgroundColor="background-primary"
      borderBottomWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      paddingHorizontal="l"
      paddingVertical="m"
      alignItems="center"
      justifyContent="between"
      width="100%"
      maxWidth={640}
    >
      <Text variant="heading-xxs" as="h3">
        Sticky toolbar
      </Text>
      <Box alignItems="center" columnGap="s">
        <Button variant="outline" size="sm">
          Filter
        </Button>
        <Button variant="default" size="sm">
          Action
        </Button>
      </Box>
    </Box>
  );
}

export function OrbitRecipeEmpty() {
  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      paddingVertical="3xl"
      rowGap="l"
      width="100%"
      backgroundColor="background-secondary"
      borderRadius="m"
    >
      <Text color="muted">No items found</Text>
      <Button variant="secondary" size="sm">
        Create first item
      </Button>
    </Box>
  );
}

export function OrbitRecipeLoading() {
  return (
    <Box
      flexDirection="column"
      rowGap="m"
      padding="l"
      width="100%"
      maxWidth={420}
      backgroundColor="background-card"
      borderRadius="m"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
    >
      <Text loading placeholderText="Loading title…" variant="heading-xs" />
      <Text loading placeholderNumberOfLines={3} />
      <Box alignItems="center" columnGap="s">
        <Spinner />
        <Text color="muted">Loading…</Text>
      </Box>
    </Box>
  );
}

export function OrbitRecipeError() {
  return (
    <Box
      borderRadius="m"
      backgroundColor="background-warning"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-warning"
      padding="l"
      flexDirection="column"
      rowGap="s"
      width="100%"
      maxWidth={420}
    >
      <Text variant="label">Something went wrong</Text>
      <Text>Request failed with status 503. Retry in a moment.</Text>
    </Box>
  );
}

export function OrbitRecipeGrid() {
  return (
    <Grid
      templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
      gap="m"
      width="100%"
    >
      {["A", "B", "C", "D"].map((label) => (
        <Box
          key={label}
          padding="m"
          backgroundColor="background-secondary"
          borderRadius="m"
          borderWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          alignItems="center"
          justifyContent="center"
          minHeight={72}
        >
          <Text variant="label">{label}</Text>
        </Box>
      ))}
    </Grid>
  );
}

const RECIPE_SECTIONS = [
  { id: "stack", title: "Stack", render: () => <OrbitRecipeStack /> },
  { id: "card", title: "Card", render: () => <OrbitRecipeCard /> },
  { id: "toolbar", title: "Toolbar", render: () => <OrbitRecipeToolbar /> },
  { id: "empty", title: "Empty", render: () => <OrbitRecipeEmpty /> },
  { id: "loading", title: "Loading", render: () => <OrbitRecipeLoading /> },
  { id: "error", title: "Error", render: () => <OrbitRecipeError /> },
  { id: "grid", title: "Grid", render: () => <OrbitRecipeGrid /> },
] as const;

/** Mounted via /__design#recipes (RecipesPage). /__orbit redirects there. */
export function OrbitRecipesSection() {
  return (
    <Box as="section" flexDirection="column" rowGap="xl" width="100%">
      <Box flexDirection="column" rowGap="xs">
        <Text variant="heading-xs">Recipes</Text>
        <Text color="muted">
          Phase 1 cookbook — stack, card, toolbar, empty / loading / error, grid.
          Source: orbit-recipes.tsx · markdown: design/ORBIT_RECIPES.md
        </Text>
      </Box>
      {RECIPE_SECTIONS.map((section) => (
        <Box key={section.id} flexDirection="column" rowGap="m" width="100%">
          <Text variant="heading-xxs" as="h3">
            {section.title}
          </Text>
          {section.render()}
        </Box>
      ))}
    </Box>
  );
}
