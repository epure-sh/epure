import {
  ArrowRight,
  ChevronDown,
  FolderKanban,
  LogOut,
  Menu,
  Moon,
  Sun,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useThemeMode } from "../lib/style-theme";
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
  isProjectRoute,
  projectIdFromPath,
  projectPath,
  workspacePath,
  workspaceSettingsPath,
} from "../lib/paths";
import { isCloudDeployment } from "../lib/deployment";
import { cn } from "../lib/cn";
import { useAppContext } from "./app-context";
import { useLogout } from "../lib/use-logout";

function getPageName(pathname: string): string {
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
  const {
    projects,
    user,
    setProjectId,
  } = useAppContext();
  const logout = useLogout();
  const [themeMode, toggleTheme] = useThemeMode();

  const routeProjectId = projectIdFromPath(pathname);
  const safeProjects = Array.isArray(projects) ? projects : [];
  const activeProject =
    inProject && routeProjectId
      ? safeProjects.find((project) => project && (project.id === routeProjectId || project.slug === routeProjectId)) ?? null
      : null;

  const pageName = getPageName(pathname);

  return (
    <header className="epure-top-strip flex h-11 shrink-0 items-center justify-between border-b border-border-subtle bg-surface-1 px-4 select-none">
      {/* Left zone: Mobile trigger & Fast Workspace / Org Switcher Dropdown */}
      <div className="flex min-w-0 items-center gap-2">
        {onOpenMobileSidebar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onOpenMobileSidebar}
            className="md:hidden -ml-1 text-fg-muted hover:text-fg-primary"
            aria-label="Open navigation menu"
          >
            <Menu size={16} />
          </Button>
        ) : null}

        {/* Project Switcher Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-fg-primary h-7"
            >
              <FolderKanban size={13} className="text-primary shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[180px]">
                {activeProject ? activeProject.name : "All Projects"}
              </span>
              <ChevronDown size={11} className="text-fg-muted shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 shadow-lg border border-border-subtle bg-surface-1">
            <DropdownMenuLabel className="flex items-center justify-between text-2xs uppercase tracking-wider text-fg-muted">
              <span>Projects</span>
            </DropdownMenuLabel>
            {safeProjects.length === 0 ? (
              <div className="px-2 py-2 text-2xs text-fg-muted">No projects configured</div>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-border-subtle/40">
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
                        "flex items-center justify-between text-xs py-2 cursor-pointer",
                        isActive && "bg-primary/10 font-semibold text-fg-primary",
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-1.5 rounded-full bg-healthy shrink-0" />
                        <span className="truncate">{p.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-fg-muted shrink-0 ml-2">/{p.slug}</span>
                    </DropdownMenuItem>
                  );
                })}
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => navigate(workspacePath())}
              className="text-2xs text-fg-muted flex items-center justify-between cursor-pointer"
            >
              <span>Manage all projects</span>
              <ArrowRight size={11} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-fg-muted text-xs" aria-hidden>/</span>
        <span className="text-xs font-medium text-fg-muted truncate">
          {pageName}
        </span>
      </div>

      {/* Right zone: Feedback, Theme & Profile (Environment is stripped out and lives in FilterBar) */}
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
          <DropdownMenuContent align="end" className="w-52 shadow-md border border-border-subtle bg-surface-1">
            <DropdownMenuLabel className="font-normal">
              <span className="text-2xs text-fg-muted">Signed in as</span>
              <p className="truncate text-xs font-semibold text-fg-primary">{user?.email ?? "…"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={toggleTheme} className="text-xs flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2">
                {themeMode === "dark" ? <Sun size={13} /> : <Moon size={13} />}
                <span>Theme: {themeMode === "dark" ? "Dark" : "Light"}</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(workspaceSettingsPath())} className="text-xs">
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void logout()} className="text-xs text-semantic-danger">
              <LogOut size={13} className="mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
