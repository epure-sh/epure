import { PreviewBlock } from "../shared";

export function ShellSection() {
  return (
    <div id="shell" className="scroll-mt-24 space-y-4">
      <PreviewBlock
        id="shell-chrome"
        title="App shell (src/shell/)"
        description="Rail, top strip, sidebar, command palette — full chrome runs in playground routes; this is a static wireframe."
      >
        <div className="flex h-48 overflow-hidden rounded-panel border border-border-subtle">
          <div className="flex w-28 flex-col gap-px border-r border-border bg-bg-subtle p-1.5">
            <div className="rounded-control bg-accent-muted px-2 py-1 text-xs text-fg-primary">
              Issues
            </div>
            <div className="px-2 py-1 text-xs text-fg-muted">Alerts</div>
            <div className="px-2 py-1 text-xs text-fg-muted">Settings</div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-8 items-center gap-1 border-b border-border bg-surface px-3 text-xs">
              <span className="size-5 rounded-control bg-accent" />
              <span className="text-fg-muted">/</span>
              <span className="text-fg-primary">Org</span>
              <span className="text-fg-muted">/</span>
              <span className="text-fg-primary">Project</span>
              <span className="text-fg-muted">/</span>
              <span className="text-fg-primary">production</span>
            </div>
            <div className="flex-1 bg-canvas p-3">
              <div className="h-6 w-2/3 rounded-control bg-surface-2" />
              <div className="mt-2 h-4 w-1/2 rounded-control bg-surface-2/80" />
            </div>
          </div>
        </div>
      </PreviewBlock>
    </div>
  );
}
