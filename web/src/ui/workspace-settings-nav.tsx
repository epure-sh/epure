import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Settings } from "lucide-react";
import { workspaceSettingsPath } from "../lib/paths";
import { cn } from "../lib/cn";
import { sidebarNavIconClass, sidebarNavItemClass } from "../shell/sidebar-nav-link";

export type WorkspaceSettingsTab =
  | "general"
  | "security"
  | "agent"
  | "connected-apps"
  | "operations";

export interface WorkspaceSettingsNavItem {
  id: WorkspaceSettingsTab;
  label: string;
  path: string;
}

/** Production sidebar tabs. Operations is omitted until a backups API exists. */
export const WORKSPACE_SETTINGS_ITEMS: WorkspaceSettingsNavItem[] = [
  { id: "general", label: "General", path: workspaceSettingsPath() },
  { id: "security", label: "Security", path: workspaceSettingsPath("security") },
  { id: "agent", label: "Agent tokens", path: workspaceSettingsPath("agent") },
  {
    id: "connected-apps",
    label: "Connected apps",
    path: workspaceSettingsPath("connected-apps"),
  },
];

function storageKey(): string {
  return "epure.workspace-settings-expanded";
}

function readExpanded(): boolean | null {
  try {
    const raw = sessionStorage.getItem(storageKey());
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

function writeExpanded(expanded: boolean): void {
  try {
    sessionStorage.setItem(storageKey(), expanded ? "1" : "0");
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function isWorkspaceSettingsPath(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

export function activeWorkspaceSettingsTab(pathname: string): WorkspaceSettingsTab {
  const match = pathname.match(/^\/settings(?:\/([^/]+))?/);
  const segment = match?.[1];
  if (
    segment === "security" ||
    segment === "agent" ||
    segment === "connected-apps" ||
    segment === "operations"
  ) {
    return segment;
  }
  return "general";
}

export interface WorkspaceSettingsSidebarItemProps {
  onNavigate?: () => void;
  dataTour?: string;
}

/** Expandable Workspace Settings entry for the main app sidebar. */
export function WorkspaceSettingsSidebarItem({
  onNavigate,
  dataTour = "nav-workspace-settings",
}: WorkspaceSettingsSidebarItemProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onSettings = isWorkspaceSettingsPath(pathname);
  const activeTab = activeWorkspaceSettingsTab(pathname);
  const items = WORKSPACE_SETTINGS_ITEMS;

  const [expanded, setExpanded] = useState(() => {
    if (onSettings) return true;
    return readExpanded() ?? false;
  });

  useEffect(() => {
    if (onSettings) {
      setExpanded(true);
      writeExpanded(true);
      return;
    }
    const stored = readExpanded();
    if (stored != null) {
      setExpanded(stored);
    }
  }, [onSettings]);

  function setOpen(next: boolean) {
    setExpanded(next);
    writeExpanded(next);
  }

  function handleHeaderClick() {
    if (!expanded) {
      setOpen(true);
      if (!onSettings) {
        navigate(workspaceSettingsPath());
        onNavigate?.();
      }
      return;
    }
    setOpen(false);
  }

  const parentActive = onSettings && !expanded;
  const parentInSection = onSettings;

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        data-tour={dataTour}
        aria-expanded={expanded}
        onClick={handleHeaderClick}
        className={sidebarNavItemClass(parentActive, "w-full justify-between")}
      >
        <span className="relative z-10 flex min-w-0 items-center gap-2">
          <Settings
            size={13}
            strokeWidth={parentInSection ? 2.1 : 1.8}
            className={sidebarNavIconClass(parentInSection)}
            aria-hidden
          />
          <span className="truncate">Workspace Settings</span>
        </span>
        <ChevronDown
          size={12}
          className={cn(
            "relative z-10 shrink-0 text-fg-muted transition-transform duration-150",
            expanded ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="ml-3 space-y-0.5 border-l border-border-subtle pl-1.5">
          {items.map((item) => {
            const active = onSettings && activeTab === item.id;
            return (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.id === "general"}
                onClick={onNavigate}
                className={sidebarNavItemClass(active)}
              >
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Design-kit preview of the expandable Workspace Settings sidebar item. */
export function WorkspaceSettingsNav() {
  return (
    <div className="w-60 rounded-md border border-border-subtle bg-bg-subtle p-2">
      <WorkspaceSettingsSidebarItem />
    </div>
  );
}
