import { cookies, headers } from "next/headers";
import type { AuthUser } from "@crochet-peakz/shared";
import { readClientIp } from "./client-ip";
import { getWebAuthEnv } from "./web-env";

/** How long the server session read may wait for the API. */
const AUTH_FETCH_TIMEOUT_MS = 5_000;

/**
 * Reads the signed in user on the server.
 *
 * Forwards the incoming cookies and the proxy secret to the API, along with the
 * client address from the incoming headers so the API's per client limiter
 * buckets this call by caller instead of collapsing every render into one
 * bucket. Returns null when the session is missing or truly gone. The request
 * proxy refreshes a stale access cookie before this runs and passes the new
 * value down the request, so a 401 here means the API refused the access token
 * this render sent, not that the refresh cookie is missing. The proxy owns
 * refresh and rotation; this path never refreshes.
 *
 * @returns The current user, or null.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const env = getWebAuthEnv();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  if (!cookieHeader) {
    return null;
  }

  const clientIp = readClientIp(await headers());

  try {
    const response = await fetch(`${env.apiInternalUrl}/auth/me`, {
      headers: {
        cookie: cookieHeader,
        "x-proxy-secret": env.proxySharedSecret,
        "x-forwarded-for": clientIp,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
}
