/**
 * Runs once when a Next.js server instance starts.
 *
 * The server side auth variables (`API_INTERNAL_URL`, `PROXY_SHARED_SECRET`,
 * `WEB_APP_URL`) are validated here so a misconfigured deployment fails at
 * boot instead of starting green and returning 500 on every auth request.
 *
 * `next build` does not execute `register`, and the build phase guard keeps a
 * missing runtime variable from breaking a build that should still succeed.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  const [{ getWebAuthEnv }, { getTrustedProxyHops }] = await Promise.all([
    import("./lib/auth/web-env"),
    import("./lib/auth/client-ip"),
  ]);
  getWebAuthEnv();
  getTrustedProxyHops();
}
