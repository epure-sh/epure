import {
  FolderKanban,
  GitBranch,
  LogOut,
  Plug,
  Search,
} from "lucide-react";
import { useLogout } from "../lib/use-logout";
import { LogoNavButton } from "../ui/logo";
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
import { Kbd } from "../ui/kbd";
import {
  isProjectRoute,
  projectIdFromPath,
  projectPath,
  projectSettingsPath,
  workspacePath,
  workspaceSettingsPath,
} from "../lib/paths";
import { dispatchFocusQuery } from "./command-palette";
import { NavCrumb, NavIconButton, NavSearchPill, NavSeparator } from "./navbar-crumb";
import { useAppContext, type Environment } from "./app-context";

const environments: Environment[] = ["production", "staging", "local"];

export function TopStrip() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inProject = isProjectRoute(pathname);
  const { environment, setEnvironment, setProjectId, projects, user } = useAppContext();
  const logout = useLogout();

  const routeProjectId = projectIdFromPath(pathname);
  const activeProject =
    inProject && routeProjectId
      ? projects.find((project) => project.id === routeProjectId) ?? null
      : null;

  function enterProject(id: string) {
    setProjectId(id);
    navigate(projectPath(id, "issues"));
  }

  return (
    <header className="epure-top-strip epure-navbar flex shrink-0 items-center border-b border-border bg-surface px-3">
      <div className="flex min-w-0 flex-1 items-center gap-0 overflow-x-auto">
        <LogoNavButton onClick={() => navigate(workspacePath())} />

        <NavSeparator />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <NavCrumb
              icon={FolderKanban}
              label={activeProject?.name ?? "Select project"}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel>Project</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={activeProject?.id ?? ""}
              onValueChange={enterProject}
            >
              {projects.map((project) => (
                <DropdownMenuRadioItem key={project.id} value={project.id}>
                  {project.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(workspacePath())}>
              Manage projects
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {inProject && activeProject ? (
          <>
            <NavSeparator />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <NavCrumb
                  icon={GitBranch}
                  label={environment}
                  badge={
                    environment === "production" ? (
                      <Badge
                        variant="warning"
                        className="ml-0.5 px-1 py-0 text-2xs font-medium uppercase leading-none"
                      >
                        prod
                      </Badge>
                    ) : null
                  }
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel>Environment</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={environment}
                  onValueChange={(value) => setEnvironment(value as Environment)}
                >
                  {environments.map((env) => (
                    <DropdownMenuRadioItem key={env} value={env}>
                      {env}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={() => navigate(projectSettingsPath(activeProject.id, "dsn"))}
              className="epure-navbar-action ml-1.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border-strong px-2 text-xs text-ink-muted transition-colors hover:border-border-strong hover:bg-bg-subtle/40 hover:text-ink"
            >
              <Plug size={13} />
              Connect
            </button>
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pl-2">
        <button
          type="button"
          className="epure-navbar-feedback hidden h-8 items-center px-2 text-xs text-ink-muted transition-colors hover:text-ink lg:inline-flex"
          onClick={() => window.open("https://github.com/kelson/epure/issues", "_blank")}
        >
          Feedback
        </button>

        {inProject ? (
          <>
            <NavIconButton
              label="Search"
              className="sm:hidden"
              onClick={() => dispatchFocusQuery()}
            >
              <Search size={14} strokeWidth={1.75} />
            </NavIconButton>

            <NavSearchPill
              onClick={() => dispatchFocusQuery()}
              shortcut={<Kbd keys="⌘K" className="border-0 bg-transparent px-0 py-0 text-2xs" />}
              className="hidden sm:inline-flex"
            />
          </>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account"
              className="epure-navbar-account ml-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-80 focus-ring data-[state=open]:opacity-80"
            >
              <span className="epure-navbar-avatar flex h-6 w-6 items-center justify-center rounded-full bg-accent-muted text-2xs font-medium text-accent">
                {(user?.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <span className="text-xs text-ink-muted">Signed in as</span>
              <p className="truncate text-sm font-medium text-ink">{user?.email ?? "…"}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate(workspaceSettingsPath())}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void logout()}>
              <LogOut size={14} className="mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

