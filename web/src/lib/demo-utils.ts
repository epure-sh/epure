export interface MaybeProject {
  id?: string | null;
  slug?: string | null;
  is_demo?: boolean | null;
}

/**
 * Determines whether a given project is a demo or seeded sandbox project.
 * Real user projects must never be mixed with or display demo telemetry.
 */
export function isDemoProject(project?: MaybeProject | null): boolean {
  if (!project) return false;
  if (project.is_demo === true) return true;

  const id = project.id ?? "";
  if (
    id.startsWith("acme_") ||
    id.startsWith("acme-") ||
    id.startsWith("prj_seed")
  ) {
    return true;
  }

  const slug = project.slug ?? "";
  if (
    slug === "acme" ||
    slug === "acme-web" ||
    slug === "acme-api" ||
    slug === "acme-demo" ||
    slug === "acme-sandbox"
  ) {
    return true;
  }

  return false;
}
