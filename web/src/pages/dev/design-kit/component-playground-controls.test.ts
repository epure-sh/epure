import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ComponentPlaygroundControls,
  useComponentPlayground,
  useInteractiveButtonPlayground,
  useCardPlayground,
  useBannerPlayground,
  useBadgePlayground,
  useInputPlayground,
  useEmptyStatePlayground,
} from "./component-playground-controls";

const here = path.dirname(fileURLToPath(import.meta.url));

test("ComponentPlaygroundControls static contracts and exports", () => {
  const src = readFileSync(
    path.join(here, "component-playground-controls.tsx"),
    "utf8",
  );
  assert.match(src, /export function ComponentPlaygroundControls/);
  assert.match(src, /showDepressionProbe/);
  assert.match(src, /useComponentPlayground/);
  assert.match(src, /useInteractiveButtonPlayground/);
  assert.match(src, /useCardPlayground/);
  assert.match(src, /useBannerPlayground/);
  assert.match(src, /useBadgePlayground/);
  assert.match(src, /useInputPlayground/);
  assert.match(src, /useEmptyStatePlayground/);
  assert.match(src, /role="toolbar"/);
  assert.match(src, /aria-label="Component playground controls"/);
  assert.match(src, /PRESSED · scale\(0\.970\)/);
  assert.match(src, /IDLE · scale\(1\.000\)/);
  assert.match(src, /100ms cubic-bezier\(0\.16, 1, 0\.3, 1\)/);
});

test("ComponentPlaygroundControls renders toolbar, 5 dimensions, and tactile depression probe", () => {
  function TestHarness() {
    const playground = useComponentPlayground({
      variants: [
        { value: "primary" },
        { value: "secondary" },
        { value: "destructive" },
        { value: "ghost" },
        { value: "outline" },
        { value: "subtle" },
        { value: "elevated" },
      ],
      sizes: [
        { value: "xs" },
        { value: "sm" },
        { value: "md" },
        { value: "lg" },
        { value: "xl" },
        { value: "compact" },
        { value: "airy" },
      ],
      tones: [
        { value: "neutral" },
        { value: "info" },
        { value: "success" },
        { value: "warning" },
        { value: "danger" },
      ],
      effects: [
        { value: "specular", label: "specular rim" },
        { value: "tactile" },
        { value: "glow" },
      ],
      initialSkeleton: false,
      showDepressionProbe: true,
    });

    return React.createElement(ComponentPlaygroundControls, {
      axes: playground.axes,
      flags: playground.flags,
      showDepressionProbe: playground.showDepressionProbe,
    });
  }

  const html = renderToStaticMarkup(React.createElement(TestHarness));

  // Toolbar semantics
  assert.match(html, /role="toolbar"/);
  assert.match(html, /aria-label="Component playground controls"/);

  // Variant dimension
  assert.match(html, /Variant/);
  assert.match(html, /primary/);
  assert.match(html, /destructive/);
  assert.match(html, /elevated/);

  // Size dimension
  assert.match(html, /Size/);
  assert.match(html, /compact/);
  assert.match(html, /airy/);

  // Tone dimension
  assert.match(html, /Tone/);
  assert.match(html, /neutral/);
  assert.match(html, /warning/);
  assert.match(html, /danger/);

  // Effect dimension
  assert.match(html, /Effect/);
  assert.match(html, /specular rim/);
  assert.match(html, /glow/);

  // State flags (loading, disabled, error, skeleton)
  assert.match(html, /Loading/);
  assert.match(html, /Disabled/);
  assert.match(html, /Error/);
  assert.match(html, /Skeleton/);
  assert.match(html, /role="switch"/);

  // Tactile depression probe
  assert.match(html, /Tactile Depression Probe/);
  assert.match(html, /IDLE · scale\(1\.000\)/);
  assert.match(html, /Press me · active:scale\(0\.97\)/);
  assert.match(html, /Damped: 100ms cubic-bezier\(0\.16, 1, 0\.3, 1\)/);
});

