import {
  ArrowRight,
  ChevronDown,
  FolderKanban,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  UserCheck,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useThemeMode } from "../lib/style-theme";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  getNavigationContext,
  isProjectRoute,
  projectIdFromPath,
  projectPath,
  userSettingsPath,
  workspacePath,
  workspaceSettingsPath,
} from "../lib/paths";
import { isCloudDeployment } from "../lib/deployment";
import { cn } from "../lib/cn";
import { useAppContext } from "./app-context";
import { useLogout } from "../lib/use-logout";

function getPageName(pathname: string): string {
  if (pathname.startsWith("/user/settings/security")) return "User Settings › Security";
  if (pathname.startsWith("/user/settings/agent")) return "User Settings › Personal Tokens";
  if (pathname.startsWith("/user/settings/connected-apps")) return "User Settings › Connected Apps";
  if (pathname.startsWith("/user/settings") || pathname.startsWith("/user")) return "User Settings";
  if (pathname.includes("/channels")) return "Output Channels";
  if (pathname.includes("/issues")) return "Issues Feed";
  if (pathname.includes("/monitoring")) return "Monitoring";
  if (pathname.includes("/monitors")) return "Cron Monitors";
  if (pathname.includes("/releases")) return "Releases";
  if (pathname.includes("/alerts")) return "Alerts";
  if (pathname.includes("/setup")) return "Setup";
  if (pathname.includes("/settings")) return "Settings";
  if (pathname.includes("/team")) return "Team";
  if (pathname.includes("/usage")) return "Usage";
  if (pathname.includes("/billing")) return "Billing";
  if (pathname === "/") return "Projects";
  return "Overview";
}

export interface TopStripProps {
  onOpenMobileSidebar?: () => void;
}

