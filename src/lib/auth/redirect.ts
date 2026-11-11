const FALLBACK_PATH = "/connect-bank";
const MAX_DECODE_PASSES = 5;

/** Accept application-relative paths only, including at every encoding layer. */
export function getSafeAuthRedirect(next: string | null, origin: string): URL {
  const base = new URL(origin).origin;
  const fallback = new URL(FALLBACK_PATH, base);
  if (!next || next.length > 2048) return fallback;

  let candidate = next;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    // URL parsing discards some whitespace and treats backslashes as slashes.
    if (
      !candidate.startsWith("/") ||
      candidate.startsWith("//") ||
      candidate.trim() !== candidate ||
      /[\\\u0000-\u001f\u007f]/.test(candidate)
    ) return fallback;

    try {
      const parsed = new URL(candidate, base);
      if (parsed.origin !== base || parsed.pathname.startsWith("//")) {
        return fallback;
      }
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) return new URL(next, base);
      candidate = decoded;
    } catch {
      return fallback;
    }
  }

  // Reject excessive encoding instead of trusting a partially decoded value.
  return fallback;
}
