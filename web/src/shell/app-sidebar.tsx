import {
  Activity,
  Bell,
  Building2,
  ChevronDown,
  CircleDot,
  Clock,
  CreditCard,
  Layers,
  LogOut,
  Package,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "../lib/cn";
import {
  billingPath,
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
  const {
    setProjectId,
    projectId,
    projects,
    user,
    organizations,
    currentOrg,
    switchOrg,
  } = useAppContext();
  const logout = useLogout();
  const viewerRole = user?.role;

  const routeProjectId = projectIdFromPath(pathname);
  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject =
    (inProject && routeProjectId
      ? safeProjects.find((project) => project && (project.id === routeProjectId || project.slug === routeProjectId))
      : null) ??
    (projectId ? safeProjects.find((project) => project && (project.id === projectId || project.slug === projectId)) : null) ??
    safeProjects[0] ??
    null;

  function enterProject(id: string) {
    setProjectId(id);
    onMobileClose?.();
    navigate(projectPath(id, "issues"));
  }

  // Project Context (Self-Explanatory Names):
  // Issues → Monitoring → Alerts → Releases (placed directly after Alerts) → Project Settings
  const projectNavItems = activeProject
    ? [
        { to: projectPath(activeProject.id, "issues"), label: "Issues", icon: CircleDot, end: true },
        { to: projectPath(activeProject.id, "monitoring"), label: "Monitoring", icon: Activity, end: true },
        { to: projectPath(activeProject.id, "alerts"), label: "Alerts", icon: Bell, end: true },
        { to: projectPath(activeProject.id, "releases"), label: "Releases", icon: Package, end: true },
        { to: projectPath(activeProject.id, "monitors"), label: "Cron Monitors", icon: Clock, end: true },
        { to: projectSettingsPath(activeProject.id), label: "Project Settings", icon: Settings, end: false },
      ]
    : [];

  // Organisation Context:
  // Projects → Team → Usage & Billing → Output Channels → Org Settings
  const orgNavItems = [
    { to: "/", label: "Projects", icon: Layers, end: true },
    { to: workspacePath("team"), label: "Team", icon: Users, end: true },
    { to: billingPath(), label: "Usage & Billing", icon: CreditCard, end: true },
    { to: "/org/channels", label: "Output Channels", icon: Radio, end: true },
    { to: workspaceSettingsPath(), label: "Org Settings", icon: Settings, end: false },
  ];

  const safeOrganizations = Array.isArray(organizations) ? organizations : [];

  const sidebarContent = (
    <>
      {/* 1. Organisation Menu at top of sidebar (one level above Projects) */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border-subtle px-3 bg-surface-1">
        <Link
          to={workspacePath()}
          onClick={onMobileClose}
          className="flex items-center gap-2 transition-opacity hover:opacity-85 focus-ring rounded-md py-1 shrink-0"
        >
          <EpureBrandMark size={22} />
          <span className="font-semibold text-xs tracking-tight text-fg-primary">
            Épure
          </span>
        </Link>

        {/* Organisation Selector Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-fg-primary h-7 max-w-[130px]"
              title="Organisation Menu"
            >
              <Building2 size={13} className="text-primary shrink-0" />
              <span className="truncate text-xs">
                {currentOrg ? currentOrg.name : user?.org_name || "Organisation"}
              </span>
              <ChevronDown size={11} className="text-fg-muted shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 shadow-lg border border-border-subtle bg-surface-1">
            <DropdownMenuLabel className="flex items-center justify-between text-2xs uppercase tracking-wider text-fg-muted">
              <span>Organisations</span>
              <span className="text-[10px] text-fg-muted">{safeOrganizations.length} total</span>
            </DropdownMenuLabel>
            <div className="max-h-56 overflow-y-auto divide-y divide-border-subtle/40">
              {safeOrganizations.map((org) => {
                const isSelected = org.is_current || org.id === user?.org_id;
                return (
                  <DropdownMenuItem
                    key={org.id}
                    onSelect={() => void switchOrg(org.id)}
                    className={cn(
                      "flex items-center justify-between text-xs py-2 cursor-pointer",
                      isSelected && "bg-primary/10 font-semibold text-fg-primary",
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-healthy shrink-0" />
                        <span className="truncate">{org.name}</span>
                      </div>
                      <span className="text-2xs font-mono text-fg-muted capitalize ml-3.5">
                        {org.role} · {org.member_count} member{org.member_count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                onMobileClose?.();
                navigate(workspaceSettingsPath());
              }}
              className="text-xs cursor-pointer flex items-center gap-2"
            >
              <Settings size={13} className="text-fg-muted" />
              <span>Organisation Settings</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {onMobileClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onMobileClose}
            className="md:hidden text-fg-muted hover:text-fg-primary ml-1"
            aria-label="Close navigation"
          >
            <X size={16} />
          </Button>
        ) : null}
      </div>

      {/* 2. Project Selector Dropdown (Clean 6px semantic health dot, no letter avatars) */}
      <div className="p-2.5 pb-1.5 border-b border-border-subtle bg-surface-1/40">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-tour="project-switcher"
              className="btn-tactile flex w-full items-center justify-between h-8 px-2.5 text-xs font-medium text-fg-primary shadow-2xs"
              title={activeProject?.name ?? "Select project"}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-1.5 rounded-full bg-healthy shrink-0" />
                <span className="truncate font-semibold">{activeProject?.name ?? "Select project"}</span>
              </div>
              <ChevronDown className="h-3 w-3 text-fg-muted shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)] shadow-lg border border-border-subtle bg-surface-1">
            <DropdownMenuLabel className="text-2xs font-semibold text-fg-muted uppercase tracking-wider">
              Switch Project
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={activeProject?.id ?? ""}
              onValueChange={enterProject}
            >
              {safeProjects.map((project) => (
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
          className="btn-tactile mt-2 flex w-full items-center justify-between h-7 px-2.5 text-2xs text-fg-muted transition-colors hover:text-fg-primary font-normal"
        >
          <span className="flex items-center gap-1.5">
            <Search size={12} className="text-fg-muted" />
            <span>Search or command…</span>
          </span>
          <kbd className="font-mono text-[10px] text-fg-muted border border-border-subtle px-1 py-0.5 rounded">
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
              <span className="text-[10px] font-semibold tracking-wider text-fg-muted uppercase">Project</span>
              <span className="text-2xs font-medium text-fg-primary truncate max-w-[130px]">{activeProject.name}</span>
            </div>
            <nav className="space-y-0.5">
              {projectNavItems.map((item) => {
                const Icon = item.icon;
                const isExactActive = pathname === item.to || (item.to.endsWith("/issues") && pathname.startsWith(item.to));
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    data-tour={item.label === "Monitoring" ? "monitoring-nav" : undefined}
                    onClick={onMobileClose}
                    className={({ isActive }) =>
                      cn(
                        "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-ring select-none",
                        isActive || isExactActive
                          ? "text-fg-primary font-semibold"
                          : "text-fg-muted hover:text-fg-primary hover:bg-surface-2/60",
                      )
                    }
                  >
                    {({ isActive }) => {
                      const active = isActive || isExactActive;
                      return (
                        <>
                          {active && (
                            <motion.div
                              layoutId="activeProjectNavPill"
                              className="absolute inset-0 rounded-md bg-surface-2 border-l-2 border-primary"
                              transition={{ type: "spring", stiffness: 400, damping: 32 }}
                            />
                          )}
                          <Icon size={14} className="relative z-10 shrink-0" strokeWidth={1.8} />
                          <span className="relative z-10 truncate">{item.label}</span>
                        </>
                      );
                    }}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ) : null}

        {/* Organisation Section */}
        <div>
          <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
            Organisation
          </p>
          <nav className="space-y-0.5">
            {orgNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onMobileClose}
                  className={({ isActive }) =>
                    cn(
                      "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors focus-ring select-none",
                      isActive
                        ? "text-fg-primary font-semibold"
                        : "text-fg-muted hover:text-fg-primary hover:bg-surface-2/60",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.div
                          layoutId="activeOrgNavPill"
                          className="absolute inset-0 rounded-md bg-surface-2 border-l-2 border-primary"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      <Icon size={14} className="relative z-10 shrink-0" strokeWidth={1.8} />
                      <span className="relative z-10 truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 4. Footer: Spike Valve Live Telemetry & User Profile */}
      <div className="shrink-0 border-t border-border-subtle p-2.5 space-y-2 bg-surface-1/40">
        {/* Spike Valve Status Widget */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              to="/usage"
              onClick={onMobileClose}
              className="btn-tactile block rounded-md border border-border-subtle bg-surface-1 px-2.5 py-2 text-2xs shadow-tactile hover:border-border-strong hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center justify-between font-medium text-fg-primary">
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
              <p className="mt-1 text-[10px] text-fg-muted leading-tight">
                Soft-sampling active · 100% count kept
              </p>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" align="center" className="max-w-xs space-y-1 p-3 text-xs shadow-lg">
            <div className="flex items-center gap-1.5 font-medium text-fg-primary">
              <ShieldCheck size={14} className="text-healthy" />
              <span>Spike Valve Protection Active</span>
            </div>
            <p className="text-fg-muted leading-relaxed">
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
              className="btn-tactile flex w-full items-center justify-between border border-border-subtle bg-surface-1 px-2 h-8 text-xs transition-colors hover:bg-surface-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-fg-primary">
                  {(user?.email ?? "?").slice(0, 1).toUpperCase()}
                </span>
                <span className="truncate text-2xs font-medium text-fg-primary">
                  {user?.email ?? "Signed in"}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-fg-muted shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 shadow-lg border border-border-subtle bg-surface-1">
            <DropdownMenuLabel className="font-normal">
              <span className="text-2xs text-fg-muted">Signed in as</span>
              <p className="truncate text-xs font-semibold text-fg-primary">{user?.email ?? "…"}</p>
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
        className="epure-sidebar hidden md:flex h-full min-h-0 w-60 shrink-0 flex-col border-r border-border-subtle bg-surface-1 select-none shadow-xs"
        aria-label="Application Sidebar"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Sliding Aside */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-overlay backdrop-blur-xs transition-opacity md:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onMobileClose}
        aria-hidden
      />
      <aside
        className={cn(
          "epure-sidebar fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-border-subtle bg-surface-1 shadow-2xl transition-transform duration-200 md:hidden select-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Mobile Navigation Sidebar"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
