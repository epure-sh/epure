import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { DESIGN_KIT_FEATURE_UI_GROUPS } from "./feature-ui-registry";
import {
  DESIGN_KIT_KIT_META,
  DESIGN_KIT_KIT_MODULES,
  DESIGN_KIT_UI_META,
  DESIGN_KIT_UI_MODULES,
} from "./registry";
import {
  DocsExample,
  DocsPageHeader,
  DocsSection,
  HandbookIntroPage,
  HandbookLlmContractPage,
  HandbookPrinciplesPage,
  HandbookProductDesignPage,
  HandbookVisualDesignPage,
  HandbookVoiceTonePage,
  OrbitOverviewPage,
  RecipesPage,
} from "./docs";
import { PreviewChromeProvider } from "./preview-chrome";
import { FeatureUiGroupPreviews } from "./previews/feature-ui/feature-ui-group-previews";
import { TokensSection } from "./sections/tokens-section";
import { TypographySection } from "./sections/typography-section";
import { ShellSection } from "./sections/shell-section";
import { MotionSection } from "./sections/motion-section";
import { StatesSection } from "./sections/states-section";
import { ProductDocsSection } from "./sections/product-docs-section";
import { AlertsSection } from "./sections/alerts-section";
import { BrandSection } from "./sections/brand-section";
import { LibrariesSection } from "./sections/libraries-section";
import { A11ySection } from "./sections/a11y-section";

const uiPreviewModules = import.meta.glob<{ default: React.ComponentType }>(
  "./previews/ui/*.preview.tsx",
  { eager: true },
);
const kitPreviewModules = import.meta.glob<{ default: React.ComponentType }>(
  "./previews/kit/*.preview.tsx",
  { eager: true },
);

function resolvePreview(
  modules: Record<string, { default: React.ComponentType }>,
  stem: string,
) {
  const key = Object.keys(modules).find((k) => k.includes(`/${stem}.preview.tsx`));
  return key ? modules[key].default : null;
}

function CatalogLinkCard({
  id,
  title,
  description,
  onSelect,
}: {
  id: string;
  title: string;
  description: string;
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
      textAlign="left"
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
      <Text variant="heading-xxs" as="span">
        {title}
      </Text>
      <Text variant="body" color="muted" as="span">
        {description}
      </Text>
    </Box>
  );
}

function SectionEntry({
  id,
  title,
  eyebrow,
  description,
  children,
}: {
  id: string;
  title: string;
  eyebrow: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Box id={id} flexDirection="column" width="100%">
      <DocsPageHeader eyebrow={eyebrow} title={title} description={description} />
      <DocsSection>
        <PreviewChromeProvider chrome={false}>{children}</PreviewChromeProvider>
      </DocsSection>
    </Box>
  );
}

