import {
  Activity,
  ArrowLeft,
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
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SidebarNavLink } from "./sidebar-nav-link";
import { cn } from "../lib/cn";
import {
  billingPath,
  getNavigationContext,
  isProjectRoute,
  projectIdFromPath,
  projectPath,
  userSettingsPath,
  workspacePath,
  workspaceSettingsPath,
} from "../lib/paths";
import { ProjectSettingsSidebarItem } from "../ui/settings-nav";
import { WorkspaceSettingsSidebarItem } from "../ui/workspace-settings-nav";
import {
  EPURE_CHANGELOG_URL,
  EPURE_DOCS_QUICKSTART_URL,
  EPURE_DOCS_URL,
} from "../lib/docs-url";
import { EpureBrandMark } from "../ui/logo";
import { Button } from "../ui/button";
import { buildProjectPathWithFeedQuery } from "../features/issues/project-feed-query-store";
import { useAppContext } from "./app-context";
import { dispatchOpenCommandPalette } from "./command-palette";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useLogout } from "../lib/use-logout";
import { NavCountPastille } from "@/components/kit/nav-count-pastille";
import { Badge } from "../ui/badge";
import { useProjectNavCounts } from "./use-project-nav-counts";

export interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const navContext = getNavigationContext(pathname);
  const inProject = isProjectRoute(pathname);

  const {
    projectId,
    projects,
    user,
    currentOrg,
    environment,
  } = useAppContext();
  const logout = useLogout();

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

  const navCounts = useProjectNavCounts(activeProject?.id ?? null, environment);
  // 1. Project-specific ops (above the separator when in a project)
  const projectOpsNavItems = activeProject
    ? [
        {
          to: projectPath(activeProject.id, "dashboard"),
          label: "Dashboard",
          icon: Activity,
          end: true,
          dataTour: "nav-monitoring",
        },
        {
          to: buildProjectPathWithFeedQuery(activeProject.id, "issues", { currentSearch: search }),
          label: "Issues",
          icon: CircleDot,
          end: false,
          dataTour: "nav-issues",
          badge: (
            <NavCountPastille
              count={navCounts.unresolved}
              ariaLabel={
                navCounts.unresolved != null
                  ? `${navCounts.unresolved} unresolved issues`
                  : undefined
              }
            />
          ),
        },
        {
          to: buildProjectPathWithFeedQuery(activeProject.id, "alerts", { currentSearch: search }),
          label: "Alerts",
          icon: Bell,
          end: true,
          dataTour: "nav-alerts",
          badge: (
            <NavCountPastille
              count={navCounts.alertsUnread}
              tone="accent"
              ariaLabel={
                navCounts.alertsUnread != null
                  ? `${navCounts.alertsUnread} unread alerts`
                  : undefined
              }
            />
          ),
        },
        {
          to: projectPath(activeProject.id, "monitors"),
          label: "Cron Monitors",
          icon: Clock,
          end: true,
          dataTour: "nav-cron-monitors",
        },
        {
          to: projectPath(activeProject.id, "releases"),
          label: "Releases",
          icon: Package,
          end: true,
          dataTour: "nav-releases",
        },
      ]
    : [];

  // 2. Workspace context navigation (also shown under General after the project separator)
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
      {/* 1. Brand row — same height as TopStrip (epure-shell-top-chrome) */}
      <div className="epure-shell-top-chrome flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-subtle px-3">
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

        <div className="flex min-w-0 items-center gap-1.5">
          {navContext === "project" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onMobileClose?.();
                navigate(workspacePath());
              }}
              className="flex h-7 max-w-[130px] items-center gap-1.5 px-2 py-1 text-xs text-fg-muted hover:text-fg-primary"
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
              className="ml-1 text-fg-muted hover:text-fg-primary md:hidden"
              aria-label="Close navigation"
            >
              <X size={16} />
            </Button>
          ) : null}
        </div>
      </div>

      {/* 2. Search strip — below TopStrip alignment band */}
      <div className="shrink-0 border-b border-border-subtle bg-surface-1/40 px-2.5 py-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onMobileClose?.();
            dispatchOpenCommandPalette();
          }}
          data-tour="command-palette-trigger"
          className="btn-tactile flex h-7 w-full items-center justify-between px-2.5 text-2xs font-normal text-fg-muted transition-colors hover:text-fg-primary"
        >
          <span className="flex items-center gap-1.5">
            <Search size={12} className="text-fg-muted" />
            <span>Search or command…</span>
          </span>
          <kbd className="rounded border border-border-subtle px-1 py-0.5 font-mono text-[10px] text-fg-muted">
            ⌘K
          </kbd>
        </Button>
      </div>

      {/* 3. Navigation Links List — Adapts Dynamically to Context */}
      <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-4">
        {navContext === "project" && activeProject ? (
          /* PROJECT CONTEXT: ops first, then general workspace tabs */
          <div className="space-y-3">
            <div>
              <div
                className="px-2 pb-1 flex items-baseline justify-between gap-1.5"
                title={activeProject.name}
              >
                <span className="text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
                  {activeProject.name}
                </span>
              </div>
              <nav className="space-y-0.5" aria-label="Project">
                {projectOpsNavItems.map((item) => (
                  <SidebarNavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    label={item.label}
                    icon={item.icon}
                    onClick={onMobileClose}
                    dataTour={"dataTour" in item ? item.dataTour : undefined}
                    badge={"badge" in item ? item.badge : undefined}
                    isAlsoActive={(path, navActive) =>
                      navActive ||
                      path === item.to ||
                      (item.to.endsWith("/issues") && path.startsWith(item.to))
                    }
                  />
                ))}
                <ProjectSettingsSidebarItem
                  projectId={activeProject.id}
                  onNavigate={onMobileClose}
                />
              </nav>
            </div>

            <div className="border-t border-border-subtle pt-3">
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold tracking-wider text-fg-muted uppercase">
                General
              </p>
              <nav className="space-y-0.5" aria-label="General">
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
                <WorkspaceSettingsSidebarItem onNavigate={onMobileClose} />
              </nav>
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
              <WorkspaceSettingsSidebarItem onNavigate={onMobileClose} />
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

      {/* 4. Footer: User Account Menu */}
      <div className="shrink-0 space-y-2 border-t border-border-subtle bg-surface-1/40 p-2.5">
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
        className="epure-sidebar hidden md:flex h-full min-h-0 w-60 shrink-0 flex-col border-r border-border-subtle bg-bg-subtle select-none"
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
          "epure-sidebar fixed inset-y-0 left-0 z-[91] flex h-full w-64 flex-col border-r border-border-subtle bg-bg-subtle shadow-2xl transition-transform duration-200 md:hidden select-none",
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
