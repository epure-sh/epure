import { GitBranch, LogOut, Menu } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge } from "../ui/badge";
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
  workspaceSettingsPath,
} from "../lib/paths";
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
  const { environment, setEnvironment, projects, user } = useAppContext();
  const logout = useLogout();

  const routeProjectId = projectIdFromPath(pathname);
  const activeProject =
    inProject && routeProjectId
      ? projects.find((project) => project.id === routeProjectId) ?? null
      : null;

  const pageName = getPageName(pathname);

  return (
    <header className="epure-top-strip flex h-11 shrink-0 items-center justify-between border-b border-border bg-bg px-4 select-none">
      {/* Left zone: Mobile trigger & Current Route Breadcrumb */}
      <div className="flex min-w-0 items-center gap-2">
        {onOpenMobileSidebar ? (
          <button
            type="button"
            onClick={onOpenMobileSidebar}
            className="md:hidden -ml-1 flex h-7 w-7 items-center justify-center rounded-md text-ink-muted hover:text-ink hover:bg-state-hover focus-ring"
            aria-label="Open navigation menu"
          >
            <Menu size={16} />
          </button>
        ) : null}
        {inProject && activeProject ? (
          <>
            <span className="text-xs font-semibold text-ink whitespace-nowrap">
              {activeProject.name}
            </span>
            <span className="text-ink-subtle text-xs" aria-hidden>/</span>
          </>
        ) : null}
        <span className="text-xs font-medium text-ink-muted">
          {pageName}
        </span>
      </div>

      {/* Right zone: Environment Switcher & Profile */}
      <div className="flex shrink-0 items-center gap-2.5">
        {inProject ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="btn-tactile flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-ink hover:border-border-strong focus-ring shadow-2xs"
              >
                <GitBranch size={13} className="text-ink-muted shrink-0" />
                <span className="font-mono text-2xs font-medium">{environment}</span>
                {environment === "production" ? (
                  <Badge
                    variant="warning"
                    className="ml-0.5 px-1 py-0 text-[10px] font-semibold uppercase leading-none"
                  >
                    prod
                  </Badge>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 shadow-md border border-border">
              <DropdownMenuLabel className="text-2xs font-semibold text-ink-muted uppercase">
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

        <button
          type="button"
          className="hidden h-7 items-center px-2 text-xs text-ink-muted transition-colors hover:text-ink lg:inline-flex"
          onClick={() => window.open("https://github.com/epure-sh/epure/issues", "_blank")}
        >
          Feedback
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-85 focus-ring"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-muted text-2xs font-semibold text-accent">
                {(user?.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 shadow-md border border-border">
            <DropdownMenuLabel className="font-normal">
              <span className="text-2xs text-ink-subtle">Signed in as</span>
              <p className="truncate text-xs font-semibold text-ink">{user?.email ?? "…"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
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
