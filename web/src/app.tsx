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
          <Routes>
            <Route path="/dev/ds" element={<DesignSystemPlayground />} />
            <Route path="/embed/monitoring/:token" element={<MonitoringPage isEmbed />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/oauth/authorize"
              element={
                <AuthGuard>
                  <AuthorizeView />
                </AuthGuard>
              }
            />
            <Route
              path="/auth/authorize"
              element={
                <AuthGuard>
                  <AuthorizeView />
                </AuthGuard>
              }
            />
            <Route
              path="/activate"
              element={
                <AuthGuard>
                  <DeviceActivateView />
                </AuthGuard>
              }
            />
            <Route
              path="/*"
              element={
                <AuthGuard>
                  <RouteErrorBoundary title="Epure crashed">
                    <AppShell />
                  </RouteErrorBoundary>
                </AuthGuard>
              }
            />
          </Routes>
        </NuqsAdapter>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

