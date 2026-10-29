import * as React from "react";
import { Box } from "@polar-sh/orbit/Box";
import { Text } from "@polar-sh/orbit/Text";
import { Button } from "@/components/ui/button";
import { useThemeMode } from "@/lib/style-theme";
import { isPlaygroundMode } from "@/lib/deployment";
import { Navigate } from "react-router-dom";
import {
  DESIGN_KIT_FOUNDATION_PAGES,
  DESIGN_KIT_KIT_MODULES,
  DESIGN_KIT_PRIMITIVE_MODULES,
  previewStemForPrimitive,
} from "./registry";
import { DesignKitCatalogShell } from "./design-kit-catalog-shell";
import { DesignKitSearch, useDesignKitSearchHotkey } from "./design-kit-search";
import {
  CanvasArtboard,
  DesignKitCanvas,
  type DesignKitCanvasApi,
} from "./design-kit-canvas";
import { DocsEntry } from "./docs-entry";
import {
  ColorsPage,
  IconsPage,
  MotionFoundationPage,
  RadiusPage,
  ShadowsPage,
  SpacingPage,
  TypographyFoundationPage,
} from "./sections/foundations-pages";
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

const WIDE_TILES = new Set([
  "table",
  "data-table",
  "page",
  "command-bar",
  "filter",
  "chart",
  "code",
  "issue-row",
  "issue-detail",
  "empty",
]);

function CatalogStats() {
  return (
    <dl className="mt-3 grid grid-cols-3 gap-2">
      {[
        { label: "Foundations", value: DESIGN_KIT_FOUNDATION_PAGES.length },
        { label: "Primitives", value: DESIGN_KIT_PRIMITIVE_MODULES.length },
        { label: "Kit", value: DESIGN_KIT_KIT_MODULES.length },
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
 * Docs mode: Orbit-style registry (Foundations · Primitives · Kit).
 * Canvas remains optional via Docs|Canvas toggle or `?view=canvas`.
 */
export function DesignKitPage() {
  const playground = isPlaygroundMode();
  const [themeMode, toggleTheme] = useThemeMode();
  const [view, setView] = React.useState<ViewMode>(readInitialView);
  const [navFocus, setNavFocus] = React.useState("foundations");
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
            onClick={() => focus("foundations")}
          >
            Foundations
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
                <DistrictPin id="foundations" label="01 Foundations" />
                <CanvasArtboard
                  id="foundations-card"
                  title="Foundations"
                  subtitle="Principles · brand · LLM contract"
                  className="col-span-3"
                >
                  <CatalogStats />
                  <Text as="span" variant="caption" color="muted">
                    Prefer Docs mode for Orbit-style pages.
                  </Text>
                </CanvasArtboard>
                <CanvasArtboard id="colors" title="Colors" className="col-span-2">
                  <ColorsPage />
                </CanvasArtboard>
                <CanvasArtboard id="spacing" title="Spacing" className="col-span-2">
                  <SpacingPage />
                </CanvasArtboard>
                <CanvasArtboard id="radius" title="Radius" className="col-span-2">
                  <RadiusPage />
                </CanvasArtboard>
                <CanvasArtboard id="shadows" title="Shadows" className="col-span-2">
                  <ShadowsPage />
                </CanvasArtboard>
                <CanvasArtboard id="motion" title="Motion" className="col-span-3">
                  <MotionFoundationPage />
                </CanvasArtboard>
                <CanvasArtboard id="typography" title="Typography" className="col-span-2">
                  <TypographyFoundationPage />
                </CanvasArtboard>
                <CanvasArtboard id="icons" title="Icons" className="col-span-2">
                  <IconsPage />
                </CanvasArtboard>

                <DistrictPin id="primitives" label="02 Primitives" />
                {DESIGN_KIT_PRIMITIVE_MODULES.map((mod) => {
                  const Preview = resolvePreview(
                    uiPreviewModules,
                    previewStemForPrimitive(mod),
                  );
                  if (!Preview) return null;
                  return (
                    <CanvasArtboard
                      key={mod}
                      id={mod}
                      title={mod}
                      subtitle="primitive"
                      className={cn(WIDE_TILES.has(mod) ? "col-span-3" : "col-span-2")}
                    >
                      <Preview />
                    </CanvasArtboard>
                  );
                })}

                <DistrictPin id="kit" label="03 Kit" />
                {DESIGN_KIT_KIT_MODULES.map((mod) => {
                  const Preview = resolvePreview(kitPreviewModules, mod);
                  if (!Preview) return null;
                  return (
                    <CanvasArtboard
                      key={mod}
                      id={mod}
                      title={mod}
                      subtitle="kit family"
                      className={cn(WIDE_TILES.has(mod) ? "col-span-3" : "col-span-2")}
                    >
                      <Preview />
                    </CanvasArtboard>
                  );
                })}
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