export function TopStrip({ onOpenMobileSidebar }: TopStripProps = {}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inProject = isProjectRoute(pathname);
  const { projects, user, setProjectId } = useAppContext();
  const logout = useLogout();
  const [themeMode, toggleTheme] = useThemeMode();

  const routeProjectId = projectIdFromPath(pathname);
  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject =
    inProject && routeProjectId
      ? safeProjects.find(
          (project) => project && (project.id === routeProjectId || project.slug === routeProjectId),
        ) ?? null
      : null;

  const navContext = getNavigationContext(pathname);
  const pageName = getPageName(pathname);
  const hideProjectPageCrumb =
    navContext === "project" &&
    (pathname.includes("/issues") ||
      pathname.includes("/alerts") ||
      pathname.includes("/releases") ||
      pathname.includes("/monitors") ||
      pathname.includes("/monitoring") ||
      pathname.includes("/setup") ||
      pathname.includes("/settings"));

  const projectSwitcher = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="flex h-7 items-center gap-1.5 px-2 py-1 text-xs font-semibold text-fg-primary"
        >
          <FolderKanban size={13} className="shrink-0 text-primary" />
          <span className="max-w-[120px] truncate sm:max-w-[180px]">
            {activeProject ? activeProject.name : "All Projects"}
          </span>
          <ChevronDown size={11} className="shrink-0 text-fg-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 border border-border-subtle bg-surface-1 shadow-lg">
        <DropdownMenuLabel className="flex items-center justify-between text-2xs uppercase tracking-wider text-fg-muted">
          <span>Projects</span>
        </DropdownMenuLabel>
        {safeProjects.length === 0 ? (
          <div className="px-2 py-2 text-2xs text-fg-muted">No projects configured</div>
        ) : (
          <div className="max-h-56 divide-y divide-border-subtle/40 overflow-y-auto">
            {safeProjects.slice(0, 25).map((p) => {
              const isActive = p.id === activeProject?.id;
              return (
                <DropdownMenuItem
                  key={p.id}
                  onSelect={() => {
                    setProjectId(p.id);
                    navigate(projectPath(p.id, "issues"));
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between py-2 text-xs",
                    isActive && "bg-state-selected font-semibold text-fg-primary",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-healthy" />
                    <span className="truncate">{p.name}</span>
                  </div>
                  <span className="ml-2 shrink-0 font-mono text-[11px] text-fg-muted">/{p.slug}</span>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => navigate(workspacePath())}
          className="flex cursor-pointer items-center justify-between text-2xs text-fg-muted"
        >
          <span>Manage all projects</span>
          <ArrowRight size={11} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header className="epure-top-strip flex h-11 shrink-0 select-none items-center justify-between border-b border-border-subtle bg-surface-1 px-4">
      <div className="flex min-w-0 items-center gap-2">
        {onOpenMobileSidebar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onOpenMobileSidebar}
            className="-ml-1 text-fg-muted hover:text-fg-primary md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu size={16} />
          </Button>
        ) : null}

        {navContext === "global" ? (
          <>
            <div className="flex h-7 items-center gap-1.5 px-2 py-1 text-xs font-semibold text-fg-primary">
              <Badge variant="accent" size="compact" className="font-mono uppercase text-[9px]">
                Global
              </Badge>
            </div>
            <span className="text-xs text-fg-muted" aria-hidden>
              /
            </span>
            <span className="truncate text-xs font-medium text-fg-muted">{pageName}</span>
            {user?.org_name ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate(workspacePath())}
                className="ml-1.5 hidden h-6 items-center gap-1.5 rounded border border-border-subtle bg-surface-2/40 px-2 py-0.5 text-2xs text-fg-muted hover:text-fg-primary sm:inline-flex"
                title={`Return to ${user.org_name}`}
              >
                <span className="size-1.5 shrink-0 rounded-full bg-healthy" />
                <span className="max-w-[120px] truncate">{user.org_name}</span>
                <ArrowRight size={10} className="shrink-0 text-fg-muted" />
              </Button>
            ) : null}
          </>
        ) : (
          <>
            {navContext === "project" ? projectSwitcher : null}
            {navContext === "organization" ? projectSwitcher : null}
            {!hideProjectPageCrumb ? (
              <>
                <span className="text-xs text-fg-muted" aria-hidden>
                  /
                </span>
                <span className="truncate text-xs font-medium text-fg-muted">{pageName}</span>
              </>
            ) : null}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {isCloudDeployment() ? (
          <a
            href="mailto:support@epure.sh?subject=Epure%20Cloud%20Feedback"
            className="hidden h-7 items-center px-2 text-xs text-fg-muted transition-colors hover:text-fg-primary lg:inline-flex"
          >
            Feedback
          </a>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="hidden h-7 items-center px-2 text-xs text-fg-muted transition-colors hover:text-fg-primary lg:inline-flex"
            onClick={() => window.open("https://github.com/epure-sh/epure/issues", "_blank")}
          >
            Feedback
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={toggleTheme}
          aria-label={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={themeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="text-fg-muted hover:text-fg-primary"
        >
          {themeMode === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Account"
              className="rounded-full"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-2xs font-semibold text-primary">
                {(user?.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border border-border-subtle bg-surface-1 shadow-md">
            <DropdownMenuLabel className="font-normal">
              <span className="text-2xs text-fg-muted">Signed in as</span>
              <p className="truncate text-xs font-semibold text-fg-primary">{user?.email ?? "…"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => navigate(userSettingsPath())}
              className="cursor-pointer gap-2 text-xs"
            >
              <UserCheck size={13} className="text-fg-muted" />
              <span>User Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => navigate(workspaceSettingsPath())}
              className="cursor-pointer gap-2 text-xs"
            >
              <Settings size={13} className="text-fg-muted" />
              <span>Workspace Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={toggleTheme}
              className="flex cursor-pointer items-center justify-between text-xs"
            >
              <span className="flex items-center gap-2">
                {themeMode === "dark" ? <Sun size={13} /> : <Moon size={13} />}
                <span>Theme: {themeMode === "dark" ? "Dark" : "Light"}</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void logout()}
              className="cursor-pointer gap-2 text-xs text-semantic-danger"
            >
              <LogOut size={13} />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
