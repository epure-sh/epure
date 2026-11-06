// web/src/ui/block/settings-nav.tsx
// Tier 3 Block: Consolidated Settings Navigation
// Consolidates project and workspace settings nav into a unified variant-driven block.

import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  projectSettingsPath,
  workspaceSettingsPath,
  type ProjectSettingsTab,
} from "../../lib/paths";
import { cn } from "../../lib/cn";
import { sidebarNavIconClass, sidebarNavItemClass } from "../../shell/sidebar-nav-link";

// ---------------------------------------------------------------------------
// Type Contracts & Data Items
// ---------------------------------------------------------------------------

export type SettingsNavType = "project" | "workspace";
export type SettingsNavLayout = "accordion" | "horizontal" | "drawer";

export type WorkspaceSettingsTab =
  | "general"
  | "security"
  | "agent"
  | "connected-apps"
  | "operations";

export interface SettingsNavItem {
  id: string;
  label: string;
  path: string;
  badge?: ReactNode;
  icon?: LucideIcon;
  dataTour?: string;
}

export interface ProjectSettingsNavItem {
  id: ProjectSettingsTab;
  label: string;
  path: (projectId: string) => string;
}

export interface WorkspaceSettingsNavItem {
  id: WorkspaceSettingsTab;
  label: string;
  path: string;
}

/** Flat project-settings leaves shown under the main-sidebar accordion. */
export const PROJECT_SETTINGS_ITEMS: ProjectSettingsNavItem[] = [
  {
    id: "general",
    label: "General",
    path: (projectId) => projectSettingsPath(projectId),
  },
  {
    id: "privacy",
    label: "Privacy",
    path: (projectId) => projectSettingsPath(projectId, "privacy"),
  },
  {
    id: "dsn",
    label: "Client Keys",
    path: (projectId) => projectSettingsPath(projectId, "dsn"),
  },
  {
    id: "filters",
    label: "Filters",
    path: (projectId) => projectSettingsPath(projectId, "filters"),
  },
];

/** @deprecated Use PROJECT_SETTINGS_ITEMS — kept for design-kit imports. */
export const PROJECT_SETTINGS_GROUPS = [
  { id: "settings", label: "Settings", items: PROJECT_SETTINGS_ITEMS },
];

/** Production workspace sidebar tabs. Operations is omitted until a backups API exists. */
export const WORKSPACE_SETTINGS_ITEMS: WorkspaceSettingsNavItem[] = [
  { id: "general", label: "General", path: workspaceSettingsPath() },
  { id: "agent", label: "Workspace tokens", path: workspaceSettingsPath("agent") },
];

// ---------------------------------------------------------------------------
// Active Tab Detectors & Storage Helpers
// ---------------------------------------------------------------------------

export function isSettingsTabActive(currentPath: string, targetPath: string): boolean {
  if (currentPath === targetPath) return true;
  return currentPath.startsWith(targetPath + "/") || currentPath.startsWith(targetPath);
}

export function isProjectSettingsPath(pathname: string): boolean {
  return (
    /\/p\/[^/]+\/settings(?:\/|$)/.test(pathname) ||
    /\/projects\/[^/]+\/settings(?:\/|$)/.test(pathname)
  );
}

