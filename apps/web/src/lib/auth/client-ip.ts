/**
 * Returns the client address to hand the API for rate limiting and audit rows.
 *
 * This assumes exactly one trusted edge proxy sits in front of the web app.
 * That proxy appends the address it saw to `X-Forwarded-For`, so the last entry
 * is the one the edge added. Reading the first entry would let a caller behind
 * the edge pick its own rate limit bucket by sending a header. A chain of two
 * proxies (a CDN before Caddy) makes the last entry the CDN address and
 * collapses every client into one bucket, so keep the edge to one hop or make
 * the trusted hop count configurable before adding another.
 *
 * When no edge proxy is present, the published web port should not be reachable
 * from untrusted networks. See `docs/deployment.md`.
 *
 * @param headers Incoming request headers.
 * @returns An address, or "unknown" when neither header is present.
 */
export function readClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const lastForwarded = forwarded
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .at(-1);

  return lastForwarded ?? headers.get("x-real-ip")?.trim() ?? "unknown";
}