test("Card playground preset hook covers variants, sizes, effects, and probe", () => {
  let captured: any = null;
  function CardHarness() {
    captured = useCardPlayground();
    return React.createElement(ComponentPlaygroundControls, {
      axes: captured.axes,
      flags: captured.flags,
      showDepressionProbe: captured.showDepressionProbe,
    });
  }

  const html = renderToStaticMarkup(React.createElement(CardHarness));
  assert.ok(captured);
  assert.equal(captured.variant, "default");
  assert.equal(captured.size, "m");
  assert.equal(captured.effect, "specular");
  assert.equal(captured.showDepressionProbe, true);
  assert.match(html, /specular rim/);
  assert.match(html, /compact/);
  assert.match(html, /airy/);
});

test("Banner playground preset hook covers tones, variants, and states", () => {
  let captured: any = null;
  function BannerHarness() {
    captured = useBannerPlayground();
    return React.createElement(ComponentPlaygroundControls, {
      axes: captured.axes,
      flags: captured.flags,
    });
  }

  const html = renderToStaticMarkup(React.createElement(BannerHarness));
  assert.ok(captured);
  assert.equal(captured.variant, "strip");
  assert.equal(captured.tone, "warning");
  assert.match(html, /regression/);
  assert.match(html, /escalating/);
  assert.match(html, /callout/);
});

test("Badge, Input, and EmptyState preset hooks instantiate cleanly", () => {
  function BadgeHarness() {
    const badge = useBadgePlayground();
    return React.createElement(ComponentPlaygroundControls, {
      axes: badge.axes,
      flags: badge.flags,
    });
  }
  const badgeHtml = renderToStaticMarkup(React.createElement(BadgeHarness));
  assert.match(badgeHtml, /escalating/);
  assert.match(badgeHtml, /compact/);

  function InputHarness() {
    const input = useInputPlayground();
    return React.createElement(ComponentPlaygroundControls, {
      axes: input.axes,
      flags: input.flags,
    });
  }
  const inputHtml = renderToStaticMarkup(React.createElement(InputHarness));
  assert.match(inputHtml, />sm</);
  assert.match(inputHtml, />md</);
  assert.match(inputHtml, />lg</);

  function EmptyHarness() {
    const empty = useEmptyStatePlayground();
    return React.createElement(ComponentPlaygroundControls, {
      axes: empty.axes,
      flags: empty.flags,
    });
  }
  const emptyHtml = renderToStaticMarkup(React.createElement(EmptyHarness));
  assert.match(emptyHtml, /Quiet Empty/);
  assert.match(emptyHtml, /Error State/);
});

test("Backwards-compatible useInteractiveButtonPlayground hook", () => {
  let captured: any = null;
  function ButtonHarness() {
    captured = useInteractiveButtonPlayground({ variant: "outline", size: "lg" });
    return React.createElement(ComponentPlaygroundControls, {
      axes: captured.axes,
      flags: captured.flags,
      showDepressionProbe: true,
    });
  }

  const html = renderToStaticMarkup(React.createElement(ButtonHarness));
  assert.ok(captured);
  assert.equal(captured.variant, "outline");
  assert.equal(captured.size, "lg");
  assert.match(html, /primary/);
  assert.match(html, /danger/);
  assert.match(html, />md</);
});

test("Flagship previews wire ComponentPlaygroundControls", () => {
  const previews = [
    "previews/ui/button.preview.tsx",
    "previews/kit/card.preview.tsx",
    "previews/kit/banner.preview.tsx",
    "previews/ui/badge.preview.tsx",
    "previews/ui/input.preview.tsx",
    "previews/kit/empty.preview.tsx",
    "previews/kit/action-button.preview.tsx",
  ];

  for (const rel of previews) {
    const content = readFileSync(path.join(here, rel), "utf8");
    assert.match(
      content,
      /ComponentPlaygroundControls/,
      `Expected ${rel} to import and use ComponentPlaygroundControls`,
    );
  }
});
