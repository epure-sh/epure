/** Parse an invite token from a raw string or invitation URL. */
export function extractInviteToken(tokenOrUrl: string): string {
  const trimmed = tokenOrUrl.trim();
  if (!trimmed) return "";

  // 1. Try URL parsing
  try {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(trimmed, origin);
    const queryToken =
      url.searchParams.get("token") ??
      url.searchParams.get("invite") ??
      url.searchParams.get("invite_token") ??
      url.searchParams.get("invitation_token") ??
      url.searchParams.get("t");
    if (queryToken) return queryToken.trim();

    // Check pathname segments: e.g. /accept-invitation/TOKEN or /invite/TOKEN or /join/TOKEN
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length >= 2) {
      const last = segments[segments.length - 1];
      const prev = segments[segments.length - 2]?.toLowerCase();
      if (
        prev === "invite" ||
        prev === "invitation" ||
        prev === "accept-invitation" ||
        prev === "join"
      ) {
        return last;
      }
    }
  } catch {
    // not a valid URL
  }

  // 2. Regex for standard UUID (8-4-4-4-12)
  const uuidMatch = trimmed.match(
    /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
  );
  if (uuidMatch) {
    return uuidMatch[0];
  }

  // 3. Fallback to raw trimmed string
  return trimmed;
}
