import systemMd from "@design/SYSTEM.md?raw";
import alertsUiMd from "@design/alerts-ui.md?raw";
import componentsMd from "@design/components.md?raw";
import qaMd from "@design/qa.md?raw";
import designReadmeMd from "@design/README.md?raw";
import orbitContractMd from "@design/ORBIT_CONTRACT.md?raw";
import orbitRecipesMd from "@design/ORBIT_RECIPES.md?raw";
import orbitMigrationMd from "@design/ORBIT_MIGRATION.md?raw";
import { PreviewBlock } from "../shared";

const DOCS: { id: string; title: string; path: string; body: string }[] = [
  { id: "orbit-contract", title: "ORBIT_CONTRACT", path: "web/design/ORBIT_CONTRACT.md", body: orbitContractMd },
  { id: "orbit-recipes", title: "ORBIT_RECIPES", path: "web/design/ORBIT_RECIPES.md", body: orbitRecipesMd },
  { id: "orbit-migration", title: "ORBIT_MIGRATION", path: "web/design/ORBIT_MIGRATION.md", body: orbitMigrationMd },
  { id: "design-readme", title: "Design README", path: "web/design/README.md", body: designReadmeMd },
  { id: "system", title: "SYSTEM (legacy notes)", path: "web/design/SYSTEM.md", body: systemMd },
  { id: "alerts-ui", title: "Alerts UI", path: "web/design/alerts-ui.md", body: alertsUiMd },
  { id: "components", title: "Component recipes", path: "web/design/components.md", body: componentsMd },
  { id: "qa", title: "Visual QA", path: "web/design/qa.md", body: qaMd },
];

export function ProductDocsSection() {
  return (
    <section id="product-docs" className="scroll-mt-24 space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-fg-primary">Product design docs</h2>
        <p className="max-w-2xl text-xs leading-relaxed text-fg-muted">
          Authoritative markdown in <code className="font-mono text-[11px]">web/design/</code>. Edit files
          on disk — this catalog reloads via Vite HMR. Not shipped in production builds.
        </p>
      </div>

      <div className="space-y-3">
        {DOCS.map((doc) => (
          <PreviewBlock
            key={doc.id}
            id={doc.id}
            title={doc.title}
            description={doc.path}
          >
            <details className="group rounded-panel border border-border-subtle bg-surface-1">
              <summary className="cursor-pointer list-none px-4 py-2.5 text-xs font-medium text-fg-primary marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="text-fg-muted group-open:hidden">Show full document</span>
                <span className="hidden text-fg-muted group-open:inline">Hide document</span>
              </summary>
              <pre className="max-h-[min(70vh,32rem)] overflow-auto border-t border-border-subtle px-4 py-3 font-mono text-[11px] leading-relaxed text-fg-secondary whitespace-pre-wrap">
                {doc.body}
              </pre>
            </details>
          </PreviewBlock>
        ))}
      </div>
    </section>
  );
}
