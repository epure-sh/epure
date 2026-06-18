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

export function workspaceSettingsPath(tab?: "general" | "security"): string {
  if (!tab || tab === "general") {
    return "/settings";
  }
  return `/settings/${tab}`;
}

export function settingsTabFromPath(pathname: string): "general" | "security" {
  return pathname.endsWith("/security") ? "security" : "general";
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

export function projectPath(
  projectId: string,
  segment: "issues" | "releases" | "alerts" | "setup" = "issues",
): string {
  return `/p/${projectId}/${segment}`;
}

/** Issues list with a filter query in the URL (Plausible-style shareable state). */
export function issuesFilterPath(projectId: string, filterQuery: string): string {
  const params = new URLSearchParams();
  params.set("q", filterQuery);
  return `${projectPath(projectId, "issues")}?${params.toString()}`;
}

export function projectSettingsPath(
  projectId: string,
  tab?: "general" | "dsn" | "webhooks",
): string {
  if (!tab || tab === "general") {
    return `/p/${projectId}/settings`;
  }
  return `/p/${projectId}/settings/${tab}`;
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

export function isWorkspaceRoute(pathname: string): boolean {
  return !isProjectRoute(pathname);
}
