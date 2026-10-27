import * as React from "react";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/kit/page-shell";
import { useThemeMode } from "@/lib/style-theme";
import { isPlaygroundMode } from "@/lib/deployment";
import { Navigate } from "react-router-dom";
import {
  DESIGN_KIT_KIT_MODULES,
  DESIGN_KIT_UI_MODULES,
} from "./registry";
import {
  DESIGN_KIT_FEATURE_UI_FACADES,
  DESIGN_KIT_FEATURE_UI_MODULES,
} from "./feature-ui-registry";
import { DesignKitCatalogShell } from "./design-kit-catalog-shell";
import { TokensSection } from "./sections/tokens-section";
import { TypographySection } from "./sections/typography-section";
import { FeatureUiSection } from "./sections/feature-ui-section";
import { ShellSection } from "./sections/shell-section";
import { MotionSection } from "./sections/motion-section";
import { StatesSection } from "./sections/states-section";
import { ProductDocsSection } from "./sections/product-docs-section";
import { AlertsSection } from "./sections/alerts-section";

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

function CatalogStats() {
  const total =
    DESIGN_KIT_UI_MODULES.length +
    DESIGN_KIT_KIT_MODULES.length +
    DESIGN_KIT_FEATURE_UI_MODULES.length +
    DESIGN_KIT_FEATURE_UI_FACADES.length;
  return (
    <dl className="mt-3 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
      {[
        { label: "UI primitives", value: DESIGN_KIT_UI_MODULES.length },
        { label: "Kit", value: DESIGN_KIT_KIT_MODULES.length },
        { label: "Feature UI", value: DESIGN_KIT_FEATURE_UI_MODULES.length },
        { label: "Total indexed", value: total },
      ].map((row) => (
        <div
          key={row.label}
          className="rounded-control border border-border-subtle bg-surface-2/40 px-2.5 py-2"
        >
          <dt className="text-[10px] uppercase tracking-wide text-fg-muted">{row.label}</dt>
          <dd className="font-mono text-lg font-semibold tabular-nums text-fg-primary">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DesignKitPage() {
  const [themeMode, toggleTheme] = useThemeMode();
  const [navFocus, setNavFocus] = React.useState("overview");

  if (!isPlaygroundMode()) {
    return <Navigate to="/" replace />;
  }

  const scrollTo = (id: string) => {
    setNavFocus(id);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <PageShell
      density="full-bleed"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleTheme}>
            {themeMode === "dark" ? "Light" : "Dark"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => scrollTo("primitives")}>
            Primitives
          </Button>
          <Button variant="ghost" size="sm" onClick={() => scrollTo("feature-ui")}>
            Feature UI
          </Button>
        </div>
      }
    >
      <div className="flex-1 overflow-auto px-4 py-6 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(12rem,14rem)_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
          <DesignKitCatalogShell active={navFocus} onSelect={scrollTo} />

          <div className="min-w-0 space-y-12 pb-20">
            <section id="overview" className="scroll-mt-24 space-y-2">
              <h2 className="text-sm font-semibold text-fg-primary">Overview</h2>
              <p className="max-w-2xl text-xs leading-relaxed text-fg-muted">
                Single inventory for Epure UI. Add{" "}
                <code className="font-mono text-[11px]">src/components/ui/*</code> or{" "}
                <code className="font-mono text-[11px]">kit/*</code> → register in{" "}
                <code className="font-mono text-[11px]">registry.ts</code> +{" "}
                <code className="font-mono text-[11px]">previews/ui|kit</code>. Add{" "}
                <code className="font-mono text-[11px]">src/ui/*</code> →{" "}
                <code className="font-mono text-[11px]">feature-ui-registry.ts</code> + preview in{" "}
                <code className="font-mono text-[11px]">feature-ui-group-previews.tsx</code>.{" "}
                <code className="font-mono text-[11px]">npm test</code> enforces sync.
              </p>
              <CatalogStats />
              <p className="text-xs text-fg-muted">
                Markdown law:{" "}
                <button
                  type="button"
                  className="text-accent underline-offset-2 hover:underline"
                  onClick={() => scrollTo("product-docs")}
                >
                  Design docs
                </button>
              </p>
            </section>

            <ProductDocsSection />
            <TokensSection />
            <TypographySection />

            <section id="primitives" className="scroll-mt-24 space-y-4">
              <header className="border-b border-border-subtle pb-2">
                <h2 className="text-sm font-semibold text-fg-primary">UI primitives</h2>
                <p className="mt-1 text-xs text-fg-muted">
                  Personalized shadcn layer — <code className="font-mono text-[11px]">@/components/ui</code>
                </p>
              </header>
              <div className="space-y-4">
                {DESIGN_KIT_UI_MODULES.map((mod) => {
                  const Preview = resolvePreview(uiPreviewModules, mod);
                  return Preview ? <Preview key={mod} /> : null;
                })}
              </div>
            </section>

            <section id="kit" className="scroll-mt-24 space-y-4">
              <header className="border-b border-border-subtle pb-2">
                <h2 className="text-sm font-semibold text-fg-primary">Composite kit</h2>
                <p className="mt-1 text-xs text-fg-muted">
                  Domain composites — <code className="font-mono text-[11px]">@/components/kit</code>
                </p>
              </header>
              <div className="space-y-4">
                {DESIGN_KIT_KIT_MODULES.map((mod) => {
                  const Preview = resolvePreview(kitPreviewModules, mod);
                  return Preview ? <Preview key={mod} /> : null;
                })}
              </div>
            </section>

            <FeatureUiSection />
            <AlertsSection />
            <ShellSection />
            <MotionSection />
            <StatesSection />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default DesignKitPage;
