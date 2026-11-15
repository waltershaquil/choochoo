export const AUTH_COOKIE = "choochoo_auth";

/** The cookie holds a hash of the passcode, never the passcode itself. */
export async function tokenFor(passcode: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`choochoo:${passcode}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
