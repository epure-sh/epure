import {
  Activity,
  BarChart3,
  Bell,
  CircleDot,
  Clock,
  CreditCard,
  FileDown,
  GitMerge,
  LayoutGrid,
  Package,
  Radio,
  Search,
  Settings,
  SlidersHorizontal,
  Users,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { buildProjectPathWithFeedQuery } from "../features/issues/project-feed-query-store";
import {
  getIssuesTriage,
  subscribeIssuesTriage,
} from "../features/issues/triage-bridge";
import {
  billingPath,
  isProjectRoute,
  projectIdFromPath,
  projectPath,
  projectSegmentFromPath,
  projectSettingsPath,
  usagePath,
  userSettingsPath,
  workspacePath,
  workspaceSettingsPath,
} from "../lib/paths";

import { useAppContext } from "./app-context";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "../ui/command";

const FOCUS_QUERY_EVENT = "epure:focus-query";
const OPEN_COMMAND_PALETTE_EVENT = "epure:open-command-palette";

export function dispatchFocusQuery() {
  window.dispatchEvent(new CustomEvent(FOCUS_QUERY_EVENT));
}

export function dispatchOpenCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
}

export function useFocusQueryListener(callback: () => void) {
  useEffect(() => {
    const handler = () => callback();
    window.addEventListener(FOCUS_QUERY_EVENT, handler);
    return () => window.removeEventListener(FOCUS_QUERY_EVENT, handler);
  }, [callback]);
}

