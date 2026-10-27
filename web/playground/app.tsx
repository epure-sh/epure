import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { DesignKitPage } from "../src/pages/dev/design-kit/design-kit-page";
import { RouteErrorBoundary } from "../src/ui/route-error-boundary";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivacyNoticePage } from "../src/features/privacy/notice";
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
    <div className="border-b border-border-subtle bg-accent-muted/40 px-4 py-1.5 text-center font-mono text-xs text-fg-muted">
      Playground mode ·{" "}
      <a href="/__design" className="font-medium text-accent underline-offset-2 hover:underline">
        Design system catalog (/__design)
      </a>
      {" · "}Setup:{" "}
      <code className="text-fg-secondary">window.__EPURE_PLAYGROUND__.openSetup()</code>
      {" · "}
      Reset: <code className="text-fg-secondary">window.__EPURE_PLAYGROUND__.reset()</code>
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
                <Routes>
                  <Route
                    path="/__design"
                    element={
                      <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
                        <PlaygroundBanner />
                        <div className="min-h-0 flex-1 overflow-hidden">
                          <RouteErrorBoundary title="Design kit error" backHref="/">
                            <DesignKitPage />
                          </RouteErrorBoundary>
                        </div>
                      </div>
                    }
                  />
                  <Route path="/dev/ds" element={<Navigate to="/__design" replace />} />
                  <Route path="/privacy" element={<PrivacyNoticePage />} />
                  <Route
                    path="/*"
                    element={
                      <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
                        <PlaygroundBanner />
                        <div className="min-h-0 flex-1 overflow-hidden">
                          <AppShell />
                        </div>
                      </div>
                    }
                  />
                </Routes>
              </ToastProvider>
            </TooltipProvider>
          </AppProvider>
        </NuqsAdapter>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
