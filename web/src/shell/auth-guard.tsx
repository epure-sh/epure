import { type ReactNode, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "../ui/skeleton";

type AuthStatus = "loading" | "authed" | "guest";

export function AuthGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/v1/auth/me", { credentials: "include" })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setStatus(response.ok ? "authed" : "guest");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("guest");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  if (status === "loading") {
    return (
      <div className="epure-auth-loading flex min-h-screen flex-col items-center justify-center gap-3 bg-bg">
        <Skeleton className="h-8 w-8 rounded-full" />
        <p className="text-sm text-ink-muted">Checking session…</p>
      </div>
    );
  }

  if (status === "guest") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
