import { LogOut } from "lucide-react";
import { useLogout } from "../lib/use-logout";
import { useAppContext } from "./app-context";

export function RailAccountFooter() {
  const { user } = useAppContext();
  const logout = useLogout();

  return (
    <div className="epure-rail-footer mt-auto flex flex-col gap-0.5 border-t border-border/60 pt-3">
      <div className="epure-rail-account-meta hidden min-w-0 items-center gap-2.5 px-3 pb-1 lg:flex">
        <span className="epure-rail-account-avatar flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-muted text-2xs font-medium text-accent">
          {(user?.email ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="text-2xs text-ink-muted">Signed in as</p>
          <p className="truncate text-sm font-medium text-ink">{user?.email ?? "…"}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void logout()}
        className="epure-nav-item epure-rail-logout flex w-full items-center justify-center gap-2.5 focus-ring lg:justify-start"
      >
        <LogOut size={17} strokeWidth={1.75} className="epure-nav-item-icon shrink-0" />
        <span className="hidden min-w-0 flex-1 truncate lg:inline">Log out</span>
      </button>
    </div>
  );
}
