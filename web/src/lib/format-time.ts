export function formatRelativeTime(iso: string, now = Date.now()): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) {
    return "—";
  }

  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 60) {
    return "just now";
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin}m ago`;
  }

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return `${diffHr}h ago`;
  }

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) {
    return "Yesterday";
  }
  if (diffDay < 7) {
    return `${diffDay}d ago`;
  }

  return new Date(iso).toLocaleDateString();
}

/** Short age label for feed columns (e.g. 4mo, 2d, 3h). */
export function formatAge(iso: string, now = Date.now()): string {
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) {
    return "—";
  }

  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) {
    return `${diffSec}s`;
  }
  if (diffMin < 60) {
    return `${diffMin}m`;
  }
  if (diffHr < 24) {
    return `${diffHr}h`;
  }
  if (diffDay < 7) {
    return `${diffDay}d`;
  }
  if (diffWeek < 5) {
    return `${diffWeek}w`;
  }
  if (diffMonth < 12) {
    return `${diffMonth}mo`;
  }
  return `${diffYear}y`;
}
