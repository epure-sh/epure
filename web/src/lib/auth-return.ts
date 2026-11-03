/** Keep OAuth consent queries through sign-in without allowing external redirects. */
export function safeAuthReturn(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://epure.invalid");
    return url.origin === "https://epure.invalid" ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch { return "/"; }
}
