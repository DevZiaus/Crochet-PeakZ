"use client";

import { useCallback, useEffect, useState } from "react";
import type { AuthUser } from "@crochet-peakz/shared";

/** State returned by {@link useSession}. */
export interface SessionState {
  /** Signed in user, or null when signed out. */
  user: AuthUser | null;
  /** True until the first `/me` answer arrives. */
  loading: boolean;
  /**
   * Revokes the current session and clears the local user.
   *
   * Returns `success: true` when the server revoked the session and `success:
   * false` when the request failed, so callers can keep the user in place and
   * retry on failure.
   */
  signOut: () => Promise<SignOutResult>;
}

/** Whether the server revoked the session behind a sign out call. */
type SignOutResult = { success: true } | { success: false };

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

  const signOut = useCallback(async (): Promise<SignOutResult> => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
      });

      // Keep the local user when the server did not revoke the session, so the
      // screen never claims the customer is signed out while the cookie lives.
      if (response.ok) {
        setUser(null);
        return { success: true };
      }

      return { success: false };
    } catch {
      // The request never reached the server, so the session is still alive.
      return { success: false };
    }
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

  return { user, loading, signOut };
}
