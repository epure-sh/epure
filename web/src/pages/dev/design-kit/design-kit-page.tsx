import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { Button } from "@/components/ui/button";
import { useThemeMode } from "@/lib/style-theme";
import { isPlaygroundMode } from "@/lib/deployment";
import { Navigate } from "react-router-dom";
import {
  DESIGN_KIT_KIT_MODULES,
  DESIGN_KIT_UI_MODULES,
} from "./registry";
import {
  DESIGN_KIT_FEATURE_UI_FACADES,
  DESIGN_KIT_FEATURE_UI_GROUPS,
  DESIGN_KIT_FEATURE_UI_MODULES,
} from "./feature-ui-registry";
import { DesignKitCatalogShell } from "./design-kit-catalog-shell";
import { DesignKitSearch, useDesignKitSearchHotkey } from "./design-kit-search";
import {
  CanvasArtboard,
  DesignKitCanvas,
  type DesignKitCanvasApi,
} from "./design-kit-canvas";
import { DocsEntry } from "./docs-entry";
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
import { PreviewChromeProvider } from "./preview-chrome";
import { cn } from "@/lib/utils";

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

/** Wider tiles for denser tables / shells. */
const WIDE_TILES = new Set([
  "table",
  "data-table",
  "page-shell",
  "command-bar",
  "filter-bar",
  "telemetry-chart",
  "code-frame",
  "issue-row-shell",
  "empty-state",
]);

