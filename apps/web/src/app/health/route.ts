/**
 * Web liveness probe for containers and reverse proxies.
 *
 * Kept separate from `/api/*`, which is routed to the Express API.
 */
export const dynamic = "force-dynamic";

/**
 * Returns a small JSON payload proving the Next.js server is running.
 *
 * @returns HTTP 200 with status metadata.
 */
export function GET(): Response {
  return Response.json({
    status: "ok",
    service: "web",
    timestamp: new Date().toISOString(),
  });
}
