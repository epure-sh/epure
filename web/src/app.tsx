import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LoginPage } from "./features/auth/login";
import { AppShell } from "./shell/app-shell";
import { AuthGuard } from "./shell/auth-guard";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
