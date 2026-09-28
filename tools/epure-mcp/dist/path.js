const MAX_PATH_LEN = 4096;
/** Allow only same-origin Epure API paths (no traversal, no off-host URLs). */
export function assertEpureApiPath(path) {
    const trimmed = path.trim();
    if (trimmed.length == 0 || trimmed.length > MAX_PATH_LEN) {
        throw new Error("path length invalid");
    }
    if (trimmed.includes("://") || trimmed.startsWith("//")) {
        throw new Error("path must be relative to EPURE_URL, not an absolute URL");
    }
    if (trimmed.includes("..") || trimmed.includes("\\")) {
        throw new Error("path must not contain traversal segments");
    }
    let normalized = trimmed;
    if (!normalized.startsWith("/")) {
        normalized = `/${normalized}`;
    }
    if (!normalized.startsWith("/api/v1/") && normalized !== "/api/v1") {
        throw new Error("path must start with /api/v1/");
    }
    if (normalized.startsWith("/api/v1/auth")) {
        throw new Error("auth routes cannot be called via epure_api (use the dashboard login flow)");
    }
    return normalized;
}
