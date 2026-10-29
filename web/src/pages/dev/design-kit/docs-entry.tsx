import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import {
  DESIGN_KIT_KIT_META,
  DESIGN_KIT_KIT_MODULES,
  DESIGN_KIT_PRIMITIVE_META,
  DESIGN_KIT_PRIMITIVE_MODULES,
  previewStemForPrimitive,
  type DesignKitKitModule,
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

  if (DESIGN_KIT_KIT_MODULES.includes(active as DesignKitKitModule)) {
    const mod = active as DesignKitKitModule;
    const Preview = resolvePreview(kitPreviewModules, mod);
    const meta = DESIGN_KIT_KIT_META[mod];
    if (!Preview) {
      return <DocsPageHeader title={mod} description="Missing preview file." />;
    }
    return (
      <ModuleExamplePage
        id={mod}
        eyebrow="Kit"
        title={mod}
        description={meta.description}
        importPath={meta.importPath}
        absorbs={meta.absorbs}
        Preview={Preview}
      />
    );
  }

  // Legacy hash redirects for retired kit leaves → canonical family
  const kitRedirect = Object.entries(DESIGN_KIT_KIT_META).find(([, meta]) =>
    meta.absorbs?.includes(active),
  );
  if (kitRedirect) {
    const [mod] = kitRedirect;
    const Preview = resolvePreview(kitPreviewModules, mod);
    const meta = DESIGN_KIT_KIT_META[mod as DesignKitKitModule];
    if (Preview) {
      return (
        <ModuleExamplePage
          id={mod}
          eyebrow="Kit"
          title={mod}
          description={meta.description}
          importPath={meta.importPath}
          absorbs={meta.absorbs}
          Preview={Preview}
        />
      );
    }
  }

  // Retired primitives
  if (active === "badge") {
    return (
      <DocsEntry active="pill" onSelect={_onSelect} />
    );
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
