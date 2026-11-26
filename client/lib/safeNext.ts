/**
 * Where to send a listener after they sign in.
 *
 * Only a path on this site: "/battles?b=abc" is fine, "https://elsewhere"
 * and "//elsewhere" are not, or the sign-in link becomes a way to bounce
 * someone off MOTR onto a page made to look like it.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return "/";
  if (v.length > 500) return "/";
  // Never back to an API route or the sign-in pages themselves.
  if (v.startsWith("/api/") || v.startsWith("/signin")) return "/";
  return v;
}

/** The same path with ?signedin=1 added, so the page knows to refresh who they are. */
export function withSignedIn(path: string): string {
  return path + (path.includes("?") ? "&" : "?") + "signedin=1";
}
