"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { UserRole } from "@crochet-peakz/shared";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth/use-session";

interface RequireRoleProps {
  /** The role this area requires. */
  role: UserRole;
  /** The protected content. */
  children: ReactNode;
}

/** Where a signed in account belongs when it cannot open this area. */
function homeForRole(role: UserRole): string {
  return role === "ADMIN" ? "/admin" : "/";
}

/**
 * Returns the signed out visitor target with the request path plus query.
 *
 * The full path (with its query string) becomes the `next` value, so the sign
 * in form, which only reads `next`, sends the visitor back to the same view.
 */
function signInReturnPath(
  pathname: string,
  searchParams: URLSearchParams,
): string {
  const query = searchParams.toString();
  const destination = query ? `${pathname}?${query}` : pathname;

  return `/login?next=${encodeURIComponent(destination)}`;
}

/**
 * Client guard for a protected area.
 *
 * It asks `/api/auth/me` through the web proxy, which refreshes a stale access
 * token and replays the request. That means a 15 minute access token does not
 * sign anyone out while their refresh session is still alive, and the guard
 * still trusts only the database backed answer.
 *
 * A signed out visitor goes to `/login?next=<path>`; a signed in account
 * without the required role goes to its own home. Protected children never
 * render until the answer is an exact role match.
 */
export function RequireRole({ role, children }: RequireRoleProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useSession();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace(signInReturnPath(pathname, searchParams));
      return;
    }

    if (user.role !== role) {
      router.replace(homeForRole(user.role));
    }
  }, [loading, pathname, role, router, searchParams, user]);

  if (loading) {
    return (
      <div
        className="flex min-h-64 flex-1 items-center justify-center gap-3 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span>Checking your access…</span>
      </div>
    );
  }

  if (!user || user.role !== role) {
    return (
      <div className="mx-auto flex min-h-64 max-w-md flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          This area needs a different account
        </h1>
        <p className="text-sm text-muted-foreground">
          Taking you somewhere you can use. If nothing happens, continue below.
        </p>
        {!user ? (
          <Button asChild>
            <Link href={signInReturnPath(pathname, searchParams)}>Sign in</Link>
          </Button>
        ) : null}
      </div>
    );
  }

  return children;
}
