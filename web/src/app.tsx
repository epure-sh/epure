import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./features/auth/login";
import { AuthorizeView } from "./features/oauth/authorize-view";
import { DeviceActivateView } from "./features/oauth/device-activate-view";
import { AppShell } from "./shell/app-shell";
import { AuthGuard } from "./shell/auth-guard";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
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
              <AppShell />
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
