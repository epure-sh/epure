import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import {
  ArrowRight,
  Bell,
  Check,
  ChevronRight,
  CircleAlert,
  Search,
  Settings2,
  X,
} from "@polar-sh/orbit/icons";
import { DocsExample, DocsPageHeader, DocsSection } from "../docs";
import {
  DocsH2,
  DocsLead,
  DocsP,
  DocsProse,
  DocsRuleCard,
} from "../docs/prose";
import { BrandSection } from "./brand-section";

/** Orbit `spacing` tokens from `@polar-sh/orbit/theme` / value.stylex. */
const SPACE_SCALE = [
  "none",
  "xs",
  "s",
  "m",
  "l",
  "xl",
  "2xl",
  "3xl",
  "4xl",
  "5xl",
] as const;

/** Orbit `borderRadii` tokens. */
const RADIUS_SCALE = ["none", "s", "m", "l", "xl", "full"] as const;

/** Orbit `shadows` tokens. */
const SHADOW_SCALE = ["none", "s", "m", "l", "xl"] as const;

const BG_TOKENS = [
  "background-primary",
  "background-secondary",
  "background-card",
  "background-inverse",
  "background-accent",
  "background-warning",
  "background-success",
  "background-danger",
] as const;

const TEXT_SWATCHES = [
  "default",
  "muted",
  "accent",
  "danger",
  "warning",
  "success",
] as const;

const BORDER_TOKENS = ["border-primary", "border-secondary", "border-warning"] as const;

const DURATIONS = ["instant", "fast", "base", "slow", "slower"] as const;
const EASINGS = ["standard", "decelerate", "accelerate", "spring"] as const;

const TEXT_VARIANTS = [
  "heading-2xl",
  "heading-xl",
  "heading-l",
  "heading-m",
  "heading-s",
  "heading-xs",
  "heading-xxs",
  "body",
  "title",
  "label",
  "caption",
] as const;

const ORBIT_ICONS = [
  { Icon: Search, name: "Search" },
  { Icon: Settings2, name: "Settings2" },
  { Icon: Bell, name: "Bell" },
  { Icon: Check, name: "Check" },
  { Icon: X, name: "X" },
  { Icon: CircleAlert, name: "CircleAlert" },
  { Icon: ArrowRight, name: "ArrowRight" },
  { Icon: ChevronRight, name: "ChevronRight" },
] as const;

const SPACE_PX: Record<(typeof SPACE_SCALE)[number], string> = {
  none: "0",
  xs: "4px",
  s: "8px",
  m: "12px",
  l: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "48px",
  "4xl": "64px",
  "5xl": "96px",
};

/** Orbit home + principles + brand + LLM contract. */
export function FoundationsIntroPage() {
  return (
    <Box id="foundations" flexDirection="column" width="100%" rowGap="3xl">
      <Box
        flexDirection="column"
        alignItems="center"
        rowGap="m"
        paddingTop="2xl"
        paddingBottom="xl"
        width="100%"
      >
        <Text variant="heading-l" as="h1">
          Orbit
        </Text>
        <Text variant="heading-xxs" color="muted" as="p">
          The foundation behind every Epure surface — Polar{" "}
          <Text as="span" variant="heading-xxs" monospace color="muted">
            @polar-sh/orbit
          </Text>
          .
        </Text>
      </Box>

      <Box flexDirection="column" rowGap="xl" width="100%">
        <Box
          flexDirection="column"
          rowGap="m"
          paddingBottom="l"
          borderBottomWidth={1}
          borderStyle="solid"
          borderColor="border-primary"
          width="100%"
        >
          <Text variant="heading-xs" as="h2">
            Principles
          </Text>
          <Text variant="body" color="muted">
            Three rules govern every decision in the system.
          </Text>
        </Box>

        <DocsRuleCard
          index="01"
          title="Design by subtraction"
          lead="Start with everything. Remove until only what is necessary remains. Then remove one more thing. What survives is the design."
          body="Orbit ships one spacing scale, a handful of radii, and a small set of semantic colors. Prefer a closed token over a one-off value."
        />
        <DocsRuleCard
          index="02"
          title="Derived, not decorated"
          lead="Every visual choice follows from a token or a typed prop. Decorations that cannot be named are not part of the system."
          body="Box and Text carry layout and type. New UI is composed from Orbit primitives and Epure kit families — never a parallel style sheet."
        />
        <DocsRuleCard
          index="03"
          title="Precision as respect"
          lead="Box makes precision the default: typed props take tokens, never raw pixels."
          body="Variants absorb similarity. Two components that differ by color, size, or state are one component with axes."
        />
      </Box>

      <Box flexDirection="column" rowGap="l" width="100%">
        <DocsH2>Vision & voice</DocsH2>
        <DocsProse>
          <DocsLead>
            Invisibility through exactness — infrastructure so considered it disappears.
          </DocsLead>
          <DocsP>
            Epure inherits Polar&apos;s Orbit package. Foundations and primitives below are
            the Polar tokens and components — not Epure re-skins.
          </DocsP>
        </DocsProse>
        <BrandSection />
      </Box>

      <Box flexDirection="column" rowGap="l" width="100%">
        <DocsH2>LLM contract</DocsH2>
        <DocsProse>
          <DocsP>
            Tokens are the only vocabulary. Prefer Box over bare layout divs. Prefer Text
            variants over ad-hoc type. Import from{" "}
            <Text as="span" variant="body" monospace>
              @polar-sh/orbit
            </Text>
            .
          </DocsP>
        </DocsProse>
      </Box>
    </Box>
  );
}

