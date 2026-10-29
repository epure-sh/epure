import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import {
  DESIGN_KIT_KIT_MODULES,
  DESIGN_KIT_UI_MODULES,
  DESIGN_KIT_UI_META,
} from "../registry";
import { DocsPageHeader } from "./page-header";
import { DocsSection } from "./section";
import { DocsExample } from "./example";
import { DocsRuleCard } from "./prose";

function IndexCard({
  index,
  title,
  description,
  onSelect,
  id,
}: {
  index: string;
  title: string;
  description: string;
  id: string;
  onSelect: (id: string) => void;
}) {
  const activate = () => onSelect(id);
  return (
    <Box
      flexDirection="column"
      rowGap="s"
      padding="l"
      backgroundColor={{ base: "background-card", hover: "background-secondary" }}
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      cursor="pointer"
      transitionProperty="common"
      transitionDuration="fast"
      ease="decelerate"
      width="100%"
      role="button"
      tabIndex={0}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    >
      <Text variant="label" color="muted" monospace>
        {index}
      </Text>
      <Text variant="heading-xxs" as="span">
        {title}
      </Text>
      <Text variant="body" color="muted" as="span">
        {description}
      </Text>
    </Box>
  );
}

const FOUNDATIONS: { id: string; title: string; description: string }[] = [
  {
    id: "tokens",
    title: "Colors",
    description: "Background, text and border color tokens for light and dark.",
  },
  {
    id: "space-radius",
    title: "Spacing & radius",
    description: "The spacing scale and border radius tokens.",
  },
  {
    id: "motion",
    title: "Motion",
    description: "Duration and easing tokens for transitions and animation.",
  },
  {
    id: "typography",
    title: "Typography",
    description: "Text variants, colors and the type scale.",
  },
  {
    id: "libraries",
    title: "Icons & libraries",
    description: "Phosphor icons, Radix, and the Orbit stack.",
  },
];

/**
 * Orbit-home equivalent — principles + foundations + components index.
 * Pattern: https://orbit.polar.sh/
 */
export function OrbitOverviewPage({ onSelect }: { onSelect: (id: string) => void }) {
  const orbitUi = DESIGN_KIT_UI_MODULES.filter((m) => DESIGN_KIT_UI_META[m].orbit);

  return (
    <>
      <DocsPageHeader
        eyebrow="Epure · Orbit"
        title="Orbit"
        description="The foundation behind every Epure surface. Same LLM-safe bet as Polar: typed tokens, Box/Text, CI as the contract. One catalog — principles, foundations, components, recipes."
      />

      <DocsSection
        title="Principles"
        description="Three rules govern every decision in the system. They are why Orbit looks the way it does, and the bar each component is held to."
      >
        <Box flexDirection="column" rowGap="l" width="100%">
          <DocsRuleCard
            index="01"
            title="Design by subtraction"
            lead="Start with everything. Remove until only what is necessary remains. Then remove one more thing. What survives is the design."
            body="Orbit ships one spacing scale, a handful of radii, and a small set of semantic colors. The constraint is the feature. Fewer choices means fewer ways to drift, so every surface reads as one system."
          />
          <DocsRuleCard
            index="02"
            title="Derived, not decorated"
            lead="Every element should feel like it emerged from an underlying rule, not a preference. Beauty is an outcome of correctness, not ornament."
            body="Color resolves from light-dark(), spacing from a single scale, motion from physical curves. You author one styling pass and dark mode is free, because the values are computed rather than handpicked."
          />
          <DocsRuleCard
            index="03"
            title="Precision as respect"
            lead="An imprecise pixel, word, or interaction signals that we do not understand the people we build for. Precision is not a quality bar, it is a form of respect."
            body="Box makes precision the default by removing arbitrary values: typed props take tokens, never raw pixels, so the easy path and the correct path are the same."
          />
        </Box>
        <Box marginTop="m">
          <IndexCard
            index="→"
            id="principles"
            title="Full handbook principles"
            description="Ordered rules + product / visual / voice guidance from handbook.polar.sh/design."
            onSelect={onSelect}
          />
        </Box>
      </DocsSection>

      <DocsSection title="Foundations">
        <Box
          display="grid"
          gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))"
          gap="m"
          width="100%"
        >
          {FOUNDATIONS.map((item, i) => (
            <IndexCard
              key={item.id}
              index={String(i + 1).padStart(2, "0")}
              id={item.id}
              title={item.title}
              description={item.description}
              onSelect={onSelect}
            />
          ))}
        </Box>
      </DocsSection>

      <DocsSection
        title="Components"
        description={`${DESIGN_KIT_UI_MODULES.length} UI · ${DESIGN_KIT_KIT_MODULES.length} kit. Open a sidebar leaf for preview + import path.`}
      >
        <Box
          display="grid"
          gridTemplateColumns="repeat(auto-fill, minmax(180px, 1fr))"
          gap="m"
          width="100%"
        >
          {orbitUi.map((mod, i) => (
            <IndexCard
              key={mod}
              index={String(i + 1).padStart(2, "0")}
              id={mod}
              title={mod}
              description={DESIGN_KIT_UI_META[mod].description}
              onSelect={onSelect}
            />
          ))}
          <IndexCard
            index="→"
            id="kit"
            title="Composite kit"
            description="PageShell, EmptyState, DataTable, PolarCard, …"
            onSelect={onSelect}
          />
          <IndexCard
            index="→"
            id="recipes"
            title="Recipes"
            description="Copy-paste Box/Text patterns agents should follow."
            onSelect={onSelect}
          />
        </Box>
      </DocsSection>

      <DocsSection title="Authoring">
        <DocsExample
          title="Prefer Box / Text"
          description="Tokens flip with the document theme class. Never invent spacing or color outside the token vocabulary."
          code={`import { Box } from '@polar-sh/orbit/Box'
import { Text } from '@polar-sh/orbit/Text'

<Box flexDirection="column" rowGap="l">
  <Text variant="heading-xs">Title</Text>
  <Text color="muted">Body</Text>
</Box>`}
        >
          <Box
            flexDirection="column"
            rowGap="s"
            padding="l"
            backgroundColor="background-card"
            borderRadius="m"
            borderWidth={1}
            borderStyle="solid"
            borderColor="border-primary"
            maxWidth={360}
            width="100%"
          >
            <Text variant="heading-xs">Title</Text>
            <Text color="muted">Body — tokens flip with the document theme</Text>
          </Box>
        </DocsExample>
      </DocsSection>

      <DocsSection title="For agents">
        <Box
          display="grid"
          gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))"
          gap="m"
          width="100%"
        >
          <IndexCard
            index="01"
            id="handbook"
            title="Design handbook"
            description="Vision, perception pillars, brand pillars — full Polar text."
            onSelect={onSelect}
          />
          <IndexCard
            index="02"
            id="llm-contract"
            title="LLM contract"
            description="ADR-0004 + Epure Orbit zone rules. Lint is the guarantee."
            onSelect={onSelect}
          />
          <IndexCard
            index="03"
            id="recipes"
            title="Recipes"
            description="Stack, card, toolbar, empty / loading / error, grid."
            onSelect={onSelect}
          />
          <IndexCard
            index="04"
            id="product-docs"
            title="Repo markdown"
            description="ORBIT_CONTRACT, SYSTEM, QA — on-disk sources."
            onSelect={onSelect}
          />
        </Box>
      </DocsSection>
    </>
  );
}
