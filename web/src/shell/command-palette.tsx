import {
  BarChart3,
  Bell,
  CircleDot,
  CreditCard,
  FileDown,
  GitMerge,
  LayoutGrid,
  Package,
  Search,
  Settings,
  Users,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getIssuesTriage,
  subscribeIssuesTriage,
} from "../features/issues/triage-bridge";
import {
  billingPath,
  isProjectRoute,
  projectPath,
  projectSegmentFromPath,
  projectSettingsPath,
  usagePath,
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

export function dispatchFocusQuery() {
  window.dispatchEvent(new CustomEvent(FOCUS_QUERY_EVENT));
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
  const { pathname } = useLocation();
  const { projectId, projects } = useAppContext();
  const [open, setOpen] = useState(false);
  const [, setTriageVersion] = useState(0);

  const activeProjectId = projectId ?? projects[0]?.id ?? null;
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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => subscribeIssuesTriage(() => setTriageVersion((v) => v + 1)), []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Workspace">
          <CommandItem onSelect={() => run(() => navigate(workspacePath()))}>
            <LayoutGrid className="h-4 w-4 text-ink-muted" />
            Projects
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate(workspacePath("team")))}>
            <Users className="h-4 w-4 text-ink-muted" />
            Team
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate(workspaceSettingsPath()))}>
            <Settings className="h-4 w-4 text-ink-muted" />
            Settings
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
        {inProject ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Project">
              <CommandItem
                onSelect={() =>
                  run(() => navigate(projectPath(activeProjectId, "issues")))
                }
              >
                <CircleDot className="h-4 w-4 text-ink-muted" />
                Issues
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
                  run(() => navigate(projectPath(activeProjectId, "alerts")))
                }
              >
                <Bell className="h-4 w-4 text-ink-muted" />
                Alerts
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