export function ColorsPage() {
  return (
    <Box id="colors" flexDirection="column" width="100%">
      <DocsPageHeader
        title="Colors"
        description="Orbit semantic background, text, and border tokens via light-dark() — from @polar-sh/orbit/theme."
      />
      <DocsSection title="Background" description="backgroundColors in semantics.stylex">
        <DocsExample code={`<Box backgroundColor="background-card" />`}>
          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fill, minmax(120px, 1fr))"
            gap="m"
            width="100%"
          >
            {BG_TOKENS.map((token) => (
              <Box key={token} flexDirection="column" rowGap="s">
                <Box
                  height={48}
                  borderRadius="m"
                  backgroundColor={token}
                  borderWidth={1}
                  borderStyle="solid"
                  borderColor="border-primary"
                />
                <Text variant="caption" monospace color="muted">
                  {token}
                </Text>
              </Box>
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
      <DocsSection title="Text" description="Text color prop on Orbit Text">
        <DocsExample code={`<Text color="muted">…</Text>`}>
          <Box flexDirection="row" columnGap="l" flexWrap="wrap" rowGap="s">
            {TEXT_SWATCHES.map((c) => (
              <Text key={c} variant="body" color={c}>
                {c}
              </Text>
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
      <DocsSection title="Border" description="borderColors">
        <DocsExample code={`<Box borderColor="border-primary" borderWidth={1} />`}>
          <Box
            display="grid"
            gridTemplateColumns="repeat(3, 1fr)"
            gap="m"
            width="100%"
          >
            {BORDER_TOKENS.map((token) => (
              <Box key={token} flexDirection="column" rowGap="s">
                <Box
                  height={40}
                  borderRadius="m"
                  backgroundColor="background-primary"
                  borderWidth={2}
                  borderStyle="solid"
                  borderColor={token}
                />
                <Text variant="caption" monospace color="muted">
                  {token}
                </Text>
              </Box>
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
    </Box>
  );
}

export function SpacingPage() {
  return (
    <Box id="spacing" flexDirection="column" width="100%">
      <DocsPageHeader
        title="Spacing"
        description="Orbit spacing tokens (padding, margin, gap) — none → 5xl from value.stylex."
      />
      <DocsSection title="Scale">
        <DocsExample code={`<Box padding="l" rowGap="m" />`}>
          <Box
            flexDirection="row"
            columnGap="l"
            alignItems="end"
            flexWrap="wrap"
            rowGap="l"
            width="100%"
          >
            {SPACE_SCALE.map((token) => (
              <Box key={token} flexDirection="column" alignItems="center" rowGap="s">
                <Box
                  backgroundColor="background-accent"
                  borderRadius="s"
                  width={token === "none" ? 4 : undefined}
                  height={token === "none" ? 4 : undefined}
                  padding={token === "none" ? undefined : token}
                >
                  {token !== "none" ? (
                    <Box
                      width={8}
                      height={8}
                      backgroundColor="background-inverse"
                      borderRadius="full"
                    />
                  ) : null}
                </Box>
                <Text variant="caption" monospace color="muted">
                  {token}
                </Text>
                <Text variant="caption" monospace color="muted">
                  {SPACE_PX[token]}
                </Text>
              </Box>
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
    </Box>
  );
}

export function RadiusPage() {
  return (
    <Box id="radius" flexDirection="column" width="100%">
      <DocsPageHeader
        title="Radius"
        description="Orbit borderRadii tokens on Box — none · s · m · l · xl · full. Not Tailwind rounded-*."
      />
      <DocsSection title="Scale">
        <DocsExample code={`<Box borderRadius="l" />`}>
          <Box
            flexDirection="row"
            columnGap="l"
            flexWrap="wrap"
            rowGap="l"
            width="100%"
          >
            {RADIUS_SCALE.map((token) => (
              <Box key={token} flexDirection="column" alignItems="center" rowGap="s">
                <Box
                  width={56}
                  height={56}
                  backgroundColor="background-secondary"
                  borderRadius={token}
                  borderWidth={1}
                  borderStyle="solid"
                  borderColor="border-primary"
                />
                <Text variant="caption" monospace color="muted">
                  {token}
                </Text>
              </Box>
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
    </Box>
  );
}

export function ShadowsPage() {
  return (
    <Box id="shadows" flexDirection="column" width="100%">
      <DocsPageHeader
        title="Shadows"
        description="Orbit elevation tokens — boxShadow on Box."
      />
      <DocsSection title="Scale">
        <DocsExample code={`<Box boxShadow="m" />`}>
          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fill, minmax(120px, 1fr))"
            gap="l"
            width="100%"
            padding="l"
          >
            {SHADOW_SCALE.map((token) => (
              <Box
                key={token}
                height={80}
                alignItems="center"
                justifyContent="center"
                backgroundColor="background-primary"
                borderRadius="l"
                boxShadow={token}
              >
                <Text variant="caption" monospace color="muted">
                  {token}
                </Text>
              </Box>
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
    </Box>
  );
}

function MotionLane({
  label,
  duration,
  easing,
}: {
  label: string;
  duration: (typeof DURATIONS)[number];
  easing: (typeof EASINGS)[number];
}) {
  const [atEnd, setAtEnd] = React.useState(false);

  return (
    <Box
      as="div"
      role="button"
      tabIndex={0}
      flexDirection="column"
      rowGap="s"
      padding="m"
      borderRadius="l"
      borderWidth={1}
      borderStyle="solid"
      borderColor="border-primary"
      backgroundColor="background-secondary"
      width="100%"
      cursor="pointer"
      onClick={() => setAtEnd((v) => !v)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setAtEnd((v) => !v);
        }
      }}
    >
      <Text variant="caption" monospace color="muted">
        {label}
      </Text>
      <Box
        position="relative"
        height={24}
        borderRadius="s"
        backgroundColor="background-primary"
        overflow="hidden"
        width="100%"
      >
        <Box
          position="absolute"
          top={4}
          left={atEnd ? 160 : 4}
          width={16}
          height={16}
          borderRadius="s"
          backgroundColor="background-accent"
          transitionProperty="all"
          transitionDuration={duration}
          ease={easing}
        />
      </Box>
      <Text variant="caption" color="muted">
        Click to replay
      </Text>
    </Box>
  );
}

export function MotionFoundationPage() {
  return (
    <Box id="motion" flexDirection="column" width="100%">
      <DocsPageHeader
        title="Motion"
        description="Orbit durations and easings on Box — decelerate enter, accelerate exit."
      />
      <DocsSection title="Durations" description="instant · fast · base · slow · slower">
        <DocsExample code={`transitionDuration="fast"`}>
          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))"
            gap="m"
            width="100%"
          >
            {DURATIONS.map((d) => (
              <MotionLane
                key={d}
                label={d}
                duration={d}
                easing="standard"
              />
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
      <DocsSection title="Easings" description="standard · decelerate · accelerate · spring">
        <DocsExample code={`ease="decelerate"`}>
          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fill, minmax(200px, 1fr))"
            gap="m"
            width="100%"
          >
            {EASINGS.map((e) => (
              <MotionLane key={e} label={e} duration="slower" easing={e} />
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
    </Box>
  );
}

export function TypographyFoundationPage() {
  return (
    <Box id="typography" flexDirection="column" width="100%">
      <DocsPageHeader
        title="Typography"
        description="Orbit Text variants — never invent a type size."
      />
      <DocsSection title="Variants">
        <DocsExample code={`<Text variant="heading-s">…</Text>`}>
          <Box flexDirection="column" rowGap="m" width="100%">
            {TEXT_VARIANTS.map((v) => (
              <Text key={v} variant={v} as="p">
                {v} — The quick brown fox
              </Text>
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
      <DocsSection title="Color">
        <DocsExample>
          <Box flexDirection="row" columnGap="l" flexWrap="wrap" rowGap="s">
            {TEXT_SWATCHES.map((c) => (
              <Text key={c} variant="body" color={c}>
                {c}
              </Text>
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
    </Box>
  );
}

export function IconsPage() {
  return (
    <Box id="icons" flexDirection="column" width="100%">
      <DocsPageHeader
        title="Icons"
        description="Polar Orbit icons — Lucide + Material via @polar-sh/orbit/icons."
      />
      <DocsSection title="Lucide set" description="Representative icons from the Orbit package.">
        <DocsExample
          code={`import { Search } from "@polar-sh/orbit/icons"\n\n<Search size={16} />`}
        >
          <Box flexDirection="row" columnGap="xl" flexWrap="wrap" rowGap="l">
            {ORBIT_ICONS.map(({ Icon, name }) => (
              <Box key={name} flexDirection="column" alignItems="center" rowGap="s">
                <Icon size={20} />
                <Text variant="caption" monospace color="muted">
                  {name}
                </Text>
              </Box>
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
      <DocsSection title="Size">
        <DocsExample>
          <Box flexDirection="row" alignItems="end" columnGap="l">
            {[12, 14, 16, 20, 24].map((size) => (
              <Box key={size} flexDirection="column" alignItems="center" rowGap="s">
                <Settings2 size={size} />
                <Text variant="caption" monospace color="muted">
                  {size}
                </Text>
              </Box>
            ))}
          </Box>
        </DocsExample>
      </DocsSection>
    </Box>
  );
}
