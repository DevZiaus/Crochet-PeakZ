"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@crochet-peakz/shared";

/** State returned by {@link useSession}. */
export interface SessionState {
  /** Signed in user, or null when signed out. */
  user: AuthUser | null;
  /** True until the first `/me` answer arrives. */
  loading: boolean;
  /** Re-reads the session, using the proxy's refresh and replay. */
  refresh: () => Promise<void>;
  /** Revokes the current session and clears the local user. */
  signOut: () => Promise<void>;
}

/**
 * Reads the current session from the server.
 *
 * The web proxy refreshes an expired access token and replays the request, so
 * this helper simply calls `/me` and trusts the result. Browser code never
 * reads a token.
 *
 * @param signal Optional abort signal for the initial effect.
 * @returns The signed in user, or null when the session is missing or expired.
 */
async function readSession(signal?: AbortSignal): Promise<AuthUser | null> {
  try {
    const response = await fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "same-origin",
      signal,
    });
    if (response.status !== 200) {
      return null;
    }
    return (await response.json()) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Reads the current session from `/api/auth/me`.
 *
 * The web proxy refreshes an expired access token and replays the request, so
 * a 15 minute access token does not sign anyone out while the refresh session
 * is alive.
 */
export function useSession(): SessionState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const nextUser = await readSession();
    setUser(nextUser);
    setLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
    });
    setUser(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void readSession(controller.signal).then((nextUser) => {
      if (!active) {
        return;
      }
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return { user, loading, refresh, signOut };
}
