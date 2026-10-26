import { PreviewBlock } from "../shared";

export function TypographySection() {
  return (
    <div id="typography" className="scroll-mt-24 space-y-4">
      <PreviewBlock
        id="type-scale"
        title="Operational type scale"
        description="IBM Plex Sans (chrome), Plex Mono (IDs, counts, stack). No display sizes in-app."
      >
        <div className="space-y-3 rounded-control border border-border-subtle bg-surface-2/30 p-3">
          <p className="text-[11px] text-fg-muted">
            11px — metadata, hotkeys, table headers, badge labels
          </p>
          <p className="text-xs text-fg-primary">
            12px (text-xs) — controls, list titles, body copy
          </p>
          <p className="text-sm font-semibold tracking-tight text-fg-primary">
            14px (text-sm) — section headers, page titles
          </p>
          <p className="font-mono text-xs tabular-nums text-fg-secondary">
            IBM Plex Mono — issue IDs, counts: 14,920 · #82910
          </p>
          <p className="font-mono-slash text-sm text-fg-muted">Slashed zero · 1,024 events</p>
        </div>
      </PreviewBlock>

      <PreviewBlock
        id="type-roles"
        title="Semantic typography roles (app.css)"
      >
        <div className="space-y-2">
          <p className="epure-page-title text-fg-primary">epure-page-title</p>
          <p className="epure-section-header-title text-fg-primary">epure-section-header-title</p>
          <p className="epure-stat-value text-fg-primary tabular-nums">128</p>
          <p className="epure-stat-value-compact text-fg-muted tabular-nums">42</p>
        </div>
      </PreviewBlock>
    </div>
  );
}
