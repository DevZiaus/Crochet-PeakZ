"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import type { AuthUser } from "@crochet-peakz/shared";
import {
  SessionContext,
  type SessionState,
  type SignOutResult,
} from "./session-context";

export type { SessionState, SignOutResult };

/** Upper bound for one browser session or sign out request. */
const AUTH_FETCH_TIMEOUT_MS = 10_000;

/**
 * Reads the current session from the server.
 *
 * The web proxy refreshes an expired access token and replays the request, so
 * this helper simply calls `/api/auth/me` and trusts the result. Browser code
 * never reads a token.
 *
 * @param signal Optional abort signal for the initial effect.
 * @returns The signed in user, or null when the session is missing or expired.
 */
export async function readClientSession(
  signal?: AbortSignal,
): Promise<AuthUser | null> {
  const controller = new AbortController();
  const onAbort = (): void => {
    controller.abort();
  };

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", onAbort, { once: true });
  }

  const timer = setTimeout(() => {
    controller.abort();
  }, AUTH_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    if (response.status !== 200) {
      return null;
    }
    return (await response.json()) as AuthUser;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Calls `/api/auth/logout` and returns whether the server revoked the session.
 */
export async function requestClientSignOut(): Promise<SignOutResult> {
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS),
    });

    if (response.ok) {
      return { success: true };
    }

    return { success: false };
  } catch {
    return { success: false };
  }
}

/**
 * Standalone session state hook used by `SessionProvider` and by components
 * mounted outside `SessionProvider` (such as `(auth)` layouts).
 */
export function useSessionController(enabled = true): SessionState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(enabled);

  const refreshSession = useCallback(async (): Promise<AuthUser | null> => {
    const nextUser = await readClientSession();
    setUser(nextUser);
    setLoading(false);
    return nextUser;
  }, []);

  const signOut = useCallback(async (): Promise<SignOutResult> => {
    const result = await requestClientSignOut();
    if (result.success) {
      setUser(null);
    }
    return result;
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    void readClientSession(controller.signal).then((nextUser) => {
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
  }, [enabled]);

  return { user, loading, signOut, refreshSession };
}

/**
 * Reads the current session from the shared `SessionProvider` when mounted
 * inside the storefront shell, or falls back to a standalone `/api/auth/me`
 * read when rendered outside `SessionProvider`.
 */
export function useSession(): SessionState {
  const shared = useContext(SessionContext);
  const standalone = useSessionController(shared === null);
  return shared ?? standalone;
}
