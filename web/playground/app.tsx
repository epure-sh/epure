import { BrowserRouter } from "react-router-dom";
import { AppShell } from "../src/shell/app-shell";

function PlaygroundBanner() {
  return (
    <div className="border-b border-border bg-accent/10 px-4 py-1.5 text-center font-mono text-xs text-ink-muted">
      Playground mode — mock API. Setup:{" "}
      <code className="text-ink">window.__EPURE_PLAYGROUND__.openSetup()</code>
      {" · "}
      Reset: <code className="text-ink">window.__EPURE_PLAYGROUND__.reset()</code>
    </div>
  );
}

export function PlaygroundApp() {
  return (
    <BrowserRouter>
      <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
        <PlaygroundBanner />
        <div className="min-h-0 flex-1 overflow-hidden">
          <AppShell />
        </div>
      </div>
    </BrowserRouter>
  );
}
