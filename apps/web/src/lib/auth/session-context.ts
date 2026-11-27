"use client";

import { createContext } from "react";
import type { AuthUser } from "@crochet-peakz/shared";

/** Whether the server revoked the session behind a sign out call. */
export type SignOutResult = { success: true } | { success: false };

/** State exposed by {@link useSession} and {@link SessionProvider}. */
export interface SessionState {
  /** Signed in user, or null when signed out. */
  user: AuthUser | null;
  /** True until the first `/api/auth/me` answer arrives. */
  loading: boolean;
  /**
   * Revokes the current session and clears the shared user on success.
   */
  signOut: () => Promise<SignOutResult>;
  /**
   * Re-reads `/api/auth/me` to reconcile session state (for example after a
   * 401 from an account cart endpoint).
   */
  refreshSession?: () => Promise<AuthUser | null>;
}

/** Shared storefront session context populated by `SessionProvider`. */
export const SessionContext = createContext<SessionState | null>(null);
