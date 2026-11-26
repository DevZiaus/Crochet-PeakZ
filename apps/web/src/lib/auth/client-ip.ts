/** Authenticated client IP header forwarded by the Next.js proxy to the API. */
export const PROXY_CLIENT_IP_HEADER = "x-proxy-client-ip";

/**
 * Reads and validates the number of trusted proxy hops appended to
 * `X-Forwarded-For` before the Next.js server.
 *
 * Defaults to `1` when `TRUSTED_PROXY_HOPS` is unset or blank (one reverse
 * proxy or PaaS router such as Vercel, Caddy, or Nginx). Set `2` when an
 * upstream CDN such as Cloudflare sits in front of that proxy.
 *
 * @param raw Raw `TRUSTED_PROXY_HOPS` environment value.
 * @returns Positive integer hop count (at least `1`).
 */
export function getTrustedProxyHops(
  raw: string | undefined = process.env["TRUSTED_PROXY_HOPS"],
): number {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return 1;
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Invalid TRUSTED_PROXY_HOPS "${trimmed}". Expected a positive integer such as 1 or 2.`,
    );
  }

  const hops = Number(trimmed);
  if (!Number.isSafeInteger(hops) || hops < 1) {
    throw new Error(
      `Invalid TRUSTED_PROXY_HOPS "${trimmed}". Expected a positive integer such as 1 or 2.`,
    );
  }

  return hops;
}

/**
 * Returns the client address to hand the API for rate limiting and audit rows.
 *
 * Selects the entry `trustedHops` positions from the end of `X-Forwarded-For`
 * (clamped to index `0`). With `1` trusted edge proxy (default), that is the
 * last hop the edge added. With a CDN such as Cloudflare in front of Vercel,
 * Caddy, or Nginx (`TRUSTED_PROXY_HOPS=2`), that skips the outer origin edge hop
 * and picks the real visitor IP Cloudflare appended.
 *
 * When no edge proxy is present, the published web port should not be reachable
 * from untrusted networks. See `docs/deployment.md`.
 *
 * @param headers Incoming request headers.
 * @param trustedHops Optional trusted proxy hop override (defaults to `getTrustedProxyHops()`).
 * @returns An address, or "unknown" when neither header is present.
 */
export function readClientIp(
  headers: Headers,
  trustedHops: number = getTrustedProxyHops(),
): string {
  const forwarded = headers.get("x-forwarded-for");
  const entries = forwarded
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (entries && entries.length > 0) {
    const hops = Math.max(1, Math.trunc(trustedHops));
    const selected = entries[Math.max(0, entries.length - hops)];
    if (selected) {
      return selected;
    }
  }

  return headers.get("x-real-ip")?.trim() || "unknown";
}