function ModuleExamplePage({
  id,
  eyebrow,
  title,
  description,
  importPath,
  orbit,
  phase,
  Preview,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  importPath: string;
  orbit?: string;
  phase?: string;
  Preview: React.ComponentType;
}) {
  const snippet = `import { … } from "${importPath}"${
    orbit ? `\n// Maps to Orbit ${orbit}` : ""
  }${phase ? `\n// Kit phase ${phase}` : ""}`;

  return (
    <Box id={id} flexDirection="column" width="100%">
      <DocsPageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        trailing={
          orbit ? (
            <Text variant="label" color="muted">
              Orbit · {orbit}
            </Text>
          ) : phase ? (
            <Text variant="label" color="muted">
              Phase {phase}
            </Text>
          ) : null
        }
      />
      <DocsSection title="Example" description="Live preview · registry entry (TSX, not MDX).">
        <DocsExample code={snippet} align="stretch">
          <PreviewChromeProvider chrome={false}>
            <Preview />
          </PreviewChromeProvider>
        </DocsExample>
      </DocsSection>
    </Box>
  );
}

export function DocsEntry({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  if (active === "overview" || active === "overview-card") {
    return <OrbitOverviewPage onSelect={onSelect} />;
  }

  if (active === "handbook") {
    return <HandbookIntroPage />;
  }
  if (active === "principles") {
    return <HandbookPrinciplesPage />;
  }
  if (active === "product-design") {
    return <HandbookProductDesignPage />;
  }
  if (active === "visual-design") {
    return <HandbookVisualDesignPage />;
  }
  if (active === "voice-tone") {
    return <HandbookVoiceTonePage />;
  }
  if (active === "llm-contract") {
    return <HandbookLlmContractPage />;
  }
  if (active === "recipes") {
    return <RecipesPage />;
  }

  if (
    active === "brand" ||
    active === "brand-tokens" ||
    active === "brand-assets"
  ) {
    return (
      <SectionEntry
        id={active}
        eyebrow="Brand"
        title="Brand identity"
        description="Vision, token craft, marks — Orbit surfaces underneath."
      >
        <BrandSection />
      </SectionEntry>
    );
  }

  if (active === "tokens" || active === "space-radius") {
    return (
      <SectionEntry
        id={active}
        eyebrow="Foundations"
        title={active === "space-radius" ? "Spacing & radius" : "Colors"}
        description="Semantic Orbit tokens via light-dark(). Product utility aliases map to the same CSS variables."
      >
        <TokensSection />
      </SectionEntry>
    );
  }

  if (active === "typography") {
    return (
      <SectionEntry
        id={active}
        eyebrow="Foundations"
        title="Typography"
        description="Inter + Geist Mono. Prefer Text variants — never invent a type size."
      >
        <TypographySection />
      </SectionEntry>
    );
  }

  if (active === "libraries") {
    return (
      <SectionEntry
        id={active}
        eyebrow="Foundations"
        title="Icons & libraries"
        description="Phosphor, Radix, Vaul, Sonner, cmdk — Orbit owns layout and color."
      >
        <LibrariesSection />
      </SectionEntry>
    );
  }

  if (active === "motion") {
    return (
      <SectionEntry
        id={active}
        eyebrow="Foundations"
        title="Motion"
        description="Physics, not play. Duration and ease tokens — decelerate enter, accelerate exit."
      >
        <MotionSection />
      </SectionEntry>
    );
  }

  if (active === "states") {
    return (
      <SectionEntry id={active} eyebrow="Lab" title="State matrix">
        <StatesSection />
      </SectionEntry>
    );
  }

  if (active === "alerts-patterns") {
    return (
      <SectionEntry id={active} eyebrow="Lab" title="Alerts">
        <AlertsSection />
      </SectionEntry>
    );
  }

  if (active === "shell") {
    return (
      <SectionEntry
        id={active}
        eyebrow="Lab"
        title="App shell"
        description="Wireframe only — full shell recraft is Phase 6."
      >
        <ShellSection />
      </SectionEntry>
    );
  }

  if (active === "a11y") {
    return (
      <SectionEntry id={active} eyebrow="Quality" title="Accessibility">
        <A11ySection />
      </SectionEntry>
    );
  }

  if (active === "product-docs") {
    return (
      <SectionEntry id={active} eyebrow="Quality" title="Design docs">
        <ProductDocsSection />
      </SectionEntry>
    );
  }

  if (active === "primitives") {
    return (
      <>
        <DocsPageHeader
          eyebrow="UI"
          title="UI primitives"
          description="Epure `@/components/ui` wrappers. Pick a module in the sidebar for its Example page."
        />
        <DocsSection>
          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fill, minmax(160px, 1fr))"
            gap="s"
            width="100%"
          >
            {DESIGN_KIT_UI_MODULES.map((mod) => (
              <CatalogLinkCard
                key={mod}
                id={mod}
                title={mod}
                description={DESIGN_KIT_UI_META[mod].orbit ?? "ui"}
                onSelect={onSelect}
              />
            ))}
          </Box>
        </DocsSection>
      </>
    );
  }

  if (active === "kit") {
    return (
      <>
        <DocsPageHeader
          eyebrow="Kit"
          title="Composite kit"
          description="Phase 4 Orbit chrome. Phase 6 surfaces stay documented but not rewritten here."
        />
        <DocsSection>
          <Box
            display="grid"
            gridTemplateColumns="repeat(auto-fill, minmax(180px, 1fr))"
            gap="s"
            width="100%"
          >
            {DESIGN_KIT_KIT_MODULES.map((mod) => (
              <CatalogLinkCard
                key={mod}
                id={mod}
                title={mod}
                description={
                  DESIGN_KIT_KIT_META[mod].phase
                    ? `Phase ${DESIGN_KIT_KIT_META[mod].phase}`
                    : "kit"
                }
                onSelect={onSelect}
              />
            ))}
          </Box>
        </DocsSection>
      </>
    );
  }

  if (active === "feature-ui") {
    return (
      <>
        <DocsPageHeader
          eyebrow="Feature"
          title="Feature UI"
          description="src/ui modules grouped by domain. Product feeds/shells are Phase 6."
        />
        <DocsSection>
          <Box flexDirection="column" rowGap="m" width="100%">
            {DESIGN_KIT_FEATURE_UI_GROUPS.map((group) => (
              <CatalogLinkCard
                key={group.id}
                id={group.id}
                title={group.label}
                description={group.description}
                onSelect={onSelect}
              />
            ))}
          </Box>
        </DocsSection>
      </>
    );
  }

  if (DESIGN_KIT_UI_MODULES.includes(active as (typeof DESIGN_KIT_UI_MODULES)[number])) {
    const mod = active as (typeof DESIGN_KIT_UI_MODULES)[number];
    const Preview = resolvePreview(uiPreviewModules, mod);
    const meta = DESIGN_KIT_UI_META[mod];
    if (!Preview) {
      return (
        <DocsPageHeader title={mod} description="Missing preview file." />
      );
    }
    return (
      <ModuleExamplePage
        id={mod}
        eyebrow="UI"
        title={mod}
        description={meta.description}
        importPath={meta.importPath}
        orbit={meta.orbit}
        Preview={Preview}
      />
    );
  }

  if (DESIGN_KIT_KIT_MODULES.includes(active as (typeof DESIGN_KIT_KIT_MODULES)[number])) {
    const mod = active as (typeof DESIGN_KIT_KIT_MODULES)[number];
    const Preview = resolvePreview(kitPreviewModules, mod);
    const meta = DESIGN_KIT_KIT_META[mod];
    if (!Preview) {
      return (
        <DocsPageHeader title={mod} description="Missing preview file." />
      );
    }
    return (
      <ModuleExamplePage
        id={mod}
        eyebrow="Kit"
        title={mod}
        description={meta.description}
        importPath={meta.importPath}
        phase={meta.phase}
        Preview={Preview}
      />
    );
  }

  const featureGroup = DESIGN_KIT_FEATURE_UI_GROUPS.find(
    (g) => g.id === active || g.modules.includes(active),
  );
  if (featureGroup) {
    return (
      <SectionEntry
        id={featureGroup.id}
        eyebrow="Feature"
        title={featureGroup.label}
        description={featureGroup.description}
      >
        <FeatureUiGroupPreviews groupId={featureGroup.id} />
      </SectionEntry>
    );
  }

  return (
    <DocsPageHeader
      title={active}
      description="Unknown registry id — pick an entry from the sidebar."
    />
  );
}
