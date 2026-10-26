import { PreviewBlock, PreviewRow } from "../shared";

const calmSwatches = [
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

const obsidianSwatches = [
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
    <div id="tokens" className="scroll-mt-24 space-y-4">
      <PreviewBlock
        id="tokens-calm"
        title="Calm Ledger tokens (design/tokens.css + calm-ledger theme)"
        description="Paper canvas, indigo accent, semantic danger/warning/success. Edit design/tokens.css and reload."
      >
        <SwatchGrid items={calmSwatches} />
      </PreviewBlock>

      <PreviewBlock
        id="tokens-obsidian"
        title="Obsidian / Tailwind semantic utilities (src/styles/tokens.css)"
        description="Layer used by @/components/ui primitives — fg-*, surface-*, status colors."
      >
        <SwatchGrid items={obsidianSwatches} />
      </PreviewBlock>

      <PreviewBlock
        id="tokens-radius-shadow"
        title="Radius & elevation"
        description="Controls use rounded-control (6px). Cards use rounded-panel (8px). Hairlines over drop shadows on chrome."
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
  );
}
