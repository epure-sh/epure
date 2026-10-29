import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import {
  OrbitRecipeCard,
  OrbitRecipeEmpty,
  OrbitRecipeError,
  OrbitRecipeGrid,
  OrbitRecipeLoading,
  OrbitRecipeStack,
  OrbitRecipeToolbar,
} from "../../orbit-proof/orbit-recipes";
import { DocsExample } from "./example";
import { DocsPageHeader } from "./page-header";
import { DocsSection } from "./section";

const SEMANTIC_BACKGROUNDS = [
  "background-primary",
  "background-secondary",
  "background-card",
  "background-inverse",
  "background-accent",
  "background-warning",
  "background-success",
  "background-danger",
] as const;

/**
 * Live Box/Text cookbook — formerly /__orbit.
 * Agents copy from here; markdown twin: design/ORBIT_RECIPES.md.
 */
export function RecipesPage() {
  return (
    <Box id="recipes" flexDirection="column" width="100%">
      <DocsPageHeader
        eyebrow="Orbit · Cookbook"
        title="Recipes"
        description="Copy-paste Box/Text patterns. Same contract as Polar: token props only, no Tailwind layout drift. Source: orbit-recipes.tsx · markdown: design/ORBIT_RECIPES.md."
      />

      <DocsSection
        title="Semantic backgrounds"
        description="Pass token names to Box backgroundColor. Values resolve via light-dark() — never a second theme pass."
      >
        <Box
          display="grid"
          gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))"
          gap="m"
          width="100%"
        >
          {SEMANTIC_BACKGROUNDS.map((token) => (
            <Box
              key={token}
              flexDirection="column"
              rowGap="s"
              padding="m"
              backgroundColor={token}
              borderRadius="m"
              borderWidth={1}
              borderStyle="solid"
              borderColor="border-primary"
              minHeight={96}
              justifyContent="end"
              color={token === "background-inverse" ? "text-primary" : "text-secondary"}
            >
              <Text as="span" variant="label" color="inherit" monospace>
                {token}
              </Text>
            </Box>
          ))}
        </Box>
      </DocsSection>

      <DocsSection title="Stack">
        <DocsExample
          title="Vertical stack"
          description='flexDirection="column" + rowGap token — never Tailwind gap-*.'
          code={`<Box flexDirection="column" rowGap="l" width="100%">
  <Text variant="label">Vertical stack</Text>
  <Text color="muted">Third child — spacing is tokenized</Text>
</Box>`}
        >
          <OrbitRecipeStack />
        </DocsExample>
      </DocsSection>

      <DocsSection title="Card surface">
        <DocsExample
          title="Card"
          description="background-card + border-primary + padding/radius tokens."
          code={`<Box
  borderRadius="l"
  backgroundColor="background-card"
  borderWidth={1}
  borderStyle="solid"
  borderColor="border-primary"
  padding="xl"
  flexDirection="column"
  rowGap="m"
>
  <Text variant="heading-xs" as="h3">Card title</Text>
  <Text color="muted">Body</Text>
</Box>`}
        >
          <OrbitRecipeCard />
        </DocsExample>
      </DocsSection>

      <DocsSection title="Toolbar">
        <DocsExample
          title="Sticky toolbar"
          description="position sticky + border tokens. Actions via Orbit Button."
          code={`<Box
  position="sticky"
  top={0}
  backgroundColor="background-primary"
  borderBottomWidth={1}
  borderStyle="solid"
  borderColor="border-primary"
  paddingHorizontal="l"
  paddingVertical="m"
  alignItems="center"
  justifyContent="between"
>
  …
</Box>`}
        >
          <OrbitRecipeToolbar />
        </DocsExample>
      </DocsSection>

      <DocsSection title="Empty · Loading · Error">
        <DocsExample title="Empty" code={`// centered column + muted copy + secondary CTA`}>
          <OrbitRecipeEmpty />
        </DocsExample>
        <DocsExample
          title="Loading"
          description="Text loading placeholders + Spinner."
          code={`<Text loading placeholderText="Loading title…" variant="heading-xs" />
<Text loading placeholderNumberOfLines={3} />
<Spinner />`}
        >
          <OrbitRecipeLoading />
        </DocsExample>
        <DocsExample
          title="Error"
          description="background-warning + border-warning — treat as primary, not an apology."
          code={`<Box backgroundColor="background-warning" borderColor="border-warning" …>`}
        >
          <OrbitRecipeError />
        </DocsExample>
      </DocsSection>

      <DocsSection title="Grid">
        <DocsExample
          title="Responsive grid"
          description="Orbit Grid with templateColumns breakpoints."
          code={`<Grid
  templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
  gap="m"
  width="100%"
>
  …
</Grid>`}
        >
          <OrbitRecipeGrid />
        </DocsExample>
      </DocsSection>
    </Box>
  );
}
