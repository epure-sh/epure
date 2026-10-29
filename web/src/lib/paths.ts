/** Route helpers — workspace root vs project-scoped paths */

export function workspacePath(
  segment?: "team" | "usage" | "billing",
): string {
  if (!segment) {
    return "/";
  }
  return `/${segment}`;
}

/** @deprecated use workspacePath */
export const orgPath = workspacePath;

export function workspaceSettingsPath(tab?: "general" | "security" | "agent" | "connected-apps" | "operations"): string {
  if (!tab || tab === "general") {
    return "/settings";
  }
  return `/settings/${tab}`;
}

export function settingsTabFromPath(pathname: string): "general" | "security" | "agent" | "connected-apps" | "operations" {
  if (pathname.endsWith("/security")) {
    return "security";
  }
  if (pathname.endsWith("/agent")) {
    return "agent";
  }
  if (pathname.endsWith("/connected-apps")) {
    return "connected-apps";
  }
  if (pathname.endsWith("/operations")) {
    return "operations";
  }
  return "general";
}

/** @deprecated use workspaceSettingsPath */
export const orgSettingsPath = workspaceSettingsPath;

export function usagePath(): string {
  return "/usage";
}

export function billingPath(): string {
  return "/billing";
}

export function isWorkspaceSettingsRoute(pathname: string): boolean {
  return (
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/usage" ||
    pathname === "/billing"
  );
}

/** @deprecated use isWorkspaceSettingsRoute */
export const isOrgSettingsRoute = isWorkspaceSettingsRoute;

export type ProjectPathSegment =
  | "dashboard"
  | "monitoring"
  | "issues"
  | "alerts"
  | "monitors"
  | "releases"
  | "setup"
  | "settings";

/**
 * Project-scoped path. The dashboard is the project home (`/p/:id`).
 * `monitoring` remains a legacy alias for the same home.
 */
export function projectPath(
  projectId: string,
  segment: Exclude<ProjectPathSegment, "settings"> = "dashboard",
): string {
  if (segment === "dashboard" || segment === "monitoring") {
    return `/p/${projectId}`;
  }
  return `/p/${projectId}/${segment}`;
}

/** Keep the same product tab when switching projects (settings → settings, etc.). */
export function projectPathKeepingTab(projectId: string, pathname: string): string {
  const segment = projectSegmentFromPath(pathname);
  if (segment === "settings") {
    return projectSettingsPath(projectId);
  }
  if (
    segment === "dashboard" ||
    segment === "monitoring" ||
    segment === "issues" ||
    segment === "alerts" ||
    segment === "monitors" ||
    segment === "releases" ||
    segment === "setup"
  ) {
    return projectPath(projectId, segment === "monitoring" ? "dashboard" : segment);
  }
  // Bare `/p/:id` is the dashboard home.
  if (isProjectRoute(pathname) && !segment) {
    return projectPath(projectId, "dashboard");
  }
  return projectPath(projectId, "dashboard");
}

export function projectIssuePath(projectId: string, issueId: string): string {
  return `/p/${projectId}/issues/${issueId}`;
}

/** Issues list with a filter query in the URL (Plausible-style shareable state). */
export function issuesFilterPath(projectId: string, filterQuery: string): string {
  const params = new URLSearchParams();
  params.set("q", filterQuery);
  return `${projectPath(projectId, "issues")}?${params.toString()}`;
}

export type ProjectSettingsTab = "general" | "privacy" | "dsn" | "filters";

export function projectSettingsPath(
  projectId: string,
  tab?: ProjectSettingsTab,
): string {
  if (!tab || tab === "general") {
    return `/p/${projectId}/settings`;
  }
  return `/p/${projectId}/settings/${tab}`;
}

/** Deep-link into Alerts → Rules (configure section). */
export function projectAlertRulesPath(projectId: string): string {
  return `${projectPath(projectId, "alerts")}?section=configure`;
}

export function projectIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/p\/([^/]+)/);
  return match?.[1] ?? null;
}

export function isProjectRoute(pathname: string): boolean {
  return projectIdFromPath(pathname) !== null;
}

export function projectSegmentFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/p\/[^/]+\/([^/]+)/);
  return match?.[1] ?? null;
}

export function isGlobalRoute(pathname: string): boolean {
  return (
    pathname === "/user/settings" ||
    pathname.startsWith("/user/settings/") ||
    pathname === "/user" ||
    pathname.startsWith("/user/")
  );
}

export function isWorkspaceRoute(pathname: string): boolean {
  return !isProjectRoute(pathname) && !isGlobalRoute(pathname);
}

/** @deprecated Single-workspace product — use workspacePath(). */
export function organizationsPath(): string {
  return workspacePath();
}

export function userSettingsPath(
  tab?: "general" | "security" | "agent" | "connected-apps",
): string {
  if (!tab || tab === "general") {
    return "/user/settings";
  }
  return `/user/settings/${tab}`;
}

export type NavigationContext = "global" | "organization" | "project";

export function getNavigationContext(pathname: string): NavigationContext {
  if (isProjectRoute(pathname)) {
    return "project";
  }
  if (isGlobalRoute(pathname)) {
    return "global";
  }
  return "organization";
}


