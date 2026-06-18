export class ApiError extends Error {
  readonly status: number;
  readonly path: string;

  constructor(status: number, path: string, message?: string) {
    super(message ?? `API ${status}: ${path}`);
    this.name = "ApiError";
    this.status = status;
    this.path = path;
  }
}

export function apiErrorStatus(error: unknown): number | null {
  if (error instanceof ApiError) {
    return error.status;
  }
  if (error instanceof Error) {
    const match = error.message.match(/^API (\d+):/);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

export function isApiError(error: unknown, status?: number): boolean {
  const code = apiErrorStatus(error);
  if (code === null) {
    return false;
  }
  return status === undefined || code === status;
}

export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 403:
        return "You do not have permission to view this.";
      case 404:
        return "The requested resource was not found.";
      case 500:
      case 502:
      case 503:
        return "The server encountered an error. Try again in a moment.";
      default:
        break;
    }
  }
  if (error instanceof Error && error.message.startsWith("Failed to fetch")) {
    return "Network error — check your connection and try again.";
  }
  return fallback;
}
