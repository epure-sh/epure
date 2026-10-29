import { PreviewBlock, PreviewRow } from "../shared";

const orbitSwatches = [
  { token: "--bg / bg-bg", className: "bg-bg" },
  { token: "--bg-subtle", className: "bg-bg-subtle" },
  { token: "--surface", className: "bg-surface" },
  { token: "--surface-inset", className: "bg-surface-inset" },
  { token: "--accent", className: "bg-accent" },
  { token: "--accent-muted", className: "bg-accent-muted" },
  { token: "--signal", className: "bg-signal" },
  { token: "--semantic-success", className: "bg-semantic-success" },
  { token: "--semantic-warning", className: "bg-semantic-warning" },
  { token: "--semantic-danger", className: "bg-semantic-danger" },
  { token: "--semantic-info", className: "bg-semantic-info" },
] as const;

const bridgeSwatches = [
  { token: "canvas", className: "bg-canvas" },
  { token: "surface-1", className: "bg-surface-1" },
  { token: "surface-2", className: "bg-surface-2" },
  { token: "surface-3", className: "bg-surface-3" },
  { token: "fg-primary", className: "bg-fg-primary" },
  { token: "fg-secondary", className: "bg-fg-secondary" },
  { token: "fg-muted", className: "bg-fg-muted" },
  { token: "escalating", className: "bg-escalating" },
  { token: "regression", className: "bg-regression" },
  { token: "healthy", className: "bg-healthy" },
  { token: "info", className: "bg-info" },
] as const;

/** Mirrors --space-1…8 from design/tokens.css (Tailwind size utilities). */
const SPACE_STEPS = [
  { n: 1, box: "size-1" },
  { n: 2, box: "size-2" },
  { n: 3, box: "size-3" },
  { n: 4, box: "size-4" },
  { n: 5, box: "size-5" },
  { n: 6, box: "size-6" },
  { n: 7, box: "size-8" },
  { n: 8, box: "size-12" },
] as const;

function SwatchGrid({
  items,
}: {
  items: readonly { token: string; className: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.token} className="space-y-1">
          <div
            className={`h-10 rounded-control border border-border-subtle ${item.className}`}
          />
          <p className="font-mono text-[10px] text-fg-muted">{item.token}</p>
        </div>
      ))}
    </div>
  );
}

export function TokensSection() {
  return (
    <div className="space-y-4">
      <header className="space-y-1 border-b border-border-subtle pb-2">
        <h2 className="text-sm font-semibold text-fg-primary">Foundations — color</h2>
        <p className="max-w-2xl text-xs text-fg-muted">
          Source of truth: <code className="font-mono text-[11px]">design/themes/orbit.css</code>{" "}
          + Polar ramps in <code className="font-mono text-[11px]">src/styles/tokens.css</code>{" "}
          <code className="font-mono text-[11px]">@theme</code>. Product utility aliases (fg-*,
          badge-*) map to Orbit surfaces until Phase 4–6.
        </p>
      </header>

      <PreviewBlock
        id="tokens-orbit"
        title="Orbit surface tokens"
        description="White/polar canvas, indigo accent, semantic emerald/amber/red."
      >
        <SwatchGrid items={orbitSwatches} />
      </PreviewBlock>

      <PreviewBlock
        id="tokens-bridge"
        title="Product utility aliases (fg-*, surface-*)"
        description="Kit / remaining ui classNames — same Orbit CSS variables, Epure Tailwind names."
      >
        <SwatchGrid items={bridgeSwatches} />
      </PreviewBlock>

      <div id="space-radius" className="scroll-mt-24 space-y-4">
        <PreviewBlock
          id="tokens-space"
          title="Space scale"
          description="--space-1 … --space-8 from design/tokens.css."
        >
          <div className="flex flex-wrap items-end gap-3">
            {SPACE_STEPS.map((step) => (
              <div key={step.n} className="flex flex-col items-center gap-1">
                <div className={`rounded-xs bg-accent/80 ${step.box}`} />
                <p className="font-mono text-[10px] text-fg-muted">{step.n}</p>
              </div>
            ))}
          </div>
        </PreviewBlock>

        <PreviewBlock
          id="tokens-radius-shadow"
          title="Radius & elevation"
          description="Controls use rounded-control. Cards use rounded-panel. Hairlines over drop shadows on chrome."
        >
          <PreviewRow label="Radius samples">
            <div className="flex h-8 w-16 items-center justify-center rounded-xs border border-border-subtle bg-surface-2 text-[10px]">
              xs
            </div>
            <div className="flex h-8 w-16 items-center justify-center rounded-control border border-border-subtle bg-surface-2 text-[10px]">
              control
            </div>
            <div className="flex h-12 w-24 items-center justify-center rounded-panel border border-border-subtle bg-surface-2 text-[10px]">
              panel
            </div>
          </PreviewRow>
          <PreviewRow label="Shadow tokens">
            <div className="h-10 w-28 rounded-control border border-border-subtle bg-surface-1 shadow-tactile" />
            <div className="h-10 w-28 rounded-control border border-border-subtle bg-surface-1 shadow-float" />
            <div className="epure-surface-specular h-10 w-28 rounded-panel border border-border bg-surface" />
          </PreviewRow>
        </PreviewBlock>
      </div>
    </div>
  );
}
