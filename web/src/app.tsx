import { BrowserRouter, Route, Routes } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { LoginPage } from "./features/auth/login";
import { AuthorizeView } from "./features/oauth/authorize-view";
import { DeviceActivateView } from "./features/oauth/device-activate-view";
import { DesignSystemPlayground } from "./pages/dev/design-system-playground";
import { AppShell } from "./shell/app-shell";
import { AuthGuard } from "./shell/auth-guard";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { MonitoringPage } from "./features/monitoring";

import { RouteErrorBoundary } from "./ui/route-error-boundary";

import { TooltipProvider } from "./ui/tooltip";
import { ToastProvider } from "./ui/toast-provider";
import { AppProvider } from "./shell/app-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <NuqsAdapter>
          <AppProvider>
            <TooltipProvider delayDuration={300}>
              <ToastProvider>
                <RouteErrorBoundary title="Epure application error" backHref="/">
                  <Routes>
                    <Route
                      path="/dev/ds"
                      element={
                        <RouteErrorBoundary title="Design system playground error" backHref="/">
                          <DesignSystemPlayground />
                        </RouteErrorBoundary>
                      }
                    />
                    <Route
                      path="/embed/monitoring/:token"
                      element={
                        <RouteErrorBoundary title="Monitoring embed error">
                          <MonitoringPage isEmbed />
                        </RouteErrorBoundary>
                      }
                    />
                    <Route
                      path="/login"
                      element={
                        <RouteErrorBoundary title="Sign in error" backHref="/login">
                          <LoginPage />
                        </RouteErrorBoundary>
                      }
                    />
                    <Route
                      path="/oauth/authorize"
                      element={
                        <AuthGuard>
                          <RouteErrorBoundary title="Authorization error" backHref="/">
                            <AuthorizeView />
                          </RouteErrorBoundary>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/auth/authorize"
                      element={
                        <AuthGuard>
                          <RouteErrorBoundary title="Authorization error" backHref="/">
                            <AuthorizeView />
                          </RouteErrorBoundary>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/activate"
                      element={
                        <AuthGuard>
                          <RouteErrorBoundary title="Device activation error" backHref="/">
                            <DeviceActivateView />
                          </RouteErrorBoundary>
                        </AuthGuard>
                      }
                    />
                    <Route
                      path="/*"
                      element={
                        <AuthGuard>
                          <RouteErrorBoundary title="Epure crashed" backHref="/">
                            <AppShell />
                          </RouteErrorBoundary>
                        </AuthGuard>
                      }
                    />
                  </Routes>
                </RouteErrorBoundary>
              </ToastProvider>
            </TooltipProvider>
          </AppProvider>
        </NuqsAdapter>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

