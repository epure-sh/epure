import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import {
  DESIGN_KIT_BLOCK_META,
  DESIGN_KIT_BLOCK_MODULES,
  DESIGN_KIT_COMPONENT_META,
  DESIGN_KIT_COMPONENT_MODULES,
  DESIGN_KIT_PRIMITIVE_META,
  DESIGN_KIT_PRIMITIVE_MODULES,
  previewStemForBlock,
  previewStemForComponent,
  previewStemForPrimitive,
  type DesignKitBlockModule,
  type DesignKitComponentModule,
  type DesignKitPrimitiveModule,
} from "./registry";
import { DocsExample, DocsPageHeader, DocsSection } from "./docs";
import { PreviewChromeProvider } from "./preview-chrome";
import {
  ColorsPage,
  FoundationsIntroPage,
  IconsPage,
  MotionFoundationPage,
  RadiusPage,
  ShadowsPage,
  SpacingPage,
  TypographyFoundationPage,
} from "./sections/foundations-pages";

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

function ModuleExamplePage({
  id,
  eyebrow,
  title,
  description,
  importPath,
  orbit,
  absorbs,
  Preview,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  importPath: string;
  orbit?: string;
  absorbs?: readonly string[];
  Preview: React.ComponentType;
}) {
  const snippet = `import { … } from "${importPath}"${
    orbit ? `\n// Maps to Orbit ${orbit}` : ""
  }${absorbs?.length ? `\n// Absorbs: ${absorbs.join(", ")}` : ""}`;

  return (
    <Box id={id} flexDirection="column" width="100%">
      <DocsPageHeader
        title={title}
        description={description}
        trailing={
          orbit ? (
            <Text variant="label" color="muted">
              Orbit · {orbit}
            </Text>
          ) : (
            <Text variant="label" color="muted">
              {eyebrow}
            </Text>
          )
        }
      />
      <DocsSection
        title="Variants"
        description="Every axis this component owns — live preview, then source."
      >
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
  onSelect: _onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  if (
    active === "foundations" ||
    active === "overview" ||
    active === "overview-card" ||
    active === "handbook" ||
    active === "principles" ||
    active === "product-design" ||
    active === "visual-design" ||
    active === "voice-tone" ||
    active === "llm-contract" ||
    active === "brand" ||
    active === "brand-tokens" ||
    active === "brand-assets" ||
    active === "recipes"
  ) {
    return <FoundationsIntroPage />;
  }

  if (active === "colors" || active === "tokens") {
    return <ColorsPage />;
  }
  if (active === "spacing" || active === "space-radius") {
    return <SpacingPage />;
  }
  if (active === "radius") {
    return <RadiusPage />;
  }
  if (active === "shadows") {
    return <ShadowsPage />;
  }
  if (active === "motion") {
    return <MotionFoundationPage />;
  }
  if (active === "typography") {
    return <TypographyFoundationPage />;
  }
  if (active === "icons" || active === "libraries") {
    return <IconsPage />;
  }

  if (
    DESIGN_KIT_PRIMITIVE_MODULES.includes(active as DesignKitPrimitiveModule)
  ) {
    const mod = active as DesignKitPrimitiveModule;
    const stem = previewStemForPrimitive(mod);
    const Preview = resolvePreview(uiPreviewModules, stem);
    const meta = DESIGN_KIT_PRIMITIVE_META[mod];
    if (!Preview) {
      return <DocsPageHeader title={mod} description="Missing preview file." />;
    }
    return (
      <ModuleExamplePage
        id={mod}
        eyebrow="Primitive"
        title={mod}
        description={meta.description}
        importPath={meta.importPath}
        orbit={meta.orbit}
        Preview={Preview}
      />
    );
  }

  if (
    DESIGN_KIT_COMPONENT_MODULES.includes(active as DesignKitComponentModule)
  ) {
    const mod = active as DesignKitComponentModule;
    const stem = previewStemForComponent(mod);
    const Preview = resolvePreview(kitPreviewModules, stem);
    const meta = DESIGN_KIT_COMPONENT_META[mod];
    if (!Preview) {
      return <DocsPageHeader title={mod} description="Missing preview file." />;
    }
    return (
      <ModuleExamplePage
        id={mod}
        eyebrow="Component"
        title={mod}
        description={meta.description}
        importPath={meta.importPath}
        absorbs={meta.absorbs}
        Preview={Preview}
      />
    );
  }

  if (DESIGN_KIT_BLOCK_MODULES.includes(active as DesignKitBlockModule)) {
    const mod = active as DesignKitBlockModule;
    const stem = previewStemForBlock(mod);
    const Preview = resolvePreview(kitPreviewModules, stem);
    const meta = DESIGN_KIT_BLOCK_META[mod];
    if (!Preview) {
      return <DocsPageHeader title={mod} description="Missing preview file." />;
    }
    return (
      <ModuleExamplePage
        id={mod}
        eyebrow="Block"
        title={mod}
        description={meta.description}
        importPath={meta.importPath}
        absorbs={meta.absorbs}
        Preview={Preview}
      />
    );
  }

  // Legacy hash redirects for absorbed leaves → canonical family
  const componentRedirect = Object.entries(DESIGN_KIT_COMPONENT_META).find(
    ([, meta]) => meta.absorbs?.includes(active),
  );
  if (componentRedirect) {
    const [mod] = componentRedirect;
    return <DocsEntry active={mod} onSelect={_onSelect} />;
  }

  const blockRedirect = Object.entries(DESIGN_KIT_BLOCK_META).find(([, meta]) =>
    meta.absorbs?.includes(active),
  );
  if (blockRedirect) {
    const [mod] = blockRedirect;
    return <DocsEntry active={mod} onSelect={_onSelect} />;
  }

  // Retired primitives
  if (active === "badge") {
    return <DocsEntry active="pill" onSelect={_onSelect} />;
  }
  if (active === "dialog") {
    return <DocsEntry active="modal" onSelect={_onSelect} />;
  }
  if (active === "sonner" || active === "toast") {
    return <DocsEntry active="banner" onSelect={_onSelect} />;
  }
  if (active === "toggle-group") {
    return <DocsEntry active="segmented-control" onSelect={_onSelect} />;
  }
  if (active === "icon") {
    return <IconsPage />;
  }

  return (
    <DocsPageHeader
      title={active}
      description="Unknown registry id — pick an entry from the sidebar."
    />
  );
}
