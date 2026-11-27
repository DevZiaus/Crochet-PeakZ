"use client";

import type { ReactNode } from "react";
import { SessionContext } from "@/lib/auth/session-context";
import { useSessionController } from "@/lib/auth/use-session";

/** Props for {@link SessionProvider}. */
export interface SessionProviderProps {
  /** Storefront subtree sharing one client session read and sign out state. */
  children: ReactNode;
}

/**
 * Shares one client `/api/auth/me` session read and sign out transition across
 * the storefront shell (used by both `AuthMenu` and `CartProvider`).
 */
export function SessionProvider({ children }: SessionProviderProps) {
  const session = useSessionController(true);

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
