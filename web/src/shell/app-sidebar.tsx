import {
  Bell,
  CircleDot,
  CreditCard,
  FolderKanban,
  Layers,
  LogOut,
  Package,
  Search,
  Settings,
  Users,
  Activity,
  ChevronDown,
  ShieldCheck,
  X,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../lib/cn";
import {
  isProjectRoute,
  projectIdFromPath,
  projectPath,
  projectSettingsPath,
  workspacePath,
  workspaceSettingsPath,
} from "../lib/paths";
import { EpureBrandMark } from "../ui/logo";
import { Button } from "../ui/button";
import { useAppContext } from "./app-context";
import { dispatchOpenCommandPalette } from "./command-palette";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { useLogout } from "../lib/use-logout";
import { isSharedProjectRole, SharedProjectBadge } from "../ui/shared-project-badge";

export interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inProject = isProjectRoute(pathname);
  const { setProjectId, projectId, projects, user } = useAppContext();
  const logout = useLogout();
  const viewerRole = user?.role;

  const routeProjectId = projectIdFromPath(pathname);
  const activeProject =
    (inProject && routeProjectId ? projects.find((project) => project.id === routeProjectId) : null) ??
    (projectId ? projects.find((project) => project.id === projectId) : null) ??
    projects[0] ??
    null;

  function enterProject(id: string) {
    setProjectId(id);
    onMobileClose?.();
    navigate(projectPath(id, "issues"));
  }

  const projectNavItems = activeProject
    ? [
        { to: projectPath(activeProject.id, "issues"), label: "Issues", icon: CircleDot, end: true },
        { to: projectPath(activeProject.id, "releases"), label: "Releases", icon: Package, end: true },
        { to: projectPath(activeProject.id, "alerts"), label: "Alerts", icon: Bell, end: true },
        { to: projectSettingsPath(activeProject.id), label: "Settings", icon: Settings, end: false },
      ]
    : [];

  const workspaceNavItems = [
    { to: workspacePath(), label: "Projects", icon: Layers, end: true },
    { to: "/team", label: "Team", icon: Users, end: true },
    { to: "/usage", label: "Usage", icon: Activity, end: true },
    { to: "/billing", label: "Billing", icon: CreditCard, end: true },
    { to: workspaceSettingsPath(), label: "Settings", icon: Settings, end: false },
  ];

  const sidebarContent = (
    <>
      {/* 1. Brand & Workspace Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/80 px-3.5 bg-bg/50">
        <Link
          to={workspacePath()}
          onClick={onMobileClose}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-85 focus-ring rounded-md py-1"
        >
          <EpureBrandMark size={28} />
          <div className="flex flex-col">
            <span className="font-semibold text-xs tracking-tight text-ink flex items-center gap-1.5">
              <span>Épure</span>
              <span className="h-1.5 w-1.5 rounded-full bg-healthy animate-pulse" />
            </span>
            <span className="font-mono text-[10px] text-ink-subtle leading-tight">
              cockpit
            </span>
          </div>
        </Link>
        {onMobileClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onMobileClose}
            className="md:hidden text-ink-muted hover:text-ink"
            aria-label="Close navigation"
          >
            <X size={16} />
          </Button>
        ) : null}
      </div>

      {/* 2. Project Selector Dropdown */}
      <div className="p-2.5 pb-1.5 border-b border-border/60">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="btn-tactile flex w-full items-center justify-between h-8 px-2.5 text-xs font-medium text-ink shadow-2xs"
              title={activeProject?.name ?? "Select project"}
            >
              <div className="flex min-w-0 items-center gap-2">
                <FolderKanban className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="truncate">{activeProject?.name ?? "Select project"}</span>
              </div>
              <ChevronDown className="h-3 w-3 text-ink-muted shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)] shadow-lg border border-border">
            <DropdownMenuLabel className="text-2xs font-semibold text-ink-muted uppercase tracking-wider">
              Switch Project
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={activeProject?.id ?? ""}
              onValueChange={enterProject}
            >
              {projects.map((project) => (
                <DropdownMenuRadioItem key={project.id} value={project.id} className="text-xs">
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="size-1.5 rounded-full bg-healthy shrink-0" />
                      <span className="truncate font-medium">{project.name}</span>
                    </span>
                    <span className="font-mono text-[11px] text-fg-muted shrink-0">/{project.slug}</span>
                    {isSharedProjectRole(project.role ?? viewerRole) ? (
                      <SharedProjectBadge />
                    ) : null}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                onMobileClose?.();
                navigate(workspacePath());
              }}
              className="text-xs"
            >
              <Layers className="mr-2 h-3.5 w-3.5" />
              <span>Manage all projects</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick Search Shortcut Trigger */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onMobileClose?.();
            dispatchOpenCommandPalette();
          }}
          className="btn-tactile mt-2 flex w-full items-center justify-between h-7 px-2.5 text-2xs text-ink-muted transition-colors hover:text-ink font-normal"
        >
          <span className="flex items-center gap-1.5">
            <Search size={12} className="text-ink-subtle" />
            <span>Search or command…</span>
          </span>
          <kbd className="font-mono text-[10px] text-ink-subtle border border-border px-1 py-0.5 rounded">
            ⌘K
          </kbd>
        </Button>
      </div>

      {/* 3. Navigation Links List */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-4">
        {/* Project Section */}
        {activeProject ? (
          <div>
            <div className="px-2 pb-1 flex items-baseline justify-between gap-1.5" title={activeProject.name}>
              <span className="text-[10px] font-semibold tracking-wider text-ink-subtle uppercase">Project</span>
              <span className="text-2xs font-medium text-ink truncate max-w-[130px]">{activeProject.name}</span>
            </div>
            <nav className="space-y-0.5">
              {projectNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onMobileClose}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-ring",
                        isActive
                          ? "bg-accent-muted/60 text-accent font-semibold border-l-2 border-accent"
                          : "text-ink-muted hover:bg-state-hover/70 hover:text-ink border-l-2 border-transparent",
                      )
                    }
                  >
                    <Icon size={14} className="shrink-0" strokeWidth={1.8} />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ) : null}

        {/* Workspace Section */}
        <div>
          <p className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-ink-subtle uppercase">
            Workspace
          </p>
          <nav className="space-y-0.5">
            {workspaceNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onMobileClose}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-ring",
                      isActive
                        ? "bg-accent-muted/60 text-accent font-semibold border-l-2 border-accent"
                        : "text-ink-muted hover:bg-state-hover/70 hover:text-ink border-l-2 border-transparent",
                    )
                  }
                >
                  <Icon size={14} className="shrink-0" strokeWidth={1.8} />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 4. Footer: Spike Valve Live Telemetry & User Profile */}
      <div className="shrink-0 border-t border-border p-2.5 space-y-2 bg-bg/40">
        {/* Spike Valve Status Widget */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/usage"
              onClick={onMobileClose}
              className="btn-tactile block rounded-md border border-border/80 bg-surface px-2.5 py-2 text-2xs shadow-2xs hover:border-border-strong hover:bg-state-hover transition-colors"
            >
              <div className="flex items-center justify-between font-medium text-ink">
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-healthy/60 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-healthy" />
                  </span>
                  <span className="font-semibold">Spike Valve</span>
                </span>
                <span className="text-[10px] font-mono text-healthy font-semibold">
                  0 Overages
                </span>
              </div>
              <p className="mt-1 text-[10px] text-ink-subtle leading-tight">
                Soft-sampling active · 100% count kept
              </p>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" align="center" className="max-w-xs space-y-1 p-3 text-xs shadow-lg">
            <div className="flex items-center gap-1.5 font-medium text-ink">
              <ShieldCheck size={14} className="text-healthy" />
              <span>Spike Valve Protection Active</span>
            </div>
            <p className="text-ink-muted leading-relaxed">
              Accurate event count kept (100%) with automated soft-sampling during traffic spikes.
              Zero bill overages, zero storage depletion. Click to inspect telemetry.
            </p>
          </TooltipContent>
        </Tooltip>

        {/* User Account Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="btn-tactile flex w-full items-center justify-between border border-border/60 bg-surface px-2 h-8 text-xs transition-colors hover:bg-state-hover"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-muted text-[10px] font-semibold text-accent">
                  {(user?.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate text-2xs font-medium text-ink">
                  {user?.email ?? "Signed in"}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-ink-muted shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 shadow-lg border border-border">
            <DropdownMenuLabel className="font-normal">
              <span className="text-2xs text-ink-subtle">Signed in as</span>
              <p className="truncate text-xs font-semibold text-ink">{user?.email ?? "…"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                onMobileClose?.();
                navigate(workspaceSettingsPath());
              }}
              className="text-xs"
            >
              <Settings className="mr-2 h-3.5 w-3.5" />
              <span>Workspace Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void logout()} className="text-xs text-semantic-danger">
              <LogOut className="mr-2 h-3.5 w-3.5" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className="epure-sidebar hidden md:flex h-full min-h-0 w-60 shrink-0 flex-col border-r border-border bg-surface select-none shadow-xs"
        aria-label="Application Sidebar"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sliding Aside */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-ink/40 backdrop-blur-xs transition-opacity md:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onMobileClose}
        aria-hidden
      />
      <aside
        className={cn(
          "epure-sidebar fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-border bg-surface shadow-2xl transition-transform duration-200 md:hidden select-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Mobile Navigation Sidebar"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
