import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  FolderKanban,
  GitBranch,
  LogOut,
  Menu,
  Moon,
  Sun,
  Users,
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { useAppContext, type Environment } from "./app-context";
import { useLogout } from "../lib/use-logout";

const environments: Environment[] = ["production", "staging", "local"];

function getPageName(pathname: string): string {
  if (pathname.includes("/issues")) return "Issues Feed";
  if (pathname.includes("/releases")) return "Releases";
  if (pathname.includes("/alerts")) return "Alerts";
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
    environment,
    setEnvironment,
    projects,
    user,
    setProjectId,
    organizations,
    currentOrg,
    switchOrg,
  } = useAppContext();
  const logout = useLogout();
  const [themeMode, toggleTheme] = useThemeMode();

  const routeProjectId = projectIdFromPath(pathname);
  const activeProject =
    inProject && routeProjectId
      ? projects.find((project) => project.id === routeProjectId) ?? null
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

        {/* Organization / Workspace Switcher Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-fg-primary h-7"
              title="Switch Organization / Workspace"
            >
              <Building2 size={13} className="text-primary shrink-0" />
              <span className="truncate max-w-[120px] sm:max-w-[160px]">
                {currentOrg ? currentOrg.name : user?.org_name || "Workspace"}
              </span>
              {currentOrg && (
                <span className="hidden sm:inline-flex rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-mono font-medium text-primary uppercase">
                  {currentOrg.role}
                </span>
              )}
              <ChevronDown size={11} className="text-fg-muted shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 shadow-lg border border-border-subtle bg-surface-1">
            <DropdownMenuLabel className="flex items-center justify-between text-2xs uppercase tracking-wider text-fg-muted">
              <span>Workspaces</span>
              <span className="text-[10px] text-fg-muted">{organizations.length} joined</span>
            </DropdownMenuLabel>
            <div className="max-h-56 overflow-y-auto divide-y divide-border-subtle/40">
              {organizations.map((org) => {
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
                      <span className="truncate">{org.name}</span>
                      <span className="text-2xs font-mono text-fg-muted capitalize">
                        {org.role} · {org.member_count} member{org.member_count === 1 ? "" : "s"}
                      </span>
                    </div>
                    {isSelected ? <Check size={13} className="text-primary shrink-0" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => navigate("/team")}
              className="text-2xs text-fg-muted flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Users size={12} />
                <span>Manage Team & Invitations</span>
              </div>
              <ArrowRight size={11} />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-fg-muted text-xs" aria-hidden>/</span>

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
            {projects.length === 0 ? (
              <div className="px-2 py-2 text-2xs text-fg-muted">No projects configured</div>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-border-subtle/40">
                {projects.slice(0, 25).map((p) => {
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

      {/* Right zone: Environment Switcher & Profile */}
      <div className="flex shrink-0 items-center gap-2.5">
        {inProject ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="btn-tactile flex items-center gap-1.5 px-2.5 text-xs text-fg-primary shadow-2xs font-normal"
              >
                <GitBranch size={13} className="text-fg-muted shrink-0" />
                <span className="font-mono text-2xs font-medium">{environment}</span>
                {environment === "production" ? (
                  <Badge
                    variant="warning"
                    className="ml-0.5 px-1 py-0 text-[10px] font-semibold uppercase leading-none"
                  >
                    prod
                  </Badge>
                ) : null}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 shadow-md border border-border-subtle bg-surface-1">
              <DropdownMenuLabel className="text-2xs font-semibold text-fg-muted uppercase">
                Active Environment
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={environment}
                onValueChange={(value) => setEnvironment(value as Environment)}
              >
                {environments.map((env) => (
                  <DropdownMenuRadioItem key={env} value={env} className="text-xs font-mono">
                    {env}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

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