function CatalogStats() {
  const total =
    DESIGN_KIT_UI_MODULES.length +
    DESIGN_KIT_KIT_MODULES.length +
    DESIGN_KIT_FEATURE_UI_MODULES.length +
    DESIGN_KIT_FEATURE_UI_FACADES.length;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2">
      {[
        { label: "UI", value: DESIGN_KIT_UI_MODULES.length },
        { label: "Kit", value: DESIGN_KIT_KIT_MODULES.length },
        { label: "Feature", value: DESIGN_KIT_FEATURE_UI_MODULES.length },
        { label: "Indexed", value: total },
      ].map((row) => (
        <div
          key={row.label}
          className="rounded-control border border-border-subtle bg-surface-2/40 px-2.5 py-2"
        >
          <dt className="text-[10px] uppercase tracking-wide text-fg-muted">{row.label}</dt>
          <dd className="font-mono text-lg font-semibold tabular-nums text-fg-primary">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function DistrictPin({ id, label }: { id: string; label: string }) {
  return (
    <div
      id={id}
      data-design-kit-artboard={id}
      className="col-span-1 flex min-h-[72px] items-end"
    >
      <span className="rounded-control border border-accent/30 bg-accent-muted/40 px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-fg-primary uppercase">
        {label}
      </span>
    </div>
  );
}

type ViewMode = "docs" | "canvas";

function readInitialView(): ViewMode {
  if (typeof window === "undefined") return "docs";
  return new URLSearchParams(window.location.search).get("view") === "canvas"
    ? "canvas"
    : "docs";
}

/**
 * Phase 5 default: Orbit-style registry docs (PageHeader / Section / Example).
 * Canvas board remains optional via Docs|Canvas toggle or `?view=canvas`.
 */
export function DesignKitPage() {
  const playground = isPlaygroundMode();
  const [themeMode, toggleTheme] = useThemeMode();
  const [view, setView] = React.useState<ViewMode>(readInitialView);
  const [navFocus, setNavFocus] = React.useState("overview");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const canvasRef = React.useRef<DesignKitCanvasApi>(null);
  const docsScrollRef = React.useRef<HTMLDivElement>(null);

  const syncViewParam = React.useCallback((next: ViewMode) => {
    setView(next);
    if (typeof history === "undefined") return;
    const url = new URL(window.location.href);
    if (next === "canvas") url.searchParams.set("view", "canvas");
    else url.searchParams.delete("view");
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  const focus = React.useCallback(
    (id: string) => {
      setNavFocus(id);
      if (typeof history !== "undefined") {
        const url = new URL(window.location.href);
        url.hash = id;
        history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
      if (view === "canvas") {
        canvasRef.current?.focus(id);
      } else {
        docsScrollRef.current?.scrollTo({ top: 0 });
      }
    },
    [view],
  );

  const openSearch = React.useCallback(() => setSearchOpen(true), []);
  useDesignKitSearchHotkey(openSearch);

  React.useEffect(() => {
    if (!playground) return;
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (!hash) return;
      focus(hash);
    };
    const t = window.setTimeout(applyHash, 120);
    window.addEventListener("hashchange", applyHash);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("hashchange", applyHash);
    };
  }, [playground, focus]);

  if (!playground) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-canvas text-fg-primary">
      <header className="relative z-30 flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-surface-1/90 px-3 backdrop-blur-sm md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold tracking-tight text-fg-primary">
            Orbit
          </span>
          <span className="hidden font-mono text-[10px] text-fg-muted sm:inline">
            Epure design system · /__design · {view === "docs" ? "docs" : "canvas"}
          </span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <div className="flex rounded-control border border-border-subtle p-0.5">
            <Button
              type="button"
              variant={view === "docs" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => syncViewParam("docs")}
            >
              Docs
            </Button>
            <Button
              type="button"
              variant={view === "canvas" ? "secondary" : "ghost"}
              size="xs"
              onClick={() => syncViewParam("canvas")}
            >
              Canvas
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="hidden sm:inline-flex"
            onClick={() => setSearchOpen(true)}
          >
            Search
            <kbd className="ml-1.5 font-mono text-[10px] text-fg-muted">⌘K</kbd>
          </Button>
          <Button variant="outline" size="xs" onClick={toggleTheme}>
            {themeMode === "dark" ? "Light" : "Dark"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => focus("recipes")}
          >
            Recipes
          </Button>
          {view === "canvas" ? (
            <Button variant="ghost" size="xs" onClick={() => canvasRef.current?.fit()}>
              Fit board
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <DesignKitCatalogShell
          active={navFocus}
          onSelect={focus}
          onOpenSearch={() => setSearchOpen(true)}
        />

        {view === "docs" ? (
          <div
            ref={docsScrollRef}
            className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-canvas"
          >
            <Box
              flexDirection="column"
              width="100%"
              maxWidth={840}
              marginHorizontal="auto"
              paddingHorizontal="xl"
              paddingVertical="2xl"
            >
              <DocsEntry active={navFocus} onSelect={focus} />
            </Box>
          </div>
        ) : (
          <DesignKitCanvas ref={canvasRef} onActiveChange={setNavFocus}>
            <PreviewChromeProvider chrome>
              <div className="grid w-[5600px] grid-cols-10 items-start gap-5">
                <DistrictPin id="overview" label="01 Start" />
                <CanvasArtboard
                  id="overview-card"
                  title="Overview"
                  subtitle="Registry · optional canvas"
                  className="col-span-2"
                >
                  <h1 className="text-base font-semibold tracking-tight text-fg-primary">
                    Design canvas
                  </h1>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-fg-muted">
                    Optional board view. Default IA is Docs (registry + Example pages).
                  </p>
                  <CatalogStats />
                  <Text as="span" variant="caption" color="muted">
                    Switch to Docs for Orbit-style pages.
                  </Text>
                </CanvasArtboard>

                <DistrictPin id="brand" label="02 Brand" />
                <CanvasArtboard
                  title="Brand identity"
                  subtitle="Vision · tokens · marks"
                  className="col-span-3"
                >
                  <BrandSection />
                </CanvasArtboard>

                <DistrictPin id="tokens" label="03 Foundations" />
                <CanvasArtboard title="Color & surfaces" className="col-span-2">
                  <TokensSection />
                </CanvasArtboard>
                <CanvasArtboard id="typography" title="Typography" className="col-span-2">
                  <TypographySection />
                </CanvasArtboard>
                <CanvasArtboard id="libraries" title="Library stack" className="col-span-2">
                  <LibrariesSection />
                </CanvasArtboard>

                <DistrictPin id="motion" label="04 Lab" />
                <CanvasArtboard title="Motion lab" className="col-span-3">
                  <MotionSection />
                </CanvasArtboard>
                <CanvasArtboard
                  id="states"
                  title="State matrix"
                  subtitle="Idle · active · busy · error"
                  className="col-span-3"
                >
                  <StatesSection />
                </CanvasArtboard>
                <CanvasArtboard
                  id="alerts-patterns"
                  title="Alerts"
                  subtitle="Mock history · configure"
                  className="col-span-3"
                >
                  <AlertsSection />
                </CanvasArtboard>

                <DistrictPin id="primitives" label="05 UI" />
                {DESIGN_KIT_UI_MODULES.map((mod) => {
                  const Preview = resolvePreview(uiPreviewModules, mod);
                  if (!Preview) return null;
                  return (
                    <CanvasArtboard
                      key={mod}
                      id={mod}
                      title={mod}
                      subtitle="@/components/ui"
                      className={cn(WIDE_TILES.has(mod) ? "col-span-3" : "col-span-2")}
                    >
                      <Preview />
                    </CanvasArtboard>
                  );
                })}

                <DistrictPin id="kit" label="06 Kit" />
                {DESIGN_KIT_KIT_MODULES.map((mod) => {
                  const Preview = resolvePreview(kitPreviewModules, mod);
                  if (!Preview) return null;
                  return (
                    <CanvasArtboard
                      key={mod}
                      id={mod}
                      title={mod}
                      subtitle="@/components/kit · mock / empty"
                      className={cn(WIDE_TILES.has(mod) ? "col-span-3" : "col-span-2")}
                    >
                      <Preview />
                    </CanvasArtboard>
                  );
                })}

                <DistrictPin id="feature-ui" label="07 Feature" />
                {DESIGN_KIT_FEATURE_UI_GROUPS.map((group) => (
                  <CanvasArtboard
                    key={group.id}
                    id={group.id}
                    title={group.label}
                    subtitle={group.description}
                    className="col-span-3"
                  >
                    <FeatureUiGroupPreviews groupId={group.id} />
                  </CanvasArtboard>
                ))}

                <DistrictPin id="a11y" label="08 Quality" />
                <CanvasArtboard id="shell" title="App shell" className="col-span-3">
                  <ShellSection />
                </CanvasArtboard>
                <CanvasArtboard title="Accessibility" className="col-span-2">
                  <A11ySection />
                </CanvasArtboard>
                <CanvasArtboard id="product-docs" title="Design docs" className="col-span-2">
                  <ProductDocsSection />
                </CanvasArtboard>
              </div>
            </PreviewChromeProvider>
          </DesignKitCanvas>
        )}
      </div>

      <DesignKitSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={focus}
      />
    </div>
  );
}

export default DesignKitPage;
