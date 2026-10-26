import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  ChevronDown,
  CircleDot,
  Clock,
  Compass,
  CreditCard,
  ExternalLink,
  History,
  Layers,
  LogOut,
  Package,
  Radio,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { SidebarNavLink, sidebarNavItemClass, sidebarNavIconClass } from "./sidebar-nav-link";
import { cn } from "../lib/cn";
import {
  billingPath,
  getNavigationContext,
  isProjectRoute,
  projectIdFromPath,
  projectPath,
  projectSettingsPath,
  userSettingsPath,
  workspacePath,
  workspaceSettingsPath,
} from "../lib/paths";
import {
  EPURE_CHANGELOG_URL,
  EPURE_DOCS_QUICKSTART_URL,
  EPURE_DOCS_URL,
} from "../lib/docs-url";
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
import { Badge } from "../ui/badge";
import { isSharedProjectRole, SharedProjectBadge } from "../ui/shared-project-badge";

export interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navContext = getNavigationContext(pathname);
  const inProject = isProjectRoute(pathname);

  const {
    setProjectId,
    projectId,
    projects,
    user,
    currentOrg,
  } = useAppContext();
  const logout = useLogout();
  const viewerRole = user?.role;

  const routeProjectId = projectIdFromPath(pathname);
  const safeProjects = Array.isArray(projects) ? projects : [];
  const workspaceLabel = currentOrg?.name ?? user?.org_name ?? "Workspace";

  const activeProject =
    (inProject && routeProjectId
      ? safeProjects.find(
          (project) => project && (project.id === routeProjectId || project.slug === routeProjectId),
        )
      : null) ??
    (projectId
      ? safeProjects.find((project) => project && (project.id === projectId || project.slug === projectId))
      : null) ??
    safeProjects[0] ??
    null;

  function enterProject(id: string) {
    setProjectId(id);
    onMobileClose?.();
    navigate(projectPath(id, "issues"));
  }

  // 1. Project Context Navigation Items
  const projectNavItems = activeProject
    ? [
        {
          to: projectPath(activeProject.id, "issues"),
          label: "Issues",
          icon: CircleDot,
          end: false,
          dataTour: "nav-issues",
        },
        {
          to: projectPath(activeProject.id, "monitoring"),
          label: "Monitoring",
          icon: Activity,
          end: true,
          dataTour: "nav-monitoring",
        },
        {
          to: projectPath(activeProject.id, "alerts"),
          label: "Alerts",
          icon: Bell,
          end: true,
          dataTour: "nav-alerts",
        },
        {
          to: projectPath(activeProject.id, "releases"),
          label: "Releases",
          icon: Package,
          end: true,
          dataTour: "nav-releases",
        },
        {
          to: projectPath(activeProject.id, "monitors"),
          label: "Cron Monitors",
          icon: Clock,
          end: true,
          dataTour: "nav-cron-monitors",
        },
        {
          to: projectSettingsPath(activeProject.id),
          label: "Project Settings",
          icon: Settings,
          end: false,
          dataTour: "nav-project-settings",
        },
      ]
    : [];

  // 2. Workspace context navigation
  const orgNavItems = [
    { to: "/", label: "Projects", icon: Layers, end: true, badge: undefined, dataTour: "nav-projects" },
    {
      to: workspacePath("team"),
      label: "Team",
      icon: Users,
      end: true,
      badge: undefined,
      dataTour: "nav-team",
    },
    {
      to: billingPath(),
      label: "Usage & Billing",
      icon: CreditCard,
      end: true,
      badge: undefined,
      dataTour: "nav-billing",
    },
    { to: "/org/channels", label: "Output Channels", icon: Radio, end: true, badge: undefined },
    { to: workspaceSettingsPath(), label: "Workspace Settings", icon: Settings, end: false, badge: undefined },
  ];

  // 3. User-scoped routes (e.g. personal settings)
  const globalNavItems = [
    {
      to: userSettingsPath(),
      label: "User Settings",
      icon: SlidersHorizontal,
      end: false,
      badge: undefined,
    },
  ];

  const externalResourceLinks = [
    { href: EPURE_DOCS_URL, label: "Documentation", icon: BookOpen },
    { href: EPURE_CHANGELOG_URL, label: "Changelog", icon: History },
    { href: EPURE_DOCS_QUICKSTART_URL, label: "Quickstart Guide", icon: Compass },
  ];

  const sidebarContent = (
    <>
      {/* 1. Header Zone — Dynamic per Navigation Context with Zero Shift */}
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

        {/* Dynamic Context Header Controls */}
        <div className="flex items-center gap-1.5 min-w-0">
          {navContext === "project" ? (
            /* In Project Context: Back to Organisation Button */
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onMobileClose?.();
                navigate(workspacePath());
              }}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-fg-muted hover:text-fg-primary h-7 max-w-[130px]"
              title={`Return to ${workspaceLabel}`}
            >
              <ArrowLeft size={12} className="shrink-0 text-fg-muted" />
              <span className="truncate text-2xs font-medium">{workspaceLabel}</span>
            </Button>
          ) : navContext === "organization" ? (
            <span
              className="flex h-7 max-w-[130px] items-center gap-1.5 truncate px-2 py-1 text-xs font-semibold text-fg-primary"
              title={workspaceLabel}
            >
              <Building2 size={13} className="shrink-0 text-primary" />
              <span className="truncate">{workspaceLabel}</span>
            </span>
          ) : (
            /* In Main / Global Context: Global Scope Badge */
            <Badge variant="accent" size="compact" className="font-mono uppercase">
              Global
            </Badge>
          )}

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
      </div>

      {/* 2. Sub-Header Zone — Dynamic Context Scope & Search */}
      <div className="p-2.5 pb-1.5 border-b border-border-subtle bg-surface-1/40">
        {navContext === "global" ? (
          /* In Global Context: Active Workspace Return Banner */
          <Link
            to={workspacePath()}
            onClick={onMobileClose}
            className="btn-tactile flex w-full items-center justify-between h-8 px-2.5 text-xs font-medium text-fg-primary rounded-md border border-border-subtle bg-surface-1 hover:bg-surface-2 transition-colors shadow-2xs"
            title={`Active workspace: ${workspaceLabel}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="size-1.5 rounded-full bg-healthy shrink-0" />
              <span className="truncate font-medium text-xs">{workspaceLabel}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-fg-muted shrink-0">
              <span>Open</span>
              <ArrowRight size={11} />
            </div>
          </Link>
        ) : (
          /* In Project or Organisation Context: Project Selector Dropdown */
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
                  <span className="truncate font-semibold">
                    {activeProject?.name ?? "Select project"}
                  </span>
                </div>
                <ChevronDown className="h-3 w-3 text-fg-muted shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-64 max-w-[calc(100vw-2rem)] shadow-lg border border-border-subtle bg-surface-1"
            >
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
                      <span className="font-mono text-[11px] text-fg-muted shrink-0">
                        /{project.slug}
                      </span>
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
        )}

        {/* Quick Search Shortcut Omnibar Trigger */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onMobileClose?.();
            dispatchOpenCommandPalette();
          }}
          data-tour="command-palette-trigger"
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

      {/* 3. Navigation Links List — Adapts Dynamically to Context */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-4">
        {navContext === "project" && activeProject ? (
          /* PROJECT CONTEXT NAVIGATION */
          <div>
            <div
              className="px-2 pb-1 flex items-baseline justify-between gap-1.5"
              title={activeProject.name}
            >
              <span className="text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
                Project
              </span>
              <span className="text-2xs font-medium text-fg-primary truncate max-w-[130px]">
                {activeProject.name}
              </span>
            </div>
            <nav className="space-y-0.5" aria-label="Project">
              {projectNavItems.map((item) => (
                <SidebarNavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  label={item.label}
                  icon={item.icon}
                  onClick={onMobileClose}
                  dataTour={"dataTour" in item ? item.dataTour : undefined}
                  isAlsoActive={(path, navActive) =>
                    navActive ||
                    path === item.to ||
                    (item.to.endsWith("/issues") && path.startsWith(item.to))
                  }
                />
              ))}
            </nav>

            {/* Quick scope return links */}
            <div className="mt-4 pt-3 border-t border-border-subtle/50 space-y-0.5">
              <NavLink
                to={workspacePath()}
                end
                onClick={onMobileClose}
                data-tour="nav-all-projects"
                className={({ isActive }) => sidebarNavItemClass(isActive)}
              >
                {({ isActive }) => (
                  <>
                    <Layers
                      size={14}
                      className={sidebarNavIconClass(isActive)}
                      strokeWidth={isActive ? 2.1 : 1.8}
                    />
                    <span className="truncate">All Projects</span>
                  </>
                )}
              </NavLink>
            </div>
          </div>
        ) : navContext === "organization" ? (
          /* WORKSPACE CONTEXT NAVIGATION */
          <div>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
              {workspaceLabel}
            </p>
            <nav className="space-y-0.5" aria-label="Workspace">
              {orgNavItems.map((item) => (
                <SidebarNavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  label={item.label}
                  icon={item.icon}
                  onClick={onMobileClose}
                  dataTour={"dataTour" in item ? item.dataTour : undefined}
                  badge={
                    item.badge ? (
                      <Badge variant="neutral" size="compact" className="font-mono">
                        {item.badge}
                      </Badge>
                    ) : undefined
                  }
                />
              ))}
            </nav>
          </div>
        ) : (
          /* MAIN / GLOBAL CONTEXT NAVIGATION */
          <div className="space-y-4">
            <div>
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
                Account
              </p>
              <nav className="space-y-0.5" aria-label="Workspace">
                {globalNavItems.map((item) => (
                  <SidebarNavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    label={item.label}
                    icon={item.icon}
                    onClick={onMobileClose}
                    badge={
                      item.badge ? (
                        <Badge variant="neutral" size="compact" className="font-mono">
                          {item.badge}
                        </Badge>
                      ) : undefined
                    }
                  />
                ))}
              </nav>
            </div>

            {/* External Links Section */}
            <div>
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
                Resources
              </p>
              <nav className="space-y-0.5">
                {externalResourceLinks.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={onMobileClose}
                      className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-fg-muted hover:text-fg-primary hover:bg-surface-2/60 transition-colors focus-ring select-none"
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon size={14} className="shrink-0" strokeWidth={1.8} />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <ExternalLink size={11} className="text-fg-muted shrink-0 opacity-60" />
                    </a>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </div>

      {/* 4. Footer: Live Spike Valve Telemetry & User Account Menu */}
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
          <DropdownMenuContent align="end" className="w-56 shadow-lg border border-border-subtle bg-surface-1">
            <DropdownMenuLabel className="font-normal">
              <span className="text-2xs text-fg-muted">Signed in as</span>
              <p className="truncate text-xs font-semibold text-fg-primary">{user?.email ?? "…"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                onMobileClose?.();
                navigate(userSettingsPath());
              }}
              className="text-xs cursor-pointer gap-2"
            >
              <UserCheck className="h-3.5 w-3.5 text-fg-muted" />
              <span>User Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                onMobileClose?.();
                navigate(workspaceSettingsPath());
              }}
              className="text-xs cursor-pointer gap-2"
            >
              <Settings className="h-3.5 w-3.5 text-fg-muted" />
              <span>Workspace Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void logout()}
              className="text-xs text-semantic-danger cursor-pointer gap-2"
            >
              <LogOut className="h-3.5 w-3.5" />
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
          "fixed inset-0 z-[90] bg-overlay backdrop-blur-xs transition-opacity md:hidden",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={() => onMobileClose?.()}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={cn(
          "epure-sidebar fixed inset-y-0 left-0 z-[91] flex h-full w-64 flex-col border-r border-border-subtle bg-surface-1 shadow-2xl transition-transform duration-200 md:hidden select-none",
          mobileOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none",
        )}
        aria-label="Mobile Navigation Sidebar"
        aria-hidden={!mobileOpen}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
