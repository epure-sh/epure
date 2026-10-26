import { DESIGN_KIT_FEATURE_UI_GROUPS } from "../feature-ui-registry";
import { FeatureUiGroupPreviews } from "../previews/feature-ui/feature-ui-group-previews";

export function FeatureUiSection() {
  return (
    <section id="feature-ui" className="scroll-mt-24 space-y-8">
      <header className="space-y-2 border-b border-border-subtle pb-4">
        <h2 className="text-sm font-semibold text-fg-primary">Feature UI (`src/ui`)</h2>
        <p className="max-w-3xl text-xs leading-relaxed text-fg-muted">
          Every feature-layer module is cataloged below, grouped by job. Façades that mirror{" "}
          <code className="font-mono text-[11px]">@/components/ui/*</code> are documented under{" "}
          <a href="#primitives" className="text-accent underline-offset-2 hover:underline">
            UI primitives
          </a>
          . Count:{" "}
          <span className="font-mono tabular-nums">
            {DESIGN_KIT_FEATURE_UI_GROUPS.reduce((n, g) => n + g.modules.length, 0)}
          </span>{" "}
          previews + {15} façades.
        </p>
      </header>

      {DESIGN_KIT_FEATURE_UI_GROUPS.map((group) => (
        <div key={group.id} id={group.id} className="scroll-mt-24 space-y-3">
          <div className="sticky top-0 z-10 -mx-1 border-b border-border-subtle/80 bg-canvas/95 px-1 py-2 backdrop-blur-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-primary">
              {group.label}
            </h3>
            <p className="mt-0.5 text-[11px] text-fg-muted">{group.description}</p>
          </div>
          <FeatureUiGroupPreviews groupId={group.id} />
        </div>
      ))}
    </section>
  );
}
