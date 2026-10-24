import { cookies } from "next/headers";
import type { AuthUser } from "@crochet-peakz/shared";
import { getWebAuthEnv } from "./web-env";

/**
 * Reads the signed in user on the server.
 *
 * Forwards the incoming cookies and the proxy secret to the API. Returns null
 * when the session is missing or expired; the browser side proxy is what
 * refreshes a stale access token on interactive requests.
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

  try {
    const response = await fetch(`${env.apiInternalUrl}/auth/me`, {
      headers: {
        cookie: cookieHeader,
        "x-proxy-secret": env.proxySharedSecret,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
}
