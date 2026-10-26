import { BrowserRouter } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "../src/shell/app-shell";
import { AppProvider } from "../src/shell/app-context";
import { ToastProvider } from "../src/ui/toast-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

function PlaygroundBanner() {
  return (
    <div className="border-b border-border bg-accent/10 px-4 py-1.5 text-center font-mono text-xs text-ink-muted">
      Playground mode. Mock API only. Setup:{" "}
      <code className="text-ink">window.__EPURE_PLAYGROUND__.openSetup()</code>
      {" · "}
      Reset: <code className="text-ink">window.__EPURE_PLAYGROUND__.reset()</code>
    </div>
  );
}

export function PlaygroundApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NuqsAdapter>
          <AppProvider>
            <TooltipProvider delayDuration={300}>
              <ToastProvider>
                <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
                  <PlaygroundBanner />
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <AppShell />
                  </div>
                </div>
              </ToastProvider>
            </TooltipProvider>
          </AppProvider>
        </NuqsAdapter>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