export function activeProjectSettingsTab(pathname: string): ProjectSettingsTab {
  const match = pathname.match(/\/settings(?:\/([^/]+))?/);
  const segment = match?.[1];
  if (segment === "privacy" || segment === "dsn" || segment === "filters") {
    return segment;
  }
  return "general";
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

function getStorageKey(type: SettingsNavType, projectId?: string): string {
  return type === "project"
    ? `epure.project-settings-expanded:${projectId ?? "default"}`
    : "epure.workspace-settings-expanded";
}

function readExpanded(storageKey: string): boolean | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

function writeExpanded(storageKey: string, expanded: boolean): void {
  try {
    sessionStorage.setItem(storageKey, expanded ? "1" : "0");
  } catch {
    // Ignore quota / private-mode failures.
  }
}

// ---------------------------------------------------------------------------
// Unified Component: SettingsNav
// ---------------------------------------------------------------------------

export interface SettingsNavProps {
  /** Target scope: "project" or "workspace". Defaults to "project" if projectId is given. */
  type?: SettingsNavType;
  /** Active project ID, required when type="project". */
  projectId?: string;
  /** Custom navigation items override. */
  items?: SettingsNavItem[];
  /** Layout mode: "accordion" (sidebar), "horizontal" (subnav/mobile), "drawer" (card container). */
  layout?: SettingsNavLayout;
  /** Callback invoked on link click (e.g. to close mobile sidebar). */
  onNavigate?: () => void;
  dataTour?: string;
  className?: string;
  defaultExpanded?: boolean;
}

export function SettingsNav({
  type: typeProp,
  projectId = "preview-project",
  items: customItems,
  layout = "accordion",
  onNavigate,
  dataTour: dataTourProp,
  className,
  defaultExpanded,
}: SettingsNavProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Resolve type
  const type: SettingsNavType = typeProp ?? (projectId ? "project" : "workspace");
  const onSettings = type === "project" ? isProjectSettingsPath(pathname) : isWorkspaceSettingsPath(pathname);
  const activeTab =
    type === "project" ? activeProjectSettingsTab(pathname) : activeWorkspaceSettingsTab(pathname);

  const storageKey = getStorageKey(type, projectId);
  const dataTour =
    dataTourProp ?? (type === "project" ? "nav-project-settings" : "nav-workspace-settings");
  const title = type === "project" ? "Project Settings" : "Workspace Settings";
  const defaultBasePath = type === "project" ? projectSettingsPath(projectId) : workspaceSettingsPath();

  // Build resolved items
  const resolvedItems: SettingsNavItem[] = customItems ?? (
    type === "project"
      ? PROJECT_SETTINGS_ITEMS.map((item) => ({
          id: item.id,
          label: item.label,
          path: item.path(projectId),
        }))
      : WORKSPACE_SETTINGS_ITEMS.map((item) => ({
          id: item.id,
          label: item.label,
          path: item.path,
        }))
  );

  const [expanded, setExpanded] = useState(() => {
    if (defaultExpanded !== undefined) return defaultExpanded;
    if (onSettings) return true;
    return readExpanded(storageKey) ?? false;
  });

  useEffect(() => {
    if (onSettings) {
      setExpanded(true);
      writeExpanded(storageKey, true);
      return;
    }
    const stored = readExpanded(storageKey);
    if (stored != null) {
      setExpanded(stored);
    }
  }, [onSettings, storageKey]);

  function setOpen(next: boolean) {
    setExpanded(next);
    writeExpanded(storageKey, next);
  }

  function handleHeaderClick() {
    if (!expanded) {
      setOpen(true);
      if (!onSettings) {
        navigate(defaultBasePath);
        onNavigate?.();
      }
      return;
    }
    setOpen(false);
  }

  // -------------------------------------------------------------------------
  // Layout: Horizontal (Tabs / Subnav)
  // -------------------------------------------------------------------------
  if (layout === "horizontal") {
    return (
      <nav
        data-slot="settings-nav"
        data-settings-type={type}
        data-layout="horizontal"
        aria-label={title}
        className={cn(
          "flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth p-1",
          className,
        )}
      >
        {resolvedItems.map((item) => {
          const active = onSettings && activeTab === item.id;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.id === "general"}
              onClick={onNavigate}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors select-none focus-ring",
                active
                  ? "bg-accent-muted text-fg-primary font-semibold shadow-xs"
                  : "text-fg-muted hover:bg-state-hover hover:text-fg-primary",
              )}
            >
              {item.icon ? <item.icon size={13} aria-hidden /> : null}
              <span>{item.label}</span>
              {item.badge ? <span className="ml-1">{item.badge}</span> : null}
            </NavLink>
          );
        })}
      </nav>
    );
  }

  // -------------------------------------------------------------------------
  // Layout: Drawer / Standalone Card
  // -------------------------------------------------------------------------
  if (layout === "drawer") {
    return (
      <div
        data-slot="settings-nav"
        data-settings-type={type}
        data-layout="drawer"
        className={cn(
          "w-60 rounded-md border border-border-subtle bg-bg-subtle p-2 space-y-1",
          className,
        )}
      >
        <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-fg-muted">
          {title}
        </div>
        <div className="space-y-0.5">
          {resolvedItems.map((item) => {
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
                {item.badge ? <span className="ml-auto">{item.badge}</span> : null}
              </NavLink>
            );
          })}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Layout: Accordion (Default Sidebar)
  // -------------------------------------------------------------------------
  const parentActive = onSettings && !expanded;
  const parentInSection = onSettings;

  return (
    <div
      data-slot="settings-nav"
      data-settings-type={type}
      data-layout="accordion"
      className={cn("space-y-0.5", className)}
    >
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
          <span className="truncate">{title}</span>
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
          {resolvedItems.map((item) => {
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
                {item.badge ? <span className="ml-auto">{item.badge}</span> : null}
              </NavLink>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Backwards-Compatible Drop-In Wrappers
// ---------------------------------------------------------------------------

export interface ProjectSettingsSidebarItemProps {
  projectId: string;
  onNavigate?: () => void;
  dataTour?: string;
}

export function ProjectSettingsSidebarItem({
  projectId,
  onNavigate,
  dataTour,
}: ProjectSettingsSidebarItemProps) {
  return (
    <SettingsNav
      type="project"
      projectId={projectId}
      onNavigate={onNavigate}
      dataTour={dataTour}
      layout="accordion"
    />
  );
}

export interface WorkspaceSettingsSidebarItemProps {
  onNavigate?: () => void;
  dataTour?: string;
}

export function WorkspaceSettingsSidebarItem({
  onNavigate,
  dataTour,
}: WorkspaceSettingsSidebarItemProps) {
  return (
    <SettingsNav
      type="workspace"
      onNavigate={onNavigate}
      dataTour={dataTour}
      layout="accordion"
    />
  );
}

export function WorkspaceSettingsNav() {
  return (
    <div className="w-60 rounded-md border border-border-subtle bg-bg-subtle p-2">
      <WorkspaceSettingsSidebarItem />
    </div>
  );
}