export function CommandPalette() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { projectId, projects, setProjectId } = useAppContext();
  const [open, setOpen] = useState(false);
  const [, setTriageVersion] = useState(0);

  const safeProjects = Array.isArray(projects) ? projects : [];
  const routeProjectId = projectIdFromPath(pathname);
  const activeProject =
    (routeProjectId
      ? safeProjects.find((p) => p && (p.id === routeProjectId || p.slug === routeProjectId))
      : null) ??
    (projectId ? safeProjects.find((p) => p && (p.id === projectId || p.slug === projectId)) : null) ??
    safeProjects[0] ??
    null;

  const activeProjectId = activeProject?.id ?? null;
  const inProject = isProjectRoute(pathname) && activeProjectId;
  const onIssuesPage = projectSegmentFromPath(pathname) === "issues";
  const triage = getIssuesTriage();

  const run = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => subscribeIssuesTriage(() => setTriageVersion((v) => v + 1)), []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Account">
          <CommandItem onSelect={() => run(() => navigate(userSettingsPath()))}>
            <SlidersHorizontal className="h-4 w-4 text-ink-muted" />
            User Settings
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />

        <CommandGroup heading="Workspace">
          <CommandItem onSelect={() => run(() => navigate(workspacePath()))}>
            <LayoutGrid className="h-4 w-4 text-ink-muted" />
            Projects
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate(workspacePath("team")))}>
            <Users className="h-4 w-4 text-ink-muted" />
            Team
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/org/channels"))}>
            <Radio className="h-4 w-4 text-ink-muted" />
            Output Channels
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate(workspaceSettingsPath()))}>
            <Settings className="h-4 w-4 text-ink-muted" />
            Org Settings
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate(usagePath()))}>
            <BarChart3 className="h-4 w-4 text-ink-muted" />
            Usage
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate(billingPath()))}>
            <CreditCard className="h-4 w-4 text-ink-muted" />
            Billing
          </CommandItem>
        </CommandGroup>

        {safeProjects.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projects & Client Workspaces">
              {safeProjects.map((p) => (
                <CommandItem
                  key={p.id}
                  onSelect={() =>
                    run(() => {
                      setProjectId(p.id);
                      navigate(projectPath(p.id, "issues"));
                    })
                  }
                >
                  <CircleDot className="h-4 w-4 text-signal" />
                  {p.name}
                  <span className="text-2xs text-ink-muted">/{p.slug}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        {inProject ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Project">
              <CommandItem
                onSelect={() =>
                  run(() =>
                    navigate(
                      buildProjectPathWithFeedQuery(activeProjectId, "issues", {
                        currentSearch: search,
                      }),
                    ),
                  )
                }
              >
                <CircleDot className="h-4 w-4 text-ink-muted" />
                Issues
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  run(() => navigate(projectPath(activeProjectId, "monitoring")))
                }
              >
                <Activity className="h-4 w-4 text-ink-muted" />
                Monitoring
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  run(() =>
                    navigate(
                      buildProjectPathWithFeedQuery(activeProjectId, "alerts", {
                        currentSearch: search,
                      }),
                    ),
                  )
                }
              >
                <Bell className="h-4 w-4 text-ink-muted" />
                Alerts
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  run(() => navigate(projectPath(activeProjectId, "releases")))
                }
              >
                <Package className="h-4 w-4 text-ink-muted" />
                Releases
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  run(() => navigate(projectPath(activeProjectId, "monitors")))
                }
              >
                <Clock className="h-4 w-4 text-ink-muted" />
                Cron Monitors
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  run(() => navigate(projectSettingsPath(activeProjectId)))
                }
              >
                <Settings className="h-4 w-4 text-ink-muted" />
                Project settings
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              <CommandItem onSelect={() => run(() => dispatchFocusQuery())}>
                <Search className="h-4 w-4 text-ink-muted" />
                Search issues
                <CommandShortcut>/</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            {onIssuesPage && triage?.active ? (
              <>
                <CommandSeparator />
                <CommandGroup heading="Triage">
                  <CommandItem
                    onSelect={() =>
                      run(() => triage.handlers.applyFilter("is:regression"))
                    }
                  >
                    <Wand2 className="h-4 w-4 text-ink-muted" />
                    Show regressions
                  </CommandItem>
                  <CommandItem
                    onSelect={() =>
                      run(() => triage.handlers.applyFilter("is:snoozed"))
                    }
                  >
                    <Wand2 className="h-4 w-4 text-ink-muted" />
                    Show snoozed
                  </CommandItem>
                  {triage.hasSelectedIssue ? (
                    <>
                      {triage.canResolve ? (
                        <CommandItem
                          disabled={triage.busy}
                          onSelect={() => run(() => triage.handlers.resolveSelected())}
                        >
                          <CircleDot className="h-4 w-4 text-ink-muted" />
                          Resolve selected issue
                          <CommandShortcut>E</CommandShortcut>
                        </CommandItem>
                      ) : null}
                      {triage.canIgnore ? (
                        <CommandItem
                          disabled={triage.busy}
                          onSelect={() => run(() => triage.handlers.ignoreSelected())}
                        >
                          <CircleDot className="h-4 w-4 text-ink-muted" />
                          Ignore selected issue
                          <CommandShortcut>I</CommandShortcut>
                        </CommandItem>
                      ) : null}
                      {triage.canReopen ? (
                        <CommandItem
                          disabled={triage.busy}
                          onSelect={() => run(() => triage.handlers.reopenSelected())}
                        >
                          <CircleDot className="h-4 w-4 text-ink-muted" />
                          Unresolve selected issue
                        </CommandItem>
                      ) : null}
                      {triage.canUnsnooze ? (
                        <CommandItem
                          disabled={triage.busy}
                          onSelect={() => run(() => triage.handlers.unsnoozeSelected())}
                        >
                          <CircleDot className="h-4 w-4 text-ink-muted" />
                          Unsnooze selected issue
                        </CommandItem>
                      ) : null}
                      {triage.canSnooze ? (
                        <CommandItem
                          disabled={triage.busy}
                          onSelect={() => run(() => triage.handlers.snoozeSelected())}
                        >
                          <CircleDot className="h-4 w-4 text-ink-muted" />
                          Snooze selected issue
                          <CommandShortcut>S</CommandShortcut>
                        </CommandItem>
                      ) : null}
                      <CommandItem
                        disabled={triage.busy}
                        onSelect={() => run(() => triage.handlers.exportSelected())}
                      >
                        <FileDown className="h-4 w-4 text-ink-muted" />
                        Copy for AI
                        <CommandShortcut>⌘⇧C</CommandShortcut>
                      </CommandItem>
                      <CommandItem
                        disabled={triage.busy}
                        onSelect={() => run(() => triage.handlers.openDiff())}
                      >
                        <Wand2 className="h-4 w-4 text-ink-muted" />
                        Open diff
                        <CommandShortcut>4</CommandShortcut>
                      </CommandItem>
                    </>
                  ) : null}
                  {triage.canMerge ? (
                    <CommandItem
                      disabled={triage.busy}
                      onSelect={() => run(() => triage.handlers.mergeSelected())}
                    >
                      <GitMerge className="h-4 w-4 text-ink-muted" />
                      Merge selected issues
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              </>
            ) : null}
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
