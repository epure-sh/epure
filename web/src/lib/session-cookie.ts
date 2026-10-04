/** True when a Secure session cookie cannot be stored by this page. */
export function httpSecureCookieTrap(protocol: string, sessionSecure: boolean): boolean {
  return sessionSecure && protocol !== "https:";
}

export const HTTP_SESSION_COOKIE_MESSAGE =
  "This page is HTTP. The server sets a Secure session cookie, so the browser drops it and sends you back here. Open the HTTPS URL on port 443, not port 8080.";
